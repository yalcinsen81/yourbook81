import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JournalMoodRadar } from "./JournalMoodRadar";
import { JournalEntry } from "./JournalView";

describe("JournalMoodRadar.tsx - Interactive Emotional Compass Component", () => {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  const mockEntries: JournalEntry[] = [
    {
      id: "j-1",
      dateKey: todayKey,
      timeStr: "10:00",
      timestamp: Date.now(),
      mood: "peaceful",
      content: "Baharın gelişiyle birlikte içimde derin bir huzur hissettim.",
      wordCount: 9,
    },
    {
      id: "j-2",
      dateKey: yesterdayKey,
      timeStr: "15:30",
      timestamp: Date.now() - 86400000,
      mood: "productive",
      content: "Kodları derledim ve tüm yeni modülleri yayına aldım.",
      wordCount: 8,
    },
    {
      id: "j-3",
      dateKey: todayKey,
      timeStr: "22:15",
      timestamp: Date.now() - 3600000,
      mood: "calm",
      content: "Gece çayı eşliğinde sessizlik.",
      promptUsed: "bugün seni gülümseten küçük bir an oldu mu?",
      wordCount: 6,
    },
  ];

  it("should render mood radar title and entry count badge", () => {
    const handleSelectDate = vi.fn();
    render(<JournalMoodRadar entries={mockEntries} onSelectDate={handleSelectDate} />);

    expect(screen.getByText(/ruh hali haritası|mood map/i)).toBeTruthy();
    expect(screen.getByText(/duygu dengesi|emotional balance/i)).toBeTruthy();
    expect(screen.getByText(/3 kayıt/)).toBeTruthy();
  });

  it("should show dominant mood badge when entries exist", () => {
    const handleSelectDate = vi.fn();
    render(<JournalMoodRadar entries={mockEntries} onSelectDate={handleSelectDate} />);

    expect(screen.getByText(/baskın|dominant/i)).toBeTruthy();
  });

  it("should switch time range filters when clicked", () => {
    const handleSelectDate = vi.fn();
    render(<JournalMoodRadar entries={mockEntries} onSelectDate={handleSelectDate} />);

    const weekBtn = screen.getByText(/son 7 gün|last 7 days/i);
    fireEvent.click(weekBtn);
    expect(weekBtn.className).toContain("bg-[var(--ink)]");
  });

  it("should call onSelectDate when a calendar cell is clicked", () => {
    const handleSelectDate = vi.fn();
    render(<JournalMoodRadar entries={mockEntries} onSelectDate={handleSelectDate} />);

    const todayCell = screen.getByTitle(new RegExp(todayKey));
    fireEvent.click(todayCell);
    expect(handleSelectDate).toHaveBeenCalledWith(todayKey);
  });

  it("should render writing habits statistics correctly", () => {
    const handleSelectDate = vi.fn();
    render(<JournalMoodRadar entries={mockEntries} onSelectDate={handleSelectDate} />);

    expect(screen.getAllByText(/toplam kelime/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ortalama|average/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/yazma vakti|writing time|most frequent/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ilham istemi|prompt/i).length).toBeGreaterThan(0);
  });
});
