import { describe, it, expect } from "vitest";
// Vite'in ?raw yuklemesi: dosyalari metin olarak ice alir (node:fs gerekmez).
import sidebarSource from "./SuperrSidebar.tsx?raw";
import appSource from "../App.tsx?raw";

/**
 * Regresyon testleri: sidebar gizle/goster butonu.
 *
 * Bu ozellikte iki hata yasandi ve ikisi de burada kilitlenir:
 *
 *  1) Buton aside'in Icine kondu. aside'in overflow:hidden'i yuzunden panel
 *     sola kayarken buton KIRPILDI ve tiklanamadi (elementFromPoint ile
 *     dogrulandi: merkezdeki eleman buton degil, baska bir span'di).
 *     -> Cozum: buton aside'in DISINDA (App.tsx) durur.
 *
 *  2) Buton yalnizca acik durumda render ediliyordu; gizlenince ekranda
 *     geri getirecek hicbir sey kalmiyordu.
 *     -> Cozum: iki durum icin ayri buton (acikken ok-sol, gizliyken ok-sag).
 */

describe("sidebar gizle/goster butonu", () => {
  it("buton aside'in DISINDA tanimli - aside tasani kirpar", () => {
    expect(sidebarSource).not.toContain('data-sidebar-toggle="1"');
    expect(appSource).toContain('data-sidebar-toggle="1"');
  });

  it("hem acik hem gizli durum icin buton var", () => {
    const count = appSource.split('data-sidebar-toggle="1"').length - 1;
    expect(count).toBeGreaterThanOrEqual(2);
    expect(appSource).toContain("isSidebarHidden &&");
  });

  it("gizliyken geri getirme butonu sol kenarda sabit durur", () => {
    expect(appSource).toContain('t("sidebar.show")');
    expect(appSource).toMatch(/left:\s*12\b/);
  });

  it("buton Ctrl+B ile AYNI gorunurluk kaynagini kullanir", () => {
    expect(appSource).toContain("useSidebarVisibility");
  });

  it("acikken konum sidebar genisligini takip eder (sabit degil)", () => {
    expect(appSource).toContain("useSidebarWidth");
    expect(appSource).toContain("sidebarWidth");
  });

  it("kok sarmalayici sabit 280px genislige kilitli DEGIL", () => {
    expect(appSource).not.toContain("min-w-[280px] max-w-[280px]");
  });
});
