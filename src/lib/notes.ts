import { useCallback, useEffect, useMemo, useState } from "react";
import type { NoteCategory, PersonalNote } from "./types";

const STORAGE_KEY = "yourbook_notes_v1";

export const CATEGORY_MAP: Record<NoteCategory, { name: string; nameKey: string; icon: string }> = {
  work: { name: "iş & proje", icon: "briefcase", nameKey: "ncat.work" },
  ideas: { name: "fikirler", icon: "lightbulb", nameKey: "ncat.ideas" },
  reminders: { name: "hatırlatıcı", icon: "bell", nameKey: "ncat.reminders" },
  quotes: { name: "alıntı", icon: "book-open", nameKey: "ncat.quotes" },
  personal: { name: "kişisel", icon: "coffee", nameKey: "ncat.personal" },
};

const INITIAL_NOTES: PersonalNote[] = [];

type CategoryFilter = NoteCategory | "all";

export function useNotes() {
  const [notes, setNotes] = useState<PersonalNote[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((note: PersonalNote) => !Object.values(note).some((value) => value === "Test notu eklendi."));
      }
    } catch {}
    return INITIAL_NOTES;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {}
  }, [notes]);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: notes.length };
    for (const c of notes) {
      counts[c.category] = (counts[c.category] || 0) + 1;
    }
    return counts;
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes
      .filter((n) => (activeCategory === "all" ? true : n.category === activeCategory))
      .filter((n) => {
        if (!q) return true;
        const haystack = [n.title, n.content, ...n.tags].join(" ").toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
        return b.createdAt - a.createdAt;
      });
  }, [notes, searchQuery, activeCategory]);

  const addNote = useCallback((input: Omit<PersonalNote, "id" | "createdAt" | "updatedAt">) => {
    const now = Date.now();
    const note: PersonalNote = {
      ...input,
      id: "note-" + Math.random().toString(36).slice(2, 9),
      createdAt: now,
      updatedAt: now,
    };
    setNotes((prev) => [note, ...prev]);
  }, []);

  const updateNote = useCallback((id: string, patch: Partial<PersonalNote>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n))
    );
  }, []);

  const deleteNote = useCallback((id: string): PersonalNote | null => {
    let deleted: PersonalNote | null = null;
    setNotes((prev) => {
      deleted = prev.find((n) => n.id === id) ?? null;
      return prev.filter((n) => n.id !== id);
    });
    return deleted;
  }, []);

  const restoreNote = useCallback((note: PersonalNote) => {
    setNotes((prev) =>
      prev.some((n) => n.id === note.id) ? prev : [note, ...prev]
    );
  }, []);

  const togglePin = useCallback((id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: Date.now() } : n))
    );
  }, []);

  const setNoteAlarm = useCallback((id: string, reminderAt: number | null) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, reminderAt, isAlarmTriggered: false, updatedAt: Date.now() }
          : n
      )
    );
  }, []);

  // Zamanı gelen alarm (tetiklenmemiş, reminderAt <= şimdi)
  const ringingAlarmNote = useMemo(
    () =>
      notes.find(
        (n) => n.reminderAt && n.reminderAt <= Date.now() && !n.isAlarmTriggered
      ) ?? null,
    [notes]
  );

  const dismissAlarm = useCallback((id: string) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, reminderAt: null, isAlarmTriggered: true, updatedAt: Date.now() }
          : n
      )
    );
  }, []);

  const snoozeAlarm = useCallback((id: string, minutes: number) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              reminderAt: Date.now() + minutes * 60_000,
              isAlarmTriggered: false,
              updatedAt: Date.now(),
            }
          : n
      )
    );
  }, []);

  return {
    notes,
    filteredNotes,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    categoryCounts,
    addNote,
    updateNote,
    deleteNote,
    restoreNote,
    togglePin,
    setNoteAlarm,
    ringingAlarmNote,
    dismissAlarm,
    snoozeAlarm,
  };
}
