import { describe, it, expect } from "vitest";

/**
 * supabase.ts içindeki `looksLikeSecretKey` mantığının aynası.
 * (Modül import edildiğinde import.meta.env okunur; bu yüzden mantık burada
 *  birebir kopyalanıp davranışı test edilir. supabase.ts değişirse burayı da
 *  güncelleyin — ayrıca bir "parity" testi mantığın aynı kaldığını doğrular.)
 */
function looksLikeSecretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  if (key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
      ) as { role?: string };
      return payload.role === "service_role";
    } catch {
      return false;
    }
  }
  return false;
}

/** Test için sahte JWT üret. */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.sig`;
}

describe("supabase key guard (service-role tespiti)", () => {
  it("flags new-style secret keys", () => {
    expect(looksLikeSecretKey("sb_secret_abc123")).toBe(true);
  });

  it("accepts new-style publishable keys", () => {
    expect(looksLikeSecretKey("sb_publishable_abc123")).toBe(false);
  });

  it("flags legacy service_role JWTs", () => {
    const jwt = fakeJwt({ role: "service_role", ref: "proj" });
    expect(looksLikeSecretKey(jwt)).toBe(true);
  });

  it("accepts legacy anon JWTs", () => {
    const jwt = fakeJwt({ role: "anon", ref: "proj" });
    expect(looksLikeSecretKey(jwt)).toBe(false);
  });

  it("does not crash on malformed JWT-like strings", () => {
    expect(looksLikeSecretKey("eyJ.notbase64!!.x")).toBe(false);
    expect(looksLikeSecretKey("eyJ")).toBe(false);
  });

  it("does not flag arbitrary strings", () => {
    expect(looksLikeSecretKey("some-random-value")).toBe(false);
    expect(looksLikeSecretKey("")).toBe(false);
  });

  it("cloud must stay disabled whenever a secret key is present", () => {
    // supabase.ts'deki koşulun aynası:
    const url = "https://proj.supabase.co";
    const secret = "sb_secret_leaked";
    const isCloudConfigured = Boolean(
      url && secret && !looksLikeSecretKey(secret) && url.startsWith("http") && secret.length > 20
    );
    expect(isCloudConfigured).toBe(false);

    const publishable = "sb_publishable_ok_value_here";
    const ok = Boolean(
      url && publishable && !looksLikeSecretKey(publishable) && url.startsWith("http") && publishable.length > 20
    );
    expect(ok).toBe(true);
  });
});
