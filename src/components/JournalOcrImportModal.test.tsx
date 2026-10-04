import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JournalOcrImportModal } from "./JournalOcrImportModal";

describe("JournalOcrImportModal.tsx - Handwriting & Photo Notebook OCR Scanner", () => {
  it("should not render anything when isOpen is false", () => {
    const handleClose = vi.fn();
    const handleImport = vi.fn();
    const { container } = render(
      <JournalOcrImportModal isOpen={false} onClose={handleClose} onImportText={handleImport} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render upload dropzone when open and no image uploaded", () => {
    const handleClose = vi.fn();
    const handleImport = vi.fn();
    render(
      <JournalOcrImportModal isOpen={true} onClose={handleClose} onImportText={handleImport} />
    );

    expect(screen.getByText("fotoğraftan günlüğe aktar")).toBeTruthy();
    expect(screen.getByText("defter sayfasının fotoğrafını seç veya çek")).toBeTruthy();
    expect(screen.getByText("vazgeç")).toBeTruthy();
  });

  it("should trigger onClose when vazgeç button is clicked", () => {
    const handleClose = vi.fn();
    const handleImport = vi.fn();
    render(
      <JournalOcrImportModal isOpen={true} onClose={handleClose} onImportText={handleImport} />
    );

    const cancelBtn = screen.getByText("vazgeç");
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
