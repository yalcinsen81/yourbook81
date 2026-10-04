import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WordStatusPanel, PanelCard } from "./WordStatusPanel";

describe("WordStatusPanel.tsx - Word lists with sketch empty state icons", () => {
  const mockCards: PanelCard[] = [];
  const mockQueueIds: string[] = [];

  it("should render accordion categories correctly", () => {
    const handleReturnToQueue = vi.fn();

    render(
      <WordStatusPanel
        allCards={mockCards}
        queueIds={mockQueueIds}
        onReturnToQueue={handleReturnToQueue}
      />
    );

    expect(screen.getByText("yeni kelimeler")).toBeTruthy();
    expect(screen.getByText("tekrarı bekleyen")).toBeTruthy();
    expect(screen.getByText("öğrenilen kelimeler")).toBeTruthy();
  });

  it("should render panel collapse button and word counts", () => {
    const handleReturnToQueue = vi.fn();

    render(
      <WordStatusPanel
        allCards={mockCards}
        queueIds={mockQueueIds}
        onReturnToQueue={handleReturnToQueue}
      />
    );

    expect(screen.getByTitle("Paneli daralt")).toBeTruthy();
    expect(screen.getAllByText(/kelime durumu/).length).toBeGreaterThan(0);
  });
});
