import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { tr } from "../../src/i18n/tr";

describe("check:i18n betiği", () => {
  it("tüm anahtarları sayar ve tr/en eşitliğini doğrular", () => {
    const out = execFileSync("node", ["scripts/check-i18n.mjs"], { encoding: "utf8" });
    expect(out).toContain(`${Object.keys(tr).length} anahtar`);
  });
});
