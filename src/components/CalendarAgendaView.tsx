import { useState, useEffect, useMemo, useRef } from "react";
import { useT } from "../i18n/I18nProvider";
import { langToLocale } from "../i18n";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { UndoToast, type UndoToastData } from "./UndoToast";
import { AnimatedCheck, AnimatedStrike } from "./AnimatedCheck";
import { DAlert as AlertCircle, DBell as Bell, DBellOff as BellOff, DCalendarDays as CalendarDays, DCheck as Check, DCheckCircle as CheckCircle2, DChevronLeft as ChevronLeft, DChevronRight as ChevronRight, DEdit as Pencil, DCircle as Circle, DClock as Clock, DPlus as Plus, DTrash as Trash2, DVolume as Volume2, DX as X } from "./icons/doodle";
import { playPopSound, playSuccessSound } from "../lib/sound";
import { playAlarmChime, sendDesktopNotification, requestNotificationPermission, stopAlarmBackgroundAlert, startAlarmBackgroundAlert } from "../lib/alarm";

/* Organik el çizimi alarm zili piktogramı */
function SketchyAlarmBell({ size = 18, ringing = false, className = "" }: { size?: number; ringing?: boolean; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block flex-shrink-0 ${ringing ? "animate-bounce" : ""} ${className}`}
    >
      <path d="M18 16.5c-1-1-2-2.5-2-6.5a4 4 0 0 0-8 0c0 4-1 5.5-2 6.5h12Z" fill="currentColor" fillOpacity={ringing ? 0.25 : 0} />
      <path d="M10 19.5a2 2 0 0 0 4 0" />
      <path d="M12 2.5v1.5" />
      {ringing && (
        <>
          <path d="M4 4.5c-.8.8-1.5 2-1.5 3.5" strokeWidth={1.5} />
          <path d="M20 4.5c.8.8 1.5 2 1.5 3.5" strokeWidth={1.5} />
        </>
      )}
    </svg>
  );
}

interface AgendaEvent {
  id: string;
  dateKey: string; // "YYYY-MM-DD"
  timeStr: string; // "14:00"
  title: string;
  description?: string;
  category: "meeting" | "appointment" | "personal";
  hasAlarm?: boolean;
  alarmTimestamp?: number | null;
  isAlarmTriggered?: boolean;
  isDone: boolean;
  createdAt: number;
}

const STORAGE_KEY_AGENDA = "superr_agenda_events_v4";
const STORAGE_KEY_SELECTED_DATE = "superr_agenda_selected_date_v1";

/** Çapraz bağlantı: bir gün günlüğünü açmak için. */
interface CalendarAgendaViewProps {
  onOpenJournal?: (dateKey: string) => void;
}

/** Yerel Date -> YYYY-MM-DD anahtarı. */
function toDateKey(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
export function CalendarAgendaView({ onOpenJournal }: CalendarAgendaViewProps) {
  const { t, lang } = useT();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  // Ajanda her açıldığında güncel yerel günü gösterir; eski seçili tarih
  // (ör. 30 Eylül) yeni oturumun varsayılanını kilitlemez.
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // Demo seed kayitlari: YALNIZCA hic kayit yoksa gosterilir (bos ekran yerine ornek).
  // KRITIK: seed'ler localStorage'a YAZILMAZ (asagidaki persist effect'i bunlari eler),
  // bu yuzden her yenilemede tekrar uretilir. Kullanici kendi kaydini eklediginde
  // "diger gunlerdeki kayitlar" bolumunde bu 3 ornek DEMO kaydi gorunuyordu —
  // kullanici bunlari kendi kayitlari saniyordu ("ajanda eski notlarla doldu").
  // Duzeltme: gercek kullanici kaydi varsa demo seed'ler HIC uretilmez.
  const seedEvents = (dateKey: string, tt: (k: string) => string): AgendaEvent[] => [
    { id: "e1", dateKey, timeStr: "09:00", title: tt("cal.seed_1"), category: "meeting", hasAlarm: false, isDone: true, createdAt: 0 },
    { id: "e2", dateKey, timeStr: "14:30", title: tt("cal.seed_2"), category: "appointment", hasAlarm: true, isDone: false, createdAt: 0 },
    { id: "e3", dateKey, timeStr: "20:00", title: tt("cal.seed_3"), category: "personal", hasAlarm: false, isDone: false, createdAt: 0 },
  ];

  // ⭐ MADDE 6: SAATLIK ZAMAN CIZELGESI (06:00 - 23:00), GUN BAZINDA kaydedilir.
  // Anahtar: { "YYYY-MM-DD": { "07:00": "metin", ... } }
  const HOUR_SLOTS = Array.from({ length: 18 }, (_, i) => String(i + 6).padStart(2, "0") + ":00"); // 06:00..23:00
  const HOUR_STORAGE_KEY = "superr_agenda_hours_v1";

  const [hours, setHours] = useState<Record<string, Record<string, string>>>(() => {
    try {
      const raw = localStorage.getItem(HOUR_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(HOUR_STORAGE_KEY, JSON.stringify(hours));
    } catch {}
  }, [hours]);

  // MADDE 9: Anlamsiz TEST gorevleri ("fhsfgjsfgjsjg" gibi klavye karalamalari)
  // yuklenirken ayiklanir. Kural: sesli harf orani cok dusuk VEYA ayni harfin
  // 4+ kez tekrari -> klavye karalamasi kabul edilir. Gercek kelimeler korunur.
  const isTestEventTitle = (titleRaw: string): boolean => {
    const title = (titleRaw || "").trim();
    if (title.length < 6) return false;
    const lower = title.toLowerCase().replace(/[^a-zçğıöşü]/g, "");
    if (!lower) return false;
    // ayni harf 4+ kez ardisik
    if (/(.)\1{3,}/.test(lower)) return true;
    // sesli harf orani %15'in altinda (Turkce/Ingilizce/Almanca icin cok dusuk)
    const vowels = (lower.match(/[aeiouıöü]/g) || []).length;
    const ratio = vowels / lower.length;
    return ratio < 0.15;
  };

  const [events, setEvents] = useState<AgendaEvent[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_AGENDA);
      const parsed = raw ? JSON.parse(raw) : [];
      // Eski surumlerde localStorage'a yazilmis TURKCE demo seed kayitlarini ayikla
      // (v53 oncesi seed'ler farkli id'lerle kalici hale gelmisti -> her dilde TR gorunuyordu).
      const LEGACY_SEED_IDS = new Set([
        "e1", "e2", "e3",
        "seed-1", "seed-2", "seed-3", "seed1", "seed2", "seed3",
        "demo-1", "demo-2", "demo-3", "demo1", "demo2", "demo3",
      ]);
      const legacyTitles = [
        t("cal.seed_1"), t("cal.seed_2"), t("cal.seed_3"),
        "Gün kelimelerini tekrar et", "SRS kart çalışma seansı", "Kelime avı mini oyunu",
        "İngilizce: Serenity & resilience kelime pratiği",
      ];
      const userEvents = (Array.isArray(parsed) ? parsed : []).filter((e: any) => {
        if (!e || typeof e !== "object") return false;
        // MADDE 9: anlamsiz test gorevlerini ayikla.
        if (isTestEventTitle(String(e.title || ""))) return false;
        if (LEGACY_SEED_IDS.has(String(e.id))) return false;
        if (typeof e.title === "string" && legacyTitles.includes(e.title.trim())) return false;
        return true;
      });
      // Gercek kullanici kaydi varsa demo seed'leri HIC ekleme.
      if (userEvents.length > 0) return userEvents;
      const today2 = new Date();
      const pad2 = (x: number) => String(x).padStart(2, "0");
      const tk = today2.getFullYear() + "-" + pad2(today2.getMonth() + 1) + "-" + pad2(today2.getDate());
      return seedEvents(tk, t);
    } catch {}
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    return seedEvents(todayKey, t);
  });

  // Seed tutarliligi: dil degisince varsayilan seed basliklarini guncelle.
  useEffect(() => {
    setEvents((prev) => prev.map((e) => {
      if (e.id === "e1") return { ...e, title: t("cal.seed_1") };
      if (e.id === "e2") return { ...e, title: t("cal.seed_2") };
      if (e.id === "e3") return { ...e, title: t("cal.seed_3") };
      return e;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, t]);

  const journalDates = useMemo(() => {
    try {
      const raw = localStorage.getItem("yourbook_journal_entries_v1");
      if (!raw) return new Set<string>();
      const entries = JSON.parse(raw);
      if (!Array.isArray(entries)) return new Set<string>();
      return new Set<string>(entries.map((e: any) => e.dateKey));
    } catch {
      return new Set<string>();
    }
  }, []);

  const [newTime, setNewTime] = useState("14:30");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<"meeting" | "appointment" | "personal">("meeting");
  const [enableAlarm, setEnableAlarm] = useState(true);

  // Çalan alarm modalı için state
  const [ringingEvent, setRingingEvent] = useState<AgendaEvent | null>(null);

  // Düzenlenen kaydın id'si: null ise form "yeni kayıt" modundadır.
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  // MADDE 2: silmeye "geri al" — 5 sn bildirim, kalici silme 5 sn sonra tamamlanmis sayilir.
  const [undoToast, setUndoToast] = useState<UndoToastData | null>(null);

  // Erişilebilirlik: hareket azaltma tercihi açıksa dekoratif animasyonlar kapanır.
  const isReducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    try {
    // Yalnizca KULLANICI kayitlari saklanir (demo seed'ler sanitizeEvents'te ayiklanir).
    const userOnly = events.filter((e) => e.id !== "e1" && e.id !== "e2" && e.id !== "e3");
    if (userOnly.length) localStorage.setItem(STORAGE_KEY_AGENDA, JSON.stringify(userOnly));
    else localStorage.removeItem(STORAGE_KEY_AGENDA);
    } catch {}
  }, [events]);
  // Secili gunu kalici sakla: yeniden acilista ayni gune donulur (kayitlar kaybolmus gibi gorunmez)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SELECTED_DATE, toDateKey(selectedDate));
    } catch {}
  }, [selectedDate]);
  // Secili gun degistiginde takvimin gosterdigi ay da o gune hizalanir
  useEffect(() => {
    setCurrentMonth((prev) =>
      prev.getFullYear() === selectedDate.getFullYear() && prev.getMonth() === selectedDate.getMonth()
        ? prev
        : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    );
  }, [selectedDate]);

  // ⭐ CANLI ALARM MOTORU: Her 4 saniyede bir bekleyen ajanda alarmlarını denetle
  // v-alarmpopover (SECENEK 2): ALARM ARTIK EKRANI KAPLAYAN MODAL ACMAZ.
  // ONCEKI DAVRANIS: kayit eklenir eklenmez (alarm saati gelince) tam ekran modal
  // aciliyordu -> "ajandaya kaydet" tiklamasiyla AYNI ANDA oldugu icin kullanici
  // kaydin kaydedildigini goremadan ekran kapaniyor, "tik cikmadi / buton calismadi"
  // saniyordu (canli testte butona 30sn boyunca TIKLANAMADI).
  // YENI: alarm SAG USTTE kucuk ve KAPATILABILIR bir karta donusur; gercek bildirimi
  // (ses + masaustu bildirimi) yine verir. "alarmı test et" ile tam modal acilabilir.
  useEffect(() => {
    const checkAlarms = () => {
      const now = Date.now();
      for (const ev of events) {
        if (ev.hasAlarm && ev.alarmTimestamp && ev.alarmTimestamp <= now && !ev.isAlarmTriggered && !ev.isDone) {
          const [eh, em] = (ev.timeStr || "").split(":").map(Number);
          const [ey, eMo, ed] = ev.dateKey.split("-").map(Number);
          const evTs = new Date(ey, eMo - 1, ed, eh || 0, em || 0, 0).getTime();
          // Alarm saati GECMISTE kalmissa (ornegin 2 saat once) masaustu bildirimi
          // gondermeyiz; sadece gorunur kartla haber veririz. Boylece "eski kayit
          // eklendi" sanilip ekran kapanmasi yasanmaz.
          const isFresh = now - evTs < 2 * 60 * 1000;
          if (isFresh) {
            playAlarmChime();
            sendDesktopNotification(
              t("cal.alarm_notif").replace("{time}", ev.timeStr),
              `${ev.title} ${ev.description ? `\n${ev.description}` : ""}`
            );
            startAlarmBackgroundAlert(ev.title, lang);
          }
          setRingingEvent(ev); // tam modal DEGIL, sag ust karti
          setEvents((prev) =>
            prev.map((item) => (item.id === ev.id ? { ...item, isAlarmTriggered: true } : item))
          );
          break;
        }
      }
    };

    const interval = setInterval(checkAlarms, 4000);
    return () => clearInterval(interval);
  }, [events, t, lang]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const selectedDateKey = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    playPopSound();
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    playPopSound();
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    playPopSound();
    setSelectedDate(new Date(year, month, day));
  };

  // Yeni Not ve Alarm Ekleme
  // v-savefix2: kayit SONRASI kullaniciya GORUNUR onay.
  // ONCEKI DENEMENIN HATASI: onay seridi panelin ICINDE, kayit listesinin basindaydi.
  // Kullanici paneli asagi kaydirmisken (veya panel uzunken) serit ekranin ALTINDA
  // kaliyordu -> "tik cikmiyor, buton calismiyor" (canli olcum: serit y=659, gorunur
  // pencere 720px ama kullanicinin o anki kaydirma konumuna gore altinda).
  // DUZELTME: onay artik PANELIN ICINDE DEGIL, ekranin sag ust kosesine SABITLENIR
  // (position: fixed). Sayfa/panel nerede kaydirilmis olursa olsun HER ZAMAN gorunur.
  const paneRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const saveNoticeTimerRef = useRef<number | null>(null);

  const showSaveNotice = (msg: string) => {
    setSaveNotice(msg);
    if (saveNoticeTimerRef.current) window.clearTimeout(saveNoticeTimerRef.current);
    saveNoticeTimerRef.current = window.setTimeout(() => setSaveNotice(null), 3600);
  };

  // Yeni kaydi GORUNUR hale getir: paneli kayit listesinin basina kaydir.
  // (Panelin kendi scrollTop'u kullanilir; sayfa kaydirma konumu degismez.)
  const scrollToNewRecord = () => {
    window.setTimeout(() => {
      try {
        paneRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {}
    }, 90);
  };

  // MADDE 6: secili gun + saat icin not yaz / guncelle.
  const setHourText = (dayKey: string, hour: string, text: string) => {
    setHours((prev) => {
      const day = { ...(prev[dayKey] || {}) };
      if (text.trim()) day[hour] = text;
      else delete day[hour];
      return { ...prev, [dayKey]: day };
    });
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    // v-savefix2: SESSIZ BASARISIZLIK YOK. Baslik bossa kayit olusmuyordu ve buton
    // hicbir sey yapmiyormus gibi gorunuyordu. Artik GORUNUR uyari cikar.
    if (!newTitle.trim()) {
      showSaveNotice(t("agenda.need_title"));
      return;
    }

    // Seçilen tarih ve saate göre tam timestamp oluştur
    const [hours, minutes] = (newTime || "12:00").split(":").map(Number);
    const targetTimestamp = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hours || 12,
      minutes || 0,
      0
    ).getTime();

    playSuccessSound();

    // Düzenleme modunda: mevcut kaydı yerinde güncelle (yeni kayıt oluşturma).
    if (editingEventId) {
      setEvents((prev) =>
        prev
          .map((ev) =>
            ev.id === editingEventId
              ? {
                  ...ev,
                  dateKey: selectedDateKey,
                  timeStr: newTime || "12:00",
                  title: newTitle.trim(),
                  description: newDescription.trim() || undefined,
                  category: newCategory,
                  hasAlarm: enableAlarm,
                  alarmTimestamp: enableAlarm ? targetTimestamp : null,
                  isAlarmTriggered: false,
                }
              : ev,
          )
          .sort((a, b) => a.timeStr.localeCompare(b.timeStr)),
      );
      setEditingEventId(null);
      setNewTitle("");
      setNewDescription("");
      showSaveNotice(t("agenda.saved"));
      scrollToNewRecord();
      return;
    }

    const newEv: AgendaEvent = {
      id: "ev-" + Date.now(),
      dateKey: selectedDateKey,
      timeStr: newTime || "12:00",
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      category: newCategory,
      hasAlarm: enableAlarm,
      alarmTimestamp: enableAlarm ? targetTimestamp : null,
      isAlarmTriggered: false,
      isDone: false,
      createdAt: Date.now(),
    };

    setEvents((prev) => [...prev, newEv].sort((a, b) => a.timeStr.localeCompare(b.timeStr)));
    setNewTitle("");
    setNewDescription("");
    showSaveNotice(t("agenda.saved"));
    scrollToNewRecord();
  };

  // Tek tıkla alarmı aç/kapat
  const handleToggleAlarm = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playPopSound();
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === id) {
          const nextAlarm = !ev.hasAlarm;
          if (nextAlarm) requestNotificationPermission();
          const [hours, minutes] = ev.timeStr.split(":").map(Number);
          const [y, m, d] = ev.dateKey.split("-").map(Number);
          const ts = new Date(y, m - 1, d, hours, minutes).getTime();
          return {
            ...ev,
            hasAlarm: nextAlarm,
            alarmTimestamp: nextAlarm ? ts : null,
            isAlarmTriggered: false,
          };
        }
        return ev;
      })
    );
  };

  // Kaydı forma yükle ve düzenleme moduna geç.
  const handleEditEvent = (id: string) => {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    playPopSound();
    setEditingEventId(ev.id);
    setNewTime(ev.timeStr);
    setNewTitle(ev.title);
    setNewDescription(ev.description || "");
    setNewCategory(ev.category);
    setEnableAlarm(Boolean(ev.hasAlarm));
  };

  // Düzenlemeyi iptal et: formu temizle ve yeni kayıt moduna dön.
  const cancelEdit = () => {
    playPopSound();
    setEditingEventId(null);
    setNewTitle("");
    setNewDescription("");
    setEnableAlarm(true);
  };

  const handleDeleteEvent = (id: string) => {
    playPopSound();
    // MADDE 2: silinen kaydi sakla, 5 sn "geri al" bildirimi goster.
    const removed = events.find((ev) => ev.id === id);
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
    if (removed) {
      setUndoToast({
        id: Date.now(),
        message: "Silindi · Geri al",
        onUndo: () => {
          setEvents((prev) =>
            prev.some((ev) => ev.id === removed.id) ? prev : [...prev, removed]
          );
        },
      });
    }
    // Silinen kayıt düzenleniyorsa formu yeni kayıt moduna döndür.
    if (editingEventId === id) {
      setEditingEventId(null);
      setNewTitle("");
      setNewDescription("");
    }
  };

  const handleDismissRinging = (id: string) => {
    playPopSound();
    stopAlarmBackgroundAlert();
    setRingingEvent(null);
    setEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, hasAlarm: false } : ev))
    );
  };

  // v-alarmpopover: karti kapat ama alarmi SILME (kayit durur, tekrar calabilir).
  const handleCloseRingingCard = () => {
    playPopSound();
    stopAlarmBackgroundAlert();
    setRingingEvent(null);
  };

  const handleSnoozeRinging = (id: string, minutes: number = 15) => {
    playPopSound();
    stopAlarmBackgroundAlert();
    setRingingEvent(null);
    const nextTime = Date.now() + minutes * 60 * 1000;
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === id ? { ...ev, alarmTimestamp: nextTime, isAlarmTriggered: false } : ev
      )
    );
  };
  const dayEvents = events.filter((e) => e.dateKey === selectedDateKey);
  // Secili gun disindaki kayitlar: hicbir kayit 'kaybolmus' gibi gorunmesin diye ozet liste
  const otherDayEvents = events
    .filter((e) => e.dateKey !== selectedDateKey)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.timeStr.localeCompare(b.timeStr));
  // dateKey -> o gune ait kayit sayisi (takvim hucrelerindeki nokta isaretleri icin)
  const eventCountByDate = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.dateKey] = (acc[e.dateKey] || 0) + 1;
    return acc;
  }, {});

  const monthNames = [
            t("month.1"), t("month.2"), t("month.3"), t("month.4"), t("month.5"), t("month.6"),
            t("month.7"), t("month.8"), t("month.9"), t("month.10"), t("month.11"), t("month.12")
  ];
  const currentMonthLabel = `${monthNames[month]} ${year}`;

  const selectedDateLabel = selectedDate.toLocaleDateString(langToLocale(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    // MADDE 1: overflow-hidden -> overflow-clip. Bu bilesenin KENDI kaydirilabilir
    // panelleri var (sol takvim, sag gunluk). overflow-hidden ustteki <main>'in
    // kaydirmasini da blokluyordu; overflow-clip disari tasmayi engeller ama
    // sayfa kaydirmasini serbest birakir.
    <div
      data-lovable-target="calendar-agenda-view"
      data-lovable-name='Sayfa: "Takvim ve Ajanda"'
      data-lovable-file="src/components/CalendarAgendaView.tsx"
      className="mx-auto flex h-full w-full max-w-[1200px] flex-col lg:grid lg:grid-cols-2 lg:flex-row overflow-clip bg-[var(--app-bg)] text-[var(--ink)] select-none"
    >
      {/* ⭐ v-savefix2: KAYIT ONAYI — PANELIN DISINDA, EKRANIN SAG USTUNE SABIT.
          Panel nereye kaydirilmis olursa olsun HER ZAMAN gorunur.
          (Onceki deneme panelin icindeydi -> kaydirma konumuna gore ekranin
          altinda kaliyordu ve kullanici "kaydetmedi" saniyordu.) */}
      <AnimatePresence>
        {saveNotice && (
          <motion.div
            key={saveNotice}
            initial={isReducedMotion ? false : { opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
            role="status"
            aria-live="polite"
            data-agenda-saved="1"
            className="fixed end-4 top-4 z-[60] flex max-w-[92vw] items-center gap-2.5 rounded-[12px] border-2 border-[var(--accent)] bg-[var(--paper)] px-4 py-2.5 shadow-superrCard"
          >
            <CheckCircle2 size={18} className="flex-shrink-0 text-[var(--color-success)]" />
            <span className="min-w-0">
              <span className="block font-handwritten text-[16px] font-bold leading-tight text-[var(--ink)]">
                {saveNotice}
              </span>
              <span className="block truncate font-geist text-[10px] text-[var(--ink-soft)]">
                {selectedDateLabel} · {newTime || "12:00"}
              </span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Sol Panel: İnteraktif Aylık Takvim */}
      <div className="w-full lg:w-[380px] p-4 sm:p-8 border-b-2 lg:border-b-0 lg:border-r-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] flex flex-col justify-between overflow-y-auto flex-shrink-0">
        <div>
          <div className="flex items-center justify-between pb-4 border-b-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]">
            <div>
              <span className="font-handwritten text-[var(--accent)] text-xs font-bold block">
                {t("agenda.tab.timeline")}
              </span>
              <h3 className="font-gelica text-[26px] font-semibold lowercase text-[var(--ink)]">
                {currentMonthLabel}
              </h3>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                aria-label={t("a11y.prev_month")}
                className="flex h-8 w-8 items-center justify-center rounded-[20px] border border-[var(--line-strong)] bg-[var(--app-bg)] hover:bg-[var(--paper)] transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={handleNextMonth}
                aria-label={t("a11y.next_month")}
                className="flex h-8 w-8 items-center justify-center rounded-[20px] border border-[var(--line-strong)] bg-[var(--app-bg)] hover:bg-[var(--paper)] transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Gün Başlıkları — v-agendapolish: hücre genişliği ızgarayla BİREBİR aynı.
              Önceden başlık satırı `pt-4 pb-2`, ızgara ise farklı dikey ritimdeydi;
              bu yüzden "Pzt" ile altındaki "1" rakamı hizasız görünüyordu. */}
          <div className="grid grid-cols-7 gap-1 text-center pt-4 pb-1.5">
            {["time.mon_short", "time.tue_short", "time.wed_short", "time.thu_short", "time.fri_short", "time.sat_short", "time.sun_short"].map((k) => (
              <span key={k} className="flex h-4 items-center justify-center font-geist text-[10px] font-semibold uppercase leading-none tracking-[0.06em] text-[var(--ink-soft)]">
                {t(k)}
              </span>
            ))}
          </div>

          {/* Günler Izgarası */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: adjustedFirstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-10" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dKey = `${year}-${pad(month + 1)}-${pad(day)}`;
              const isSelected = selectedDateKey === dKey;
              const hasEvents = events.some((e) => e.dateKey === dKey);
              // Bugün kontrolü TEK kaynaktan: hem halka hem nokta bunu kullanır.
              const isToday =
                new Date().getDate() === day &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

              return (
                <button
                  key={`day-${day}`}
                  onClick={() => handleSelectDay(day)}
                  className={`relative flex flex-col items-center justify-center h-10 rounded-[10px] font-geist text-[13px] font-semibold tabular-nums transition-colors ${
                    isSelected
                      ? "text-[var(--app-bg)]"
                      : isToday
                        ? "text-[var(--accent)]"
                        : "text-[var(--ink)] hover:bg-[var(--app-bg)]"
                  }`}
                >
                  {/* Seçili gün göstergesi: eski günden yeni güne KAYARAK gider (layoutId) */}
                  {isSelected && (
                    <motion.span
                      layoutId="calendar-selected-day"
                      transition={{ type: "spring", stiffness: 520, damping: 38 }}
                      className="absolute inset-0 rounded-[10px] border-[1.5px] border-[var(--accent)] bg-[var(--accent)] shadow-sm"
                      style={{ zIndex: 0 }}
                    />
                  )}
                  {/* Bugün: çok hafif, göze batmayan nabız halkası (2sn döngü) */}
                  {isToday && !isSelected && !isReducedMotion && (
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-[10px] border-[1.5px] border-[var(--accent)]"
                      animate={{ opacity: [0.25, 0.6, 0.25], scale: [1, 1.06, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      style={{ zIndex: 0 }}
                    />
                  )}
                  <span className="relative" style={{ zIndex: 1 }}>{day}</span>
                  {/* Bugün göstergesi: SADECE tek turuncu, nefes alan nokta.
                      Aynı isToday kaynağını kullanır; yeşil/ikinci nokta kaldırıldı. */}
                  <div className="relative flex h-1.5 items-center justify-center" style={{ zIndex: 1 }}>
                    {isToday && (
                      <span
                        aria-hidden="true"
                        title={t("time.today_title")}
                        className={`h-1.5 w-1.5 rounded-full calendar-today-dot ${
                          isSelected ? "bg-[var(--app-bg)]" : "bg-[var(--accent)]"
                        }`}
                      />
                    )}
                    {!isToday && hasEvents && !isSelected && (
                      <span className="h-1 w-1 rounded-full bg-[var(--ink)] opacity-55" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Sağ Panel: Seçilen Günün Saatlik Ajandası & Alarm Kurma Formu */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-8 bg-[var(--app-bg)] scrollbar-thin" ref={paneRef}>
        {/* v-panelline: alt çizgi SOL PANEL (takvim) çizgisiyle AYNI HİZADA.
            Ölçüm (önce): sol çizgi y=107, bu çizgi y=115 -> 8px fark.
            Sebep: sağ başlık `30/36px`, sol başlık `26px` -> daha uzun blok.
            `pb-4` (16px) -> `pb-2` (8px): çizgi tam 8px yukarı gelir. */}
        <div className="border-b-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] pb-2">
          <span className="font-handwritten text-[var(--accent)] text-xs font-bold block pb-0.5">
            {t("cal.daily_agenda")}
          </span>
          <h1 className="font-gelica text-[30px] sm:text-[36px] font-semibold lowercase text-[var(--ink)] leading-tight">
            {selectedDateLabel}.
          </h1>
        </div>

        {/* ⭐ ALARM KURMA & SAATLİ NOT FORMU — v-agendapolish: form alanları TEK font diline getirildi.
            Önce: saat/başlık/kategori `font-gelica` (serif, 12px), not alanı `font-handwritten`
            (el yazısı, 19px/28px) -> aynı formda iki ayrı dünya, "font bütünlüğü yok".
            Sonra: tüm giriş alanları `font-geist` (Inter, sayfa fontu); not alanı 13px/24px
            ve defter çizgisi ritmi buna göre (24px) yeniden ayarlandı. */}
        <form role="dialog" aria-modal="true" onSubmit={handleAddEvent} className="mt-6 flex flex-col gap-3 rounded-[12px] border-[1.5px] border-[color-mix(in_srgb,var(--ink)_55%,transparent)] bg-[var(--paper)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Clock size={17} className="text-[var(--accent)] flex-shrink-0" />
              <input
                type="time"
                aria-label={t("a11y.time")}
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="rounded-[20px] border-[1.5px] border-[color-mix(in_srgb,var(--ink)_45%,transparent)] bg-[var(--app-bg)] px-3 py-1 font-geist text-[12px] font-semibold tabular-nums leading-none text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => {
                  playPopSound();
                  setEnableAlarm((prev) => {
                    const next = !prev;
                    if (next) requestNotificationPermission();
                    return next;
                  });
                }}
                title={enableAlarm ? t("agenda.alarm_on") : t("agenda.alarm_off")}
                className={`p-1.5 rounded-full border border-[var(--line-strong)] transition-all ${
                  enableAlarm
                    ? "bg-[var(--accent)] text-[var(--app-bg)] shadow-xs"
                    : "bg-[var(--app-bg)] text-[var(--ink-soft)] hover:border-[var(--accent)]"
                }`}
              >
                <SketchyAlarmBell size={16} ringing={enableAlarm} />
              </button>
            </div>

            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t("agenda.ph_time")}
              className="min-w-[220px] flex-1 rounded-[20px] border-[1.5px] border-[color-mix(in_srgb,var(--ink)_45%,transparent)] bg-[var(--app-bg)] px-4 py-1.5 font-handwritten text-[15px] font-semibold leading-[19px] text-[var(--ink)] outline-none transition-colors placeholder:font-geist placeholder:text-[11.5px] placeholder:font-medium placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)]"
            />

            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as any)}
              className="rounded-[20px] border-[1.5px] border-[color-mix(in_srgb,var(--ink)_45%,transparent)] bg-[var(--app-bg)] px-3 py-1.5 font-geist text-[12.5px] font-medium leading-none text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              {/* v-cats: kategori listesi SADELESTIRILDI.
                  Kaldirilanlar: "iş & ihale" (work), "kelime & çalışma" (study).
                  Kalanlar: toplantı, randevu (YENI), kişisel. */}
              <option value="meeting">{t("agenda.cat.meeting")}</option>
              <option value="appointment">{t("agenda.cat.appointment")}</option>
              <option value="personal">{t("agenda.cat.personal")}</option>
            </select>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]">
            {/* Ajanda Detay Notu: El Yazısı & Defter Çizgisi */}
            <div className="w-full">
              <div className="flex overflow-hidden rounded-[12px] border-[1.5px] border-[color-mix(in_srgb,var(--ink)_45%,transparent)] bg-[var(--app-bg)] transition-colors focus-within:border-[var(--accent)]">
                <textarea
                  rows={7}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "a" || e.code === "KeyA")) {
                      e.stopPropagation();
                      e.currentTarget.select();
                    }
                  }}
                  placeholder={t("agenda.ph_body")}
                  className="notebook-ruled-lines min-h-[168px] flex-1 resize-y select-text bg-transparent px-3.5 pb-2 pt-0 font-handwritten text-[17px] leading-[24px] text-[var(--ink)] outline-none placeholder:font-geist placeholder:text-[12px] placeholder:font-medium placeholder:text-[var(--ink-soft)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              {editingEventId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="btn-pill-outline text-xs !py-1.5 !px-4"
                >
                  <span className="font-handwritten text-[16px]">{t("act.cancel")}</span>
                </button>
              )}
              <button type="submit" className="btn-pill-orange text-xs !py-1.5 !px-5 shadow-[var(--shadow-soft)]">
                <Plus size={16} />
                <span className="font-handwritten text-[18px] font-bold">
                  {editingEventId ? t("agenda.update") : t("agenda.add")}
                </span>
              </button>
            </div>
          </div>
        </form>

        {/* v-panelmove: GÜNLÜK ÇAPRAZ BAĞLANTISI BURAYA TAŞINDI (formun hemen altına).
            ÖNCE: bu panel listenin EN ALTINDAYDI; sağ sütun (form 45 + not alanı 196 +
            kayıtlar) ekrandan uzun olduğu için panel ekranın DIŞINA itiliyordu —
            canlı ölçüm: panel `mid = 723.4`, pencere 720px -> yarısı kesiliyordu.
            Kullanıcı "panele tam sığmıyor, yazı kayık" diyordu. Artık form ile
            kayıt listesi ARASINDA; her ekranda görünür. */}
        {onOpenJournal && (() => {
          const dk = toDateKey(selectedDate);
          const hasJournal = journalDates.has(dk);
          // v-journalfinal: KART DILI BIRLESTIRILDI + KALAM METRIGI KIRPILDI.
          // OLCUM (once): shadow YOK (form ve kayit kartlari golgeli -> tutarsiz);
          //   baslik Kalam 13.5px / line 20.25px (mid 570.1)
          //   alt satir Inter 11px / line 15px (mid 587.8) -> 17.7px merkez farki.
          // KOK NEDEN: Kalam el yazisi fontunun ascent/descent metrigi buyuk;
          //   `line-height: 15px` yazilsa bile tarayici 20.25px (1.5x) uyguluyor.
          //   line-height ile savasmak yerine fazla DIKEY ALANI negatif marjla kirptik.
          const cls = hasJournal
            ? "mt-3 flex w-full items-center justify-between gap-3 rounded-[12px] border-[1.5px] px-3.5 py-2 text-start shadow-[var(--shadow-soft)] transition border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--paper))] hover:brightness-[0.98]"
            : "mt-3 flex w-full items-center justify-between gap-3 rounded-[12px] border-[1.5px] border-[color-mix(in_srgb,var(--ink)_55%,transparent)] bg-[var(--paper)] px-3.5 py-2 text-start shadow-[var(--shadow-soft)] transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]";
          return (
            <button
              type="button"
              data-open-journal="1"
              data-has-journal={hasJournal ? "1" : "0"}
              onClick={() => { playPopSound(); onOpenJournal(dk); }}
              className={cls}
            >
              {/* v-journalpanel: SATIR RITMI SIKILASTIRILDI.
                  Kalam (el yazısı) fontu 14px'te DOGAL olarak 21px satır yüksekliği
                  dayatıyor; `leading-[1.1]` (=15.4px) bunu ezemedi, ölçülen satır
                  yüksekliği hâlâ 21px kaldı -> iki satırın merkez farkı 19.9px.
                  Çözüm: `leading-[15px]` (PX cinsinden sabit değer) -> font metriğini
                  kesin olarak ezer. Başlık 13.5px ile iki satır toplam ~30px'te kalır. */}
              <span className="flex min-w-0 flex-col justify-center gap-0">
                <span className="block truncate font-handwritten text-[13px] font-bold leading-[1] -mb-[4px] text-[var(--ink)]">
                  {hasJournal ? t("link.agenda_has_journal") : t("link.agenda_no_journal")}
                </span>
                <span className="block truncate font-geist text-[11px] leading-[15px] text-[var(--ink-soft)]">
                  {hasJournal ? t("link.agenda_has_journal_desc") : t("link.agenda_no_journal_desc")}
                </span>
              </span>
              <span className="shrink-0 font-geist text-[10px] font-bold uppercase tracking-[0.06em] leading-none text-[var(--accent)]">
                {dk}
              </span>
            </button>
          );
        })()}

        {/* Günün Saatlik Çizelgesi Listesi */}
        {/* Bu günün kayıtları: seçili güne ait TÜM notlar saat sırasına göre.
            Bu gün kayıtlarına ek olarak ileri/geri tarihlerdeki ayrı bölüm.
            Gün değiştiğinde içerik fade+slide ile yenilenir (madde 4). */}
        <motion.div
          key={"day-content-" + selectedDateKey}
          initial={isReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
        >
        <div ref={listRef} className="mt-7 mb-2.5 flex items-center justify-between gap-3 border-b-2 border-[color-mix(in_srgb,var(--border-ink)_25%,transparent)] pb-2 scroll-mt-4">
          <span className="font-handwritten text-[15px] font-bold leading-none text-[var(--accent)]">
            {t("cal.day_records").replace("{n}", String(dayEvents.length))}
          </span>
          {/* MADDE 7: X / Y tamamlandi sayaci — ekleme/silme/tamamlamada ANINDA guncellenir
              (dayEvents state'inden turetilir, ayri bir sayac tutulmaz). */}
          <span className="font-geist text-[10px] uppercase leading-none tracking-[0.08em] text-[var(--ink-soft)]" data-done-counter="1">
            {t("cal.done_counter")
              .replace("{done}", String(dayEvents.filter((e) => e.isDone).length))
              .replace("{total}", String(dayEvents.length))}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2.5 scrollbar-thin pe-3">
          {dayEvents.length > 0 ? (
            // MADDE 7: TAMAMLANAN kayitlar LISTENIN ALTINA tasinir (saat sirasi kendi icinde korunur).
            [...dayEvents].sort((a, b) => Number(a.isDone) - Number(b.isDone)).map((ev) => (
              <div
                key={ev.id}
                className={`group flex items-center gap-3 rounded-[12px] border-[1.5px] p-3.5 transition-all ${
                  ev.isDone
                    ? "border-[color-mix(in_srgb,var(--ink)_35%,transparent)] bg-[var(--paper)] opacity-70"
                    : "border-[color-mix(in_srgb,var(--ink)_55%,transparent)] bg-[var(--paper)] shadow-[var(--shadow-soft)] hover:border-[var(--accent)] hover:shadow-[var(--shadow-soft)]"
                }`}
              >
                <div
                  onClick={() => {
                    playSuccessSound();
                    setEvents((prev) =>
                      prev.map((item) => (item.id === ev.id ? { ...item, isDone: !item.isDone } : item))
                    );
                  }}
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer select-none"
                >
                  <button type="button" aria-label={t("a11y.toggle_done")} aria-pressed={ev.isDone} className="flex h-5 w-5 shrink-0 items-center justify-center text-[#22c55e]">
                    <motion.span
                      key={ev.isDone ? "done" : "undone"}
                      initial={false}
                      animate={
                        ev.isDone
                          ? { scale: [0.8, 1.16, 1], opacity: 1 }
                          : { scale: [1.1, 0.95, 1], opacity: 1 }
                      }
                      transition={{ duration: ev.isDone ? 0.22 : 0.14, ease: "easeOut" }}
                      className="flex items-center justify-center"
                    >
                      {ev.isDone ? (
                        // Kalemle çizilmiş tik: stroke-dashoffset ile "elle işaretleniyor" efekti
                        <AnimatedCheck checked size={18} className="text-[#22c55e]" />
                      ) : (
                        <Circle size={18} className="text-[var(--ink-soft)] hover:text-[var(--accent)]" />
                      )}
                    </motion.span>
                  </button>

                  {/* Saat rozeti: sabit genislik + ortalanmis → basliklar HER KARTTA ayni X'te baslar */}
                  <span className="flex w-[62px] shrink-0 items-center justify-center rounded-[20px] border border-[var(--line)] bg-[var(--paper)] px-2 py-[3px] font-mono text-[11px] font-bold leading-none tabular-nums text-[var(--ink)]">
                    {ev.timeStr}
                  </span>

                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      className={`relative inline-block truncate font-gelica text-[16px] font-semibold leading-[1.35] ${
                        ev.isDone ? "text-[var(--ink-soft)]" : "text-[var(--ink)]"
                      }`}
                    >
                      {ev.title}
                      {/* Üstü çizili: soldan sağa çizilerek gelir, anlık görünmez */}
                      <AnimatedStrike active={ev.isDone} />
                    </span>
                    {ev.description && (
                      <span className="mt-0.5 line-clamp-1 font-geist text-[11.5px] leading-[1.5] text-[var(--ink-soft)] whitespace-pre-line">
                        {ev.description}
                      </span>
                    )}
                  </div>
                </div>

                {/* Aksiyonlar: her zaman sag tarafta, esit aralik, sabit genislik */}
                <div className="flex w-[72px] shrink-0 items-center justify-end gap-0.5">
                  {ev.hasAlarm && (
                    <button
                      onClick={(e) => handleToggleAlarm(ev.id, e)}
                      title={t("agenda.alarm_edit_on")}
                      className="rounded-full p-1.5 text-[var(--accent)] transition-opacity hover:opacity-75"
                    >
                      <SketchyAlarmBell size={16} ringing={!ev.isDone} />
                    </button>
                  )}

                  <button
                    title={t("act.edit")}
                    aria-label={t("agenda.edit_title")}
                    onClick={() => handleEditEvent(ev.id)}
                    className="rounded-lg p-1.5 text-[var(--ink-soft)] transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-[var(--accent)]"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    onClick={() => handleDeleteEvent(ev.id)}
                    className="rounded-lg p-1.5 text-[var(--ink-soft)] transition-colors hover:bg-[color-mix(in_srgb,red_10%,transparent)] hover:text-red-600"
                    title={t("act.delete")}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16 text-[var(--ink-soft)]">
              <CalendarDays size={32} className="mx-auto mb-3 opacity-40 text-[var(--accent)]" />
              <p className="font-gelica text-lg lowercase">{t("agenda.empty")}</p>
              <p className="font-geist text-xs mt-1">{t("agenda.empty_hint")}</p>
            </div>
          )}
        </div>
        </motion.div>

        {/* ⭐ MADDE 6: SAATLIK ZAMAN CIZELGESI (06:00 - 23:00).
            Kapaktaki ajanda karti "saatlik zaman çizelgesi" vaat ediyordu ama
            ajanda sayfasinda yoktu. Her saate kisa not yazilir ve veriler
            GUN BAZINDA kaydedilir (superr_agenda_hours_v1). */}
        <div className="mt-6" data-hourly-timeline="1">
          <div className="mb-2 flex items-center gap-2">
            <Clock size={13} className="text-[var(--accent)]" />
            <span className="font-handwritten text-[15px] font-bold leading-none text-[var(--accent)]">
              {t("cal.hourly")}
            </span>
            <span className="font-geist text-[10px] uppercase leading-none tracking-[0.08em] text-[var(--ink-soft)]">
              {t("cal.hourly_range")}
            </span>
          </div>

          <div className="overflow-hidden rounded-[12px] border-[1.5px] border-[color-mix(in_srgb,var(--ink)_55%,transparent)] bg-[var(--paper)] shadow-[var(--shadow-soft)]">
            {HOUR_SLOTS.map((hour, idx) => {
              const dayKey = toDateKey(selectedDate);
              const val = hours[dayKey]?.[hour] ?? "";
              return (
                <div
                  key={hour}
                  className={`flex items-center gap-3 px-3 py-1.5 ${idx > 0 ? "border-t border-[color-mix(in_srgb,var(--ink)_12%,transparent)]" : ""}`}
                >
                  <span className="w-[46px] shrink-0 font-mono text-[11px] font-bold tabular-nums leading-none text-[var(--ink-soft)]">
                    {hour}
                  </span>
                  <input
                    type="text"
                    value={val}
                    data-hour-slot={hour}
                    aria-label={hour}
                    onChange={(e) => setHourText(dayKey, hour, e.target.value)}
                    placeholder={t("cal.hourly_ph")}
                    className="min-w-0 flex-1 bg-transparent font-geist text-[12.5px] leading-[18px] text-[var(--ink)] outline-none placeholder:text-[color-mix(in_srgb,var(--ink)_35%,transparent)]"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Diğer günlerdeki kayıtlar: seçili gün dışındaki tüm notlar burada listelenir */}
        {otherDayEvents.length > 0 && (
          <div className="mt-6 pt-4 border-t-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]">
            <span className="font-handwritten text-[var(--accent)] text-sm font-bold block mb-3">
              {t("agenda.tab.other")} <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 font-mono text-[10px] text-[var(--app-bg)]">{otherDayEvents.length}</span>
            </span>
            <div className="space-y-2">
              {otherDayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="group flex items-center justify-between gap-3 p-3 rounded-[10px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--paper)]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      const [y, m, d] = ev.dateKey.split("-").map(Number);
                      setSelectedDate(new Date(y, m - 1, d));
                      setCurrentMonth(new Date(y, m - 1, 1));
                    }}
                    title={t("agenda.go")}
                    className="flex items-center gap-3 flex-1 min-w-0 text-start cursor-pointer"
                  >
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-[20px] border border-[var(--line)] bg-[var(--app-bg)] text-[var(--ink)] flex-shrink-0">
                      {ev.dateKey.slice(5)} · {ev.timeStr}
                    </span>
                    <span
                      className={`font-gelica text-sm font-semibold truncate ${
                        ev.isDone ? "line-through text-[var(--ink-soft)]" : "text-[var(--ink)]"
                      }`}
                    >
                      {ev.title}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEvent(ev.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--ink-soft)] hover:text-red-600 transition-opacity flex-shrink-0"
                    title={t("common.delete")}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ⭐ v-alarmpopover (SECENEK 2): ALARM KARTI — TAM EKRAN MODAL DEGIL.
          Eski hali `fixed inset-0 bg-black/40 backdrop-blur` ile TUM EKRANI kapatyordu;
          kayit eklenirken acildigi icin "ajandaya ekle" tiklanamaz hale geliyordu.
          Yeni hali: sag altta KUCUK, KAPATILABILIR kart. Sayfayi kilitlemez.
          "alarmı test et" butonuyla tam ekran alarm YINE acilabilir. */}
      <AnimatePresence>
        {ringingEvent && (
          <motion.div
            initial={isReducedMotion ? false : { opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.24, ease: [0.34, 1.56, 0.64, 1] }}
            role="alert"
            aria-live="assertive"
            data-alarm-card="1"
            className="fixed bottom-24 end-6 z-[55] w-[min(340px,92vw)] overflow-hidden rounded-[14px] border-2 border-[var(--accent)] bg-[var(--app-bg)] p-4 shadow-superrCard lg:bottom-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[20px] bg-[var(--accent)] text-white">
                <Bell size={17} className="animate-bounce" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block font-handwritten text-[14px] font-bold text-[var(--accent)]">
                  {t("cal.alarm_card_title")}
                </span>
                <span className="mt-0.5 block truncate font-gelica text-[16px] font-semibold text-[var(--ink)]">
                  {ringingEvent.title}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] font-bold text-[var(--ink-soft)]">
                  {ringingEvent.timeStr}
                  {ringingEvent.description ? ` · ${ringingEvent.description}` : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCloseRingingCard}
                aria-label={t("common.ok_close")}
                className="shrink-0 rounded-full p-1 text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSnoozeRinging(ringingEvent.id, 15)}
                className="btn-pill-superr text-xs !py-1 !px-3"
              >
                <Clock size={12} />
                <span>{t("cal.alarm_snooze")}</span>
              </button>
              <button
                type="button"
                onClick={() => handleDismissRinging(ringingEvent.id)}
                className="btn-pill-outline text-xs !py-1 !px-3"
              >
                <Check size={12} strokeWidth={2.5} />
                <span>{t("cal.alarm_done")}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <UndoToast toast={undoToast} onDone={() => setUndoToast(null)} />
    </div>
  );
}
