import { useState, useEffect, useRef } from "react";

import { UndoToast, type UndoToastData } from "./UndoToast";

import { useT } from "../i18n/I18nProvider";

import { motion, AnimatePresence } from "framer-motion";

import { DArrowRight as ArrowRight, DBriefcase as Briefcase, DCheck as Check, DCheckCircle as CheckCircle2, DEdit, DFeltAction, DFeltIdea, DFeltNetwork, DFeltPersonal, DGlobe as Globe, DLighbulb as Lightbulb, DMail as Mail, DPhone as Phone, DPin as Pin, DPlus as Plus, DSearch as Search, DSparkles as Sparkles, DTag as MapPin, DTopicAction, DTopicCoffee, DTopicLife, DTrash as Trash2, DUser as User, DUsers as Users, DX as X } from "./icons/doodle";

import { playPopSound, playSuccessSound, playPinSound } from "../lib/sound";

import { getCardRotationStyle } from "../lib/paperStyles";

import { SketchEmptyIdeas, SketchEmptyNotes, SketchEmptyTasks } from "./icons/EmptyStateIllustrations";

// 1. Network Kişi Kartı Arayüzü (Kullanıcının İstediği Tablo Sütunları)

interface NetworkContact {

  id: string;

  name: string;

  profession: string;

  address: string;

  phone: string;

  email: string;

  website: string;

  note: string;

  createdAt: number;

}

// 2. İş Notu Arayüzü (Fikirler, Aksiyonlar, Kişisel)

interface WorkItem {

  id: string;

  section: "ideas" | "actions" | "personal";

  title: string;

  content: string;

  status?: "pending" | "progress" | "done"; // Aksiyonlar için

  isPinned?: boolean;

  createdAt: number;

}

const STORAGE_KEY_WORK_ITEMS = "superr_work_section_items_v2";

const STORAGE_KEY_NETWORK = "superr_work_network_contacts_v2";

