import { describe, it, expect } from "vitest";
import { viewFromSearch } from "./deepLink";

describe("viewFromSearch", () => {
  it("geçerli görünümleri okur (bildirim bağlantıları)", () => {
    expect(viewFromSearch("?view=notes")).toBe("notes");
    expect(viewFromSearch("?view=calendar&x=1")).toBe("calendar");
  });
  it("geçersiz veya eksik değerde null döner", () => {
    expect(viewFromSearch("")).toBeNull();
    expect(viewFromSearch("?view=evil")).toBeNull();
    expect(viewFromSearch("?snooze=note:1:5")).toBeNull();
  });
});
