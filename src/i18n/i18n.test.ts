import { describe, it, expect } from "vitest";
import { translate, UI_LANGUAGES } from "./index";
import { tr, en, de, es, pt, ar, ru, fr, nl, it as italian } from "./allLocales";

describe("i18n - interface language system", () => {
  it("offers exactly the 7 intended interface languages (tr, en, de, es, fr, it, ar)", () => {
    const codes = UI_LANGUAGES.map((l) => l.code);
    expect(codes).toEqual(["tr", "en", "de", "es", "fr", "it", "ar"]);
  });
  it("German dictionary covers every Turkish source key", () => {
    const trKeys = Object.keys(tr).sort();
    const deKeys = Object.keys(de).sort();
    expect(deKeys).toEqual(trKeys);
  });
  it("Russian dictionary covers every Turkish source key", () => {
    const trKeys = Object.keys(tr).sort();
    const ruKeys = Object.keys(ru).sort();
    expect(ruKeys).toEqual(trKeys);
  });
  it("French dictionary covers every Turkish source key", () => {
    const trKeys = Object.keys(tr).sort();
    const frKeys = Object.keys(fr).sort();
    expect(frKeys).toEqual(trKeys);
  });
  it("translates a key per language incl. Russian and French", () => {
    expect(translate("ru", "sidebar.themes")).toBe("темы");
    expect(translate("ru", "time.mon")).toBe("Пн");
    expect(translate("fr", "sidebar.themes")).toBe("thèmes");
    expect(translate("fr", "time.mon")).toBe("Lun");
    expect(translate("ru", "heat.title")).toBe("годовая карта письма");
    expect(translate("fr", "heat.title")).toBe("carte annuelle d'écriture");
  });
  it("offers 7 interface languages, exactly one of them RTL", () => {
    expect(UI_LANGUAGES.map((l) => l.code)).toEqual(["tr", "en", "de", "es", "fr", "it", "ar"]);
    expect(UI_LANGUAGES.filter((l) => l.dir === "rtl").map((l) => l.code)).toEqual(["ar"]);
  });
  it("Arabic dictionary covers every Turkish source key", () => {
    const trKeys = Object.keys(tr).sort();
    const arKeys = Object.keys(ar).sort();
    expect(arKeys).toEqual(trKeys);
  });
  it("Arabic is the only RTL interface language", () => {
    const rtl = UI_LANGUAGES.filter((l) => l.dir === "rtl").map((l) => l.code);
    expect(rtl).toEqual(["ar"]);
    expect(UI_LANGUAGES.find((l) => l.code === "tr")?.dir).toBe("ltr");
  });
  it("translates a key per language incl. Arabic", () => {
    expect(translate("ar", "sidebar.themes")).toBe("السمات");
    expect(translate("ar", "time.mon")).toBe("اثن");
    expect(translate("ar", "spread.title")).toBe("صفحة مزدوجة");
  });
  it("Portuguese dictionary covers every Turkish source key", () => {
    const trKeys = Object.keys(tr).sort();
    const ptKeys = Object.keys(pt).sort();
    expect(ptKeys).toEqual(trKeys);
  });
  it("translates a key per language incl. Portuguese", () => {
    expect(translate("pt", "sidebar.themes")).toBe("temas");
    expect(translate("pt", "journal.tab.write")).toBe("escrever");
    expect(translate("pt", "app.title")).toBe("yourbook — caderno de trabalho e agenda");
    expect(translate("pt", "spread.title")).toBe("página dupla");
  });
  it("Spanish dictionary covers every Turkish source key", () => {
    const trKeys = Object.keys(tr).sort();
    const esKeys = Object.keys(es).sort();
    expect(esKeys).toEqual(trKeys);
  });
  it("translates a key per language incl. Spanish", () => {
    expect(translate("es", "sidebar.themes")).toBe("temas");
    expect(translate("es", "journal.tab.write")).toBe("escribir");
    expect(translate("es", "app.title")).toBe("yourbook — cuaderno de trabajo y agenda");
    expect(translate("es", "spread.title")).toBe("doble página");
  });
  it("translates a key per language incl. German", () => {
    expect(translate("de", "sidebar.themes")).toBe("themen");
    expect(translate("de", "journal.tab.write")).toBe("schreiben");
    expect(translate("de", "app.title")).toBe("yourbook — arbeitsheft & agenda");
  });

  it("English dictionary covers every Turkish source key", () => {
    const trKeys = Object.keys(tr).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(trKeys);
  });

  it("translates a key per language", () => {
    expect(translate("tr", "sidebar.themes")).toBe("temalar");
    expect(translate("en", "sidebar.themes")).toBe("themes");
  });

  it("falls back to Turkish, then to the key itself, when missing", () => {
    // missing in en but present in tr -> tr value
    expect(translate("en", "sidebar.desk.new")).toBe("new study desk");
    // completely unknown key -> the key string
    expect(translate("en", "no.such.key")).toBe("no.such.key");
    // unknown language -> tr source
    expect(translate("zz", "sidebar.themes")).toBe("temalar");
  });

  it("interpolates variables", () => {
    // sanity: no crash and string returned
    expect(translate("tr", "cover.badges.volume", { v: 1 })).toContain("cilt no");
  });
  it("Dutch dictionary covers every Turkish source key", () => {
    expect(Object.keys(nl).sort()).toEqual(Object.keys(tr).sort());
  });
  it("translates a key per language incl. Dutch", () => {
    expect(translate("nl", "sidebar.themes")).toBe("thema's");
    expect(translate("nl", "common.today")).toBe("deze maand");
  });
  it("Italian dictionary covers every Turkish source key", () => {
    expect(Object.keys(italian).sort()).toEqual(Object.keys(tr).sort());
  });
  it("translates a key per language incl. Italian", () => {
    expect(translate("it", "sidebar.themes")).toBe("temi");
    expect(translate("it", "common.today")).toBe("questo mese");
  });
  it("French and Italian are selectable interface languages, both LTR", () => {
    const frDef = UI_LANGUAGES.find((l) => l.code === "fr");
    const itDef = UI_LANGUAGES.find((l) => l.code === "it");
    expect(frDef).toBeTruthy();
    expect(itDef).toBeTruthy();
    expect(frDef?.label).toBe("Français");
    expect(itDef?.label).toBe("Italiano");
    expect(frDef?.dir).toBe("ltr");
    expect(itDef?.dir).toBe("ltr");
  });
  it("translates app.title in French and Italian (real UI strings)", () => {
    expect(translate("fr", "app.title")).toBe(
      "yourbook — cahier de travail et agenda",
    );
    expect(translate("it", "app.title")).toBe(
      "yourbook — quaderno di studio & agenda",
    );
    expect(translate("fr", "journal.tab.write")).toBe("écrire");
    expect(translate("it", "journal.tab.write")).toBe("scrivi");
  });
});