export function WorkProjectsView() {

  const { t, lang } = useT();

  // 4 Ana Başlık Sekmesi: 1 fikirler, 2 aksiyonlar, 3 network, 4 kişisel

  const [activeTab, setActiveTab] = useState<"ideas" | "actions" | "network" | "personal">("ideas");

  const [search, setSearch] = useState("");

  // 1, 2, 4. Başlıkların Not Verileri

  const [items, setItems] = useState<WorkItem[]>(() => {

    try {

      const raw = localStorage.getItem(STORAGE_KEY_WORK_ITEMS);

      // Eski seed demo kayitlarini ayikla; kullanicinin kendi kayitlari KORUNUR.

      const LEGACY_DEMO_IDS = new Set(["i-1", "a-1", "a-2", "p-1"]);

      if (!raw) return [];

      const parsed = (JSON.parse(raw) as WorkItem[]).filter((it) => it && !LEGACY_DEMO_IDS.has(String(it.id)) && it.title !== "fhsfgjsfgjsjg" && it.title !== "hzfdzhzdgfhzdgh");

      // Temizlenmis listeyi kalici hale getir (bir daha gelmesin).

      localStorage.setItem(STORAGE_KEY_WORK_ITEMS, JSON.stringify(parsed));

      return parsed;

    } catch {}

    return [];

  });

  // 3. Network Tablosu Verileri (Sırayla 1, 2, 3, 4, 5...)

  // MADDE 2: silme geri alma bildirimi (5 sn).
  const [undoToast, setUndoToast] = useState<UndoToastData | null>(null);
  const [contacts, setContacts] = useState<NetworkContact[]>(() => {

    try {

      const raw = localStorage.getItem(STORAGE_KEY_NETWORK);

      // Eski seed demo kayitlarini ayikla; kullanicinin kendi kayitlari KORUNUR.

      const LEGACY_DEMO_CONTACTS = new Set(["c-1", "c-2"]);

      if (!raw) return [];

      const parsed = (JSON.parse(raw) as NetworkContact[]).filter((c) => c && !LEGACY_DEMO_CONTACTS.has(String(c.id)));

      // Temizlenmis listeyi kalici hale getir (bir daha gelmesin).

      localStorage.setItem(STORAGE_KEY_NETWORK, JSON.stringify(parsed));

      return parsed;

    } catch {}

    return [];

  });



  // Not Ekleme State'leri (Fikirler, Aksiyonlar, Kişisel için)

  const [isAddingItem, setIsAddingItem] = useState(false);

  const [itemTitle, setItemTitle] = useState("");

  const [itemContent, setItemContent] = useState("");

  // Network Kişi Ekleme State'i (Tablo için)

  const [isAddingContact, setIsAddingContact] = useState(false);

  const [contactName, setContactName] = useState("");

  const [contactProf, setContactProf] = useState("");

  const [contactAddr, setContactAddr] = useState("");

  const [contactPhone, setContactPhone] = useState("");

  const [contactEmail, setContactEmail] = useState("");

  const [contactWeb, setContactWeb] = useState("");

  const [contactNote, setContactNote] = useState("");

  // ⭐ İŞ NOTLARI INLINE DÜZENLEME DURUMU

  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState("");

  const [editContent, setEditContent] = useState("");

  // ⭐ NETWORK TABLOSU YATAY KAYDIRMA DEDEKTÖRÜ

  const tableScrollRef = useRef<HTMLDivElement>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);

  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkTableScroll = () => {

    const el = tableScrollRef.current;

    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 6);

    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 6);

  };

  useEffect(() => {

    const timer = setTimeout(checkTableScroll, 60);

    window.addEventListener("resize", checkTableScroll);

    return () => {

      clearTimeout(timer);

      window.removeEventListener("resize", checkTableScroll);

    };

  }, [activeTab, contacts.length]);

  useEffect(() => {

    try {

      const userItems = items.filter((it) => it.id !== "i-1" && it.id !== "a-1" && it.id !== "a-2" && it.id !== "p-1");
    if (userItems.length) localStorage.setItem(STORAGE_KEY_WORK_ITEMS, JSON.stringify(userItems)); else localStorage.removeItem(STORAGE_KEY_WORK_ITEMS);

    } catch {}

  }, [items]);

  useEffect(() => {

    try {

      localStorage.setItem(STORAGE_KEY_NETWORK, JSON.stringify(contacts));

    } catch {}

  }, [contacts]);

  // Yeni Not Ekle (Fikirler / Aksiyonlar / Kişisel)

  const handleSaveItem = (e: React.FormEvent) => {

    e.preventDefault();

    if (!itemTitle.trim()) return;

    playSuccessSound();

    const newItem: WorkItem = {

      id: "work-" + Date.now(),

      section: activeTab === "network" ? "ideas" : activeTab,

      title: itemTitle.trim(),

      content: itemContent.trim(),

      status: activeTab === "actions" ? "pending" : undefined,

      isPinned: false,

      createdAt: Date.now(),

    };

    setItems((prev) => [newItem, ...prev]);

    setItemTitle("");

    setItemContent("");

    setIsAddingItem(false);

  };

  // Yeni Network Kişisi Ekle (Tabloya 1, 2, 3... sırayla eklenir)

  const handleSaveContact = (e: React.FormEvent) => {

    e.preventDefault();

    if (!contactName.trim()) return;

    playSuccessSound();

    const newContact: NetworkContact = {

      id: "contact-" + Date.now(),

      name: contactName.trim(),

      profession: contactProf.trim() || "-",

      address: contactAddr.trim() || "-",

      phone: contactPhone.trim() || "-",

      email: contactEmail.trim() || "-",

      website: contactWeb.trim() || "-",

      note: contactNote.trim() || "-",

      createdAt: Date.now(),

    };

    setContacts((prev) => [...prev, newContact]);

    setContactName("");

    setContactProf("");

    setContactAddr("");

    setContactPhone("");

    setContactEmail("");

    setContactWeb("");

    setContactNote("");

    setIsAddingContact(false);

  };

  // MADDE 2: silme GERI ALINABILIR — kayit + KONUM saklanir, toast'tan geri konur.
  const handleDeleteItem = (id: string) => {
    playPopSound();
    const index = items.findIndex((it) => it.id === id);
    const deleted = items[index];
    if (!deleted) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
    setUndoToast({
      id: Date.now(),
      message: "Silindi · Geri al",
      onUndo: () => {
        setItems((prev) => {
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, deleted);
          return next;
        });
      },
    });
  };

  // MADDE 2: network kisisi silme de GERI ALINABILIR.
  const handleDeleteContact = (id: string) => {
    playPopSound();
    const index = contacts.findIndex((c) => c.id === id);
    const deleted = contacts[index];
    if (!deleted) return;
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setUndoToast({
      id: Date.now(),
      message: "Silindi · Geri al",
      onUndo: () => {
        setContacts((prev) => {
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, deleted);
          return next;
        });
      },
    });
  };

  const handleTogglePin = (id: string) => {

    playPinSound();

    setItems((prev) =>

      prev.map((i) => (i.id === id ? { ...i, isPinned: !i.isPinned } : i))

    );

  };

  // ⭐ INLINE DÜZENLEME EYLEMLERİ

  const handleStartEdit = (item: WorkItem) => {

    playPopSound();

    setEditingItemId(item.id);

    setEditTitle(item.title);

    setEditContent(item.content);

  };

  const handleCancelEdit = () => {

    playPopSound();

    setEditingItemId(null);

    setEditTitle("");

    setEditContent("");

  };

  const handleSaveEdit = (e: React.FormEvent, id: string) => {

    e.preventDefault();

    if (!editTitle.trim()) return;

    playSuccessSound();

    setItems((prev) =>

      prev.map((i) =>

        i.id === id

          ? { ...i, title: editTitle.trim(), content: editContent.trim() }

          : i

      )

    );

    setEditingItemId(null);

    setEditTitle("");

    setEditContent("");

  };

  // Filtreler

  const currentSectionItems = items

    .filter((i) => i.section === activeTab)

    .filter((i) =>

      i.title.toLowerCase().includes(search.toLowerCase()) ||

      i.content.toLowerCase().includes(search.toLowerCase())

    );

  const filteredContacts = contacts.filter((c) =>

    c.name.toLowerCase().includes(search.toLowerCase()) ||

    c.profession.toLowerCase().includes(search.toLowerCase()) ||

    c.note.toLowerCase().includes(search.toLowerCase()) ||

    c.email.toLowerCase().includes(search.toLowerCase())

  );

  return (

    <div

      data-lovable-target="work-projects-view"

      data-lovable-name='Sayfa: "İş ve Projeler"'

      data-lovable-file="src/components/WorkProjectsView.tsx"

      className="paper-grain flex h-full w-full flex-col overflow-y-auto px-4 sm:px-8 py-4 sm:py-8 bg-[var(--app-bg)] text-[var(--ink)] select-none scrollbar-thin"

    >

      {/* 1. Üst Başlık & 4 Ana Başlık Sekmesi */}

      <div className="flex flex-col gap-4 border-b-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] pb-5">

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">

          <div>

            <span className="font-handwritten text-[var(--accent)] text-sm font-bold block">

              {t("wp.sub")}

            </span>

            <h2 className="font-gelica text-[32px] sm:text-[38px] font-semibold lowercase text-[var(--ink)] leading-tight">

              {t("wp.title")}

            </h2>

          </div>

          <div className="relative flex items-center max-w-xs w-full">

            <Search size={15} className="absolute start-3.5 text-[var(--ink)]" />

            <input

              type="text"

              value={search}

              onChange={(e) => setSearch(e.target.value)}

              placeholder={t("wp.search_ph")}

              className="w-full rounded-[20px] border border-[var(--line-strong)] bg-[var(--paper)] py-2 ps-9 pe-3 font-geist text-xs font-medium text-[var(--ink)] placeholder:text-[var(--ink-soft)] outline-none focus:border-[var(--accent)] shadow-[var(--shadow-soft)] transition-all"

            />

          </div>

        </div>

        {/* 4 ANA BAŞLIK SEKMELERİ (20px Pill Buttons) */}

        <div className="flex flex-wrap items-center gap-2 pt-1">

          <button

            onClick={() => {

              playPopSound();

              setActiveTab("ideas");

            }}

            className={`btn-pill-superr text-xs !py-1.5 !px-4 ${

              activeTab === "ideas" ? "!bg-[var(--ink)] !text-[var(--app-bg)]" : ""

            }`}

          >

            <DFeltIdea size={14} className={activeTab === "ideas" ? "text-[var(--accent)]" : "text-current"} />

            <span>{t("wp.tab.ideas")} ({items.filter(i => i.section === "ideas").length})</span>

          </button>

          <button

            onClick={() => {

              playPopSound();

              setActiveTab("actions");

            }}

            className={`btn-pill-superr text-xs !py-1.5 !px-4 ${

              activeTab === "actions" ? "!bg-[var(--ink)] !text-[var(--app-bg)]" : ""

            }`}

          >

            <DFeltAction size={14} className={activeTab === "actions" ? "text-[#22c55e]" : "text-current"} />

            <span>{t("wp.tab.actions_n")} ({items.filter(i => i.section === "actions").length})</span>

          </button>

          <button

            onClick={() => {

              playPopSound();

              setActiveTab("network");

            }}

            className={`btn-pill-superr text-xs !py-1.5 !px-4 ${

              activeTab === "network" ? "!bg-[var(--ink)] !text-[var(--app-bg)]" : ""

            }`}

          >

            <DFeltNetwork size={14} className={activeTab === "network" ? "text-[#3b82f6]" : "text-current"} />

            <span>{t("wp.tab.network").replace("{n}", String(contacts.length))}</span>

          </button>

          <button

            onClick={() => {

              playPopSound();

              setActiveTab("personal");

            }}

            className={`btn-pill-superr text-xs !py-1.5 !px-4 ${

              activeTab === "personal" ? "!bg-[var(--ink)] !text-[var(--app-bg)]" : ""

            }`}

          >

            <DFeltPersonal size={14} className={activeTab === "personal" ? "text-[#ff66cf]" : "text-current"} />

            <span>{t("work.personal_tab").replace("{n}", String(items.filter(i => i.section === "personal").length))}</span>

          </button>

        </div>

      </div>

      {/* 2. ⭐ NETWORK KISMI: İSTEDİĞİNİZ 1, 2, 3... SIRALI KİŞİ VE İLETİŞİM TABLOSU */}

      <motion.div

        key={activeTab}

        initial={{ opacity: 0, x: 10, skewY: -0.8 }}

        animate={{ opacity: 1, x: 0, skewY: 0 }}

        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}

      >

      {activeTab === "network" ? (

        <div className="mt-6 flex flex-col gap-4">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-2">

              <span className="font-gelica text-lg font-semibold text-[var(--ink)] flex items-center gap-2">

                <DFeltNetwork size={20} className="text-[#3b82f6]" />

                <span>network & rehber tablosu</span>

              </span>

              <span className="font-mono text-xs text-[var(--ink-soft)]">[{t("work.record_count").replace("{n}", String(contacts.length))}]</span>

            </div>

            <button

              onClick={() => {

                playPopSound();

                setIsAddingContact((prev) => !prev);

              }}

              className="btn-pill-orange text-xs !py-1.5 !px-4"

            >

              {isAddingContact ? <X size={13} /> : <Plus size={13} />}

              <span>{isAddingContact ? t("act.cancel") : t("wp.add_person")}</span>

            </button>

          </div>

          {/* Yeni Kişi Ekleme Formu */}

          <AnimatePresence initial={false}>

          {isAddingContact && (

            <motion.form

              initial={{ opacity: 0, maxHeight: 0, overflow: "hidden" }}

              animate={{ opacity: 1, maxHeight: 600, overflow: "hidden" }}

              exit={{ opacity: 0, maxHeight: 0, overflow: "hidden" }}

              transition={{ duration: 0.22, ease: "easeOut" }}

              onSubmit={handleSaveContact}

              className="card-superr p-5 bg-[var(--paper)] flex flex-col gap-3"

            >

              <span className="font-gelica text-xs font-semibold text-[var(--ink)]">

                {t("work.contact_add", { n: contacts.length + 1 })}

              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">

                <input

                  type="text"

                  value={contactName}

                  onChange={(e) => setContactName(e.target.value)}

                  placeholder={t("wp.ph.name")}

                  required

                  className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-2 outline-none"

                />

                <input

                  type="text"

                  value={contactProf}

                  onChange={(e) => setContactProf(e.target.value)}

                  placeholder={t("wp.ph.profession")}

                  className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-2 outline-none"

                />

                <input

                  type="text"

                  value={contactAddr}

                  onChange={(e) => setContactAddr(e.target.value)}

                  placeholder={t("wp.ph.address")}

                  className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-2 outline-none"

                />

                <input

                  type="text"

                  value={contactPhone}

                  onChange={(e) => setContactPhone(e.target.value)}

                  placeholder={t("wp.ph.phone")}

                  className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-2 outline-none"

                />

                <input

                  type="email"

                  value={contactEmail}

                  onChange={(e) => setContactEmail(e.target.value)}

                  placeholder={t("wp.ph.email")}

                  className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-2 outline-none"

                />

                <input

                  type="text"

                  value={contactWeb}

                  onChange={(e) => setContactWeb(e.target.value)}

                  placeholder={t("wp.ph.web")}

                  className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-2 outline-none"

                />

              </div>

              <input

                type="text"

                value={contactNote}

                onChange={(e) => setContactNote(e.target.value)}

                placeholder={t("wp.ph.note_special")}

                className="w-full rounded-[8px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-2 text-xs outline-none"

              />

              <div className="flex justify-end gap-2 pt-1">

                <button type="submit" className="btn-pill-orange text-xs !py-1.5 !px-5">

                  <Check size={13} strokeWidth={2.5} />

                  <span>{t("work.save_table")}</span>

                </button>

              </div>

            </motion.form>

          )}

          </AnimatePresence>

          {/* ⭐ AŞAĞIYA DOĞRU 1, 2, 3, 4, 5 DİYE SIRALANAN PROFESYONEL NETWORK TABLOSU */}

          <div className="relative group rounded-[12px] overflow-hidden">

            {/* Sol Kenar Taşma Gradient'i */}

            {canScrollLeft && (

              <div

                className="pointer-events-none absolute start-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[var(--paper)] to-transparent z-10 transition-opacity duration-200"

              />

            )}

            {/* Sağ Kenar Taşma Gradient'i ve '→ kaydır' İpucu */}

            {canScrollRight && (

              <div

                className="pointer-events-none absolute end-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[var(--paper)] via-[color-mix(in_srgb,var(--paper)_80%,transparent)] to-transparent z-10 flex items-center justify-end pe-3 transition-opacity duration-200"

              >

                <span className="font-handwritten text-[13px] font-bold text-[var(--accent)] bg-[var(--app-bg)] border border-[var(--line-strong)] px-2.5 py-0.5 rounded-full shadow-sm animate-pulse whitespace-nowrap">

                  {t("work.scroll")}

                </span>

              </div>

            )}

            <div

              ref={tableScrollRef}

              onScroll={checkTableScroll}

              className="overflow-x-auto border border-[var(--line-strong)] rounded-[12px] bg-[var(--app-bg)] shadow-superrCard scrollbar-thin"

            >

              <table className="w-full text-start border-collapse text-xs font-geist">

              <thead>

                <tr className="bg-[var(--paper)] border-b border-[var(--line)] text-[var(--ink)] font-gelica font-bold">

                  <th className="py-3 px-3 w-12 text-center">#</th>

                  <th className="py-3 px-3 min-w-[130px]">{t("wp.th.name")}</th>

                  <th className="py-3 px-3 min-w-[140px]">{t("wp.th.profession")}</th>

                  <th className="py-3 px-3 min-w-[120px]">{t("wp.th.address")}</th>

                  <th className="py-3 px-3 min-w-[120px]">{t("work.phone")}</th>

                  <th className="py-3 px-3 min-w-[140px]">{t("wp.th.email")}</th>

                  <th className="py-3 px-3 min-w-[120px]">{t("wp.th.web")}</th>

                  <th className="py-3 px-4 min-w-[180px]">{t("wp.th.note")}</th>

                  <th className="py-3 px-3 w-12 text-center">{t("wp.th.action")}</th>

                </tr>

              </thead>

              <tbody className="divide-y border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]">

                {filteredContacts.length > 0 ? (

                  filteredContacts.map((contact, idx) => (

                    <tr

                      key={contact.id}

                      className="hover:bg-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] transition-colors"

                    >

                      <td className="py-3 px-3 text-center font-mono font-bold text-[var(--accent)]">

                        {idx + 1}

                      </td>

                      <td className="py-3 px-3 font-semibold text-[var(--ink)]">

                        {contact.name}

                      </td>

                      <td className="py-3 px-3 text-[var(--ink-soft)]">

                        {contact.profession}

                      </td>

                      <td className="py-3 px-3 text-[var(--ink-soft)]">

                        <span className="flex items-center gap-1">

                          <MapPin size={11} className="text-[var(--accent)]" />

                          <span>{contact.address}</span>

                        </span>

                      </td>

                      <td className="py-3 px-3 font-mono text-[var(--ink)]">

                        <span className="flex items-center gap-1">

                          <Phone size={11} className="text-[#22c55e]" />

                          <span>{contact.phone}</span>

                        </span>

                      </td>

                      <td className="py-3 px-3 text-[#3b82f6]">

                        <span className="flex items-center gap-1">

                          <Mail size={11} />

                          <span>{contact.email}</span>

                        </span>

                      </td>

                      <td className="py-3 px-3 text-[var(--ink)]">

                        <span className="flex items-center gap-1">

                          <Globe size={11} className="text-[#8c8c8c]" />

                          <span>{contact.website}</span>

                        </span>

                      </td>

                      <td className="py-3 px-4 text-[var(--ink-soft)] max-w-xs font-sans leading-relaxed">

                        {contact.note}

                      </td>

                      <td className="py-3 px-3 text-center">

                        <button

                          onClick={() => handleDeleteContact(contact.id)}

                          title={t('wp.delete_person')}

                          className="p-1 text-[var(--ink-soft)] hover:text-red-600 transition-colors"

                        >

                          <Trash2 size={13} />

                        </button>

                      </td>

                    </tr>

                  ))

                ) : (

                  <tr>

                    <td colSpan={9} className="text-center py-10 text-[var(--ink-soft)]">

                      {t("wp.contact_empty")}

                    </td>

                  </tr>

                )}

              </tbody>

            </table>

            </div>

          </div>

        </div>

      ) : (

        <div className="mt-6 flex flex-col gap-4">

          <div className="flex items-center justify-between">

            <span className="font-gelica text-lg font-semibold text-[var(--ink)] flex items-center gap-2">

              {activeTab === "ideas" && (

                <>

                  <DFeltIdea size={20} className="text-[var(--accent)]" />

                  <span>{t("wp.sec.ideas")}</span>

                </>

              )}

              {activeTab === "actions" && (

                <>

                  <DFeltAction size={20} className="text-[#22c55e]" />

                  <span>{t("wp.tab.actions")}</span>

                </>

              )}

              {activeTab === "personal" && (

                <>

                  <DFeltPersonal size={20} className="text-[#ff66cf]" />

                  <span>{t("wp.tab.personal")}</span>

                </>

              )}

            </span>

            <button

              onClick={() => {

                playPopSound();

                setIsAddingItem((prev) => !prev);

              }}

              className="btn-pill-orange text-xs !py-1.5 !px-4"

            >

              {isAddingItem ? <X size={13} /> : <Plus size={13} />}

              <span>{isAddingItem ? t("act.cancel") : t("wp.add_note")}</span>

            </button>

          </div>

          {/* Not Yazma Formu */}

          <AnimatePresence initial={false}>

          {isAddingItem && (

            <motion.form

              initial={{ opacity: 0, maxHeight: 0, overflow: "hidden" }}

              animate={{ opacity: 1, maxHeight: 600, overflow: "hidden" }}

              exit={{ opacity: 0, maxHeight: 0, overflow: "hidden" }}

              transition={{ duration: 0.22, ease: "easeOut" }}

              onSubmit={handleSaveItem}

              className="card-superr p-5 bg-[var(--paper)] flex flex-col gap-3"

            >

              <input

                type="text"

                value={itemTitle}

                onChange={(e) => setItemTitle(e.target.value)}

                placeholder={t("wp.ph.title")}

                autoFocus

                className="w-full rounded-[8px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-2.5 font-gelica text-base font-semibold text-[var(--ink)] outline-none"

              />

              <textarea

                rows={3}

                value={itemContent}

                onChange={(e) => setItemContent(e.target.value)}

                placeholder={t("wp.ph.body")}

                className="w-full rounded-[8px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-2.5 font-geist text-xs text-[var(--ink)] outline-none leading-relaxed"

              />

              <div className="flex justify-end gap-2 pt-1">

                <button type="submit" className="btn-pill-orange text-xs !py-1.5 !px-5">

                  <Check size={13} strokeWidth={2.5} />

                  <span>{t("act.save")}</span>

                </button>

              </div>

            </motion.form>

          )}

          </AnimatePresence>

          {/* Not Kartları Izgarası (Tıklanabilir Inline Düzenleme Destekli) */}

          {currentSectionItems.length > 0 ? (

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {currentSectionItems.map((item) => {

                const isEditing = editingItemId === item.id;

                if (isEditing) {

                  return (

                    <form

                      key={item.id}

                      onSubmit={(e) => handleSaveEdit(e, item.id)}

                      className="card-superr p-5 bg-[var(--paper)] flex flex-col gap-3 border-2 border-[var(--accent)] shadow-superrCard"

                    >

                      <div className="flex items-center justify-between pb-2 border-b border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]">

                        <span className="font-gelica text-xs font-semibold text-[var(--accent)] uppercase flex items-center gap-1.5">

                          <DEdit size={13} />

                          <span>{t("wp.edit_note")}</span>

                        </span>

                        <button

                          type="button"

                          onClick={handleCancelEdit}

                          className="text-xs font-gelica text-[var(--ink-soft)] hover:text-[var(--ink)] flex items-center gap-1"

                        >

                          <X size={12} />

                          <span>{t("act.cancel")}</span>

                        </button>

                      </div>

                      <input

                        type="text"

                        value={editTitle}

                        onChange={(e) => setEditTitle(e.target.value)}

                        placeholder={t("wp.ph.note_title")}

                        required

                        autoFocus

                        className="w-full rounded-[8px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-2 font-gelica text-sm font-semibold text-[var(--ink)] outline-none"

                      />

                      <textarea

                        rows={3}

                        value={editContent}

                        onChange={(e) => setEditContent(e.target.value)}

                        placeholder={t("wp.ph.body")}

                        className="w-full rounded-[8px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-2.5 font-geist text-xs text-[var(--ink)] outline-none leading-relaxed"

                      />

                      <div className="flex justify-end gap-2 pt-1">

                        <button

                          type="button"

                          onClick={handleCancelEdit}

                          className="btn-pill-superr text-xs !py-1 !px-3"

                        >

                          {t("common.back")}

                        </button>

                        <button type="submit" className="btn-pill-orange text-xs !py-1.5 !px-4">

                          <Check size={13} strokeWidth={2.5} />

                          <span>{t("act.save")}</span>

                        </button>

                      </div>

                    </form>

                  );

                }

                return (

                  <div

                    key={item.id}

                    style={getCardRotationStyle(item.id)}

                    className="card-superr p-5 group hover:border-[var(--accent)] transition-all cursor-pointer"

                    onClick={() => handleStartEdit(item)}

                    title={t("wp.click_to_edit")}

                  >

                    <div className="flex items-center justify-between pb-2 border-b border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]">

                      <span className="font-gelica text-xs font-semibold text-[var(--accent)] uppercase">

                        {activeTab}

                      </span>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>

                        <button

                          onClick={() => handleStartEdit(item)}

                          className="p-1 text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors rounded-[6px]"

                          title={t("wp.edit_note")}

                        >

                          <DEdit size={13} />

                        </button>

                        <button

                          onClick={() => handleTogglePin(item.id)}

                          className={`p-1 rounded-[6px] ${item.isPinned ? "text-[var(--accent)]" : "text-[var(--ink-soft)]"}`}

                          title={item.isPinned ? t("wp.unpin") : t("wp.pin")}

                        >

                          <Pin size={13} className={item.isPinned ? "rotate-45 fill-current" : ""} />

                        </button>

                        <button

                          onClick={() => handleDeleteItem(item.id)}

                          className="p-1 text-[var(--ink-soft)] hover:text-red-600 transition-colors"

                          title={t("common.delete")}

                        >

                          <Trash2 size={13} />

                        </button>

                      </div>

                    </div>

                    <h3 className="font-gelica text-[20px] font-semibold text-[var(--ink)] mt-3">

                      {item.title}

                    </h3>

                    <p className="mt-1.5 font-geist text-xs text-[var(--ink-soft)] leading-relaxed whitespace-pre-line">

                      {item.content}

                    </p>

                  </div>

                );

              })}

            </div>

          ) : (

            <div className="py-12 flex flex-col items-center justify-center text-center">

              {activeTab === "ideas" && <SketchEmptyIdeas size={110} />}

              {activeTab === "actions" && <SketchEmptyTasks size={110} />}

              {activeTab === "personal" && <SketchEmptyNotes size={110} />}

              {/* MADDE 4: ARAMA AKTIFSE ve sonuc YOKSA ayri mesaj + temizle butonu. */}
              {String(search || "").trim() !== "" ? (
                <>
                  <p className="mt-4 font-gelica text-lg font-semibold text-[var(--ink)]" data-search-empty="1">
                    {t("search.no_result").replace("{q}", search.trim())}
                  </p>
                  <button
                    type="button"
                    data-clear-search="1"
                    onClick={() => setSearch("")}
                    className="mt-3 rounded-[20px] border border-[var(--line-strong)] bg-[var(--app-bg)] px-3.5 py-1.5 font-gelica text-xs font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--paper)]"
                  >
                    {t("search.clear")}
                  </button>
                </>
              ) : (
                <>
              <p className="font-handwritten text-sm text-[var(--accent)] mt-1 font-bold">
                {t("work.tab_empty")}
              </p>

                </>

              )}

            </div>

          )}

        </div>

      )}

      </motion.div>

    </div>

  );

}
