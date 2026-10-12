import { useEffect, useState } from "react";
import { formatShort, isValidDate } from "../model/calendar";
import type { Holiday } from "../model/holidays";
import { defaultHolidays } from "../model/sample";

interface Props {
  holidays: Holiday[];
  projectStart: string;
  onSave: (holidays: Holiday[]) => void;
  onClose: () => void;
}

/** Çalışılmayan günler: Türkiye resmî tatilleri hazır gelir, kullanıcı ekleyip silebilir. */
export function CalendarDialog({ holidays, projectStart, onSave, onClose }: Props) {
  const [list, setList] = useState<Holiday[]>(holidays);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const add = () => {
    if (!isValidDate(date) || list.some((h) => h.date === date)) return;
    setList([...list, { date, name: name.trim() || "Tatil" }].sort((a, b) => a.date.localeCompare(b.date)));
    setDate("");
    setName("");
  };

  const addTurkish = () => {
    const known = new Set(list.map((h) => h.date));
    const merged = [...list, ...defaultHolidays(projectStart).filter((h) => !known.has(h.date))];
    setList(merged.sort((a, b) => a.date.localeCompare(b.date)));
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cal-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="cal-title">Proje takvimi</h2>
        <p className="modal-note">
          Pazartesi–Cuma çalışılır. Aşağıdaki günler tatildir ve görevler bu günleri atlar. Dini bayramlar 2026–2027 için
          hazırdır; sonraki yıllar için elle ekleyin.
        </p>
        <ul className="holiday-list">
          {list.map((h) => (
            <li key={h.date}>
              <span className="date">{formatShort(h.date)}</span>
              <span className="name">{h.name}</span>
              <button aria-label={`${h.name} tatilini kaldır`} onClick={() => setList(list.filter((x) => x.date !== h.date))}>
                ✕
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="name">Tatil günü yok.</li>}
        </ul>
        <div className="holiday-add">
          <input type="date" value={date} aria-label="Tatil tarihi" onChange={(e) => setDate(e.target.value)} />
          <input
            type="text"
            value={name}
            placeholder="Açıklama (ör. Şantiye bakımı)"
            aria-label="Tatil açıklaması"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button onClick={add} disabled={!isValidDate(date)}>
            Ekle
          </button>
        </div>
        <div className="modal-actions">
          <button className="left" onClick={addTurkish}>
            Türkiye tatillerini ekle
          </button>
          <button onClick={onClose}>Vazgeç</button>
          <button
            className="primary"
            onClick={() => {
              onSave(list);
              onClose();
            }}
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
