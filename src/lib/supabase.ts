import type { SupabaseClient } from "@supabase/supabase-js";

// Vite ortam değişkenleri
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Verilen anahtar service-role/secret bir anahtar mı?
 * Vite `VITE_*` değişkenlerini İSTEMCİ paketine dahil ettiği için, buraya
 * service-role anahtarı koymak onu tüm ziyaretçilere açık eder ve RLS'i atlar.
 * Bu yüzden böyle bir anahtar varken bulut özelliklerini KAPATIYORUZ.
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

const hasSecretKey = Boolean(supabaseAnonKey && looksLikeSecretKey(supabaseAnonKey));

if (hasSecretKey) {
  console.error(
    "[yourbook] GÜVENLİK: VITE_SUPABASE_ANON_KEY bir service-role/secret anahtarı içeriyor. " +
      "Bu anahtar istemci paketine gömülür ve Row Level Security'yi atlar. " +
      "Bulut senkronizasyonu DEVRE DIŞI bırakıldı. " +
      "Lütfen Supabase panelinden bu anahtarı ROTATE edin ve yerine publishable/anon anahtar koyun."
  );
}

/** Anahtar yanlış tipte olduğu için bulut kapatıldı mı? (UI uyarısı için) */
export const isCloudConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !hasSecretKey &&
  supabaseUrl.startsWith("http") &&
  supabaseAnonKey.length > 20
);

let clientPromise: Promise<SupabaseClient | null> | null = null;

/**
 * Supabase istemcisini ilk ihtiyaçta yükler (kütüphane ana pakette değil, ayrı parçadadır).
 * Bulut yapılandırılmamışsa kütüphane hiç indirilmez ve null döner.
 */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!isCloudConfigured) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js")
      .then(({ createClient }) =>
        createClient(supabaseUrl!, supabaseAnonKey!, {
          auth: { persistSession: true, autoRefreshToken: true },
        })
      )
      .catch(() => {
        clientPromise = null; // ağ hatası: sonraki çağrıda yeniden dene
        return null;
      });
  }
  return clientPromise;
}

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  avatarLetter: string;
  isCloud: boolean;
  createdAt: number;
}

const LOCAL_USER_KEY = "yourbook_auth_user_v1";

/** Cihazdaki aktif kullanıcıyı yükler */
export function getSavedLocalUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return null;
}

/** Kullanıcı oturumunu yerel storage'a kaydeder */
export function saveLocalUser(user: AppUser | null) {
  try {
    if (user) {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_USER_KEY);
    }
  } catch { }
}

/** Giriş Yap (Supabase Cloud veya Çevrimdışı/Yerel Kullanıcı) */
export async function loginUser(email: string, pass: string): Promise<{ user: AppUser | null; error: string | null }> {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Supabase Yapılandırılmışsa gerçek buluta bağlan
  const sb = await getSupabase();
  if (isCloudConfigured && !sb) return { user: null, error: "Bulut servisine ulaşılamadı. Bağlantınızı kontrol edin." };
  if (sb) {
    try {
      const { data, error } = await sb.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });
      if (error) return { user: null, error: error.message };
      if (data.user) {
        const appUser: AppUser = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          displayName: data.user.user_metadata?.display_name || cleanEmail.split("@")[0],
          avatarLetter: (cleanEmail[0] || "Y").toUpperCase(),
          isCloud: true,
          createdAt: new Date(data.user.created_at).getTime(),
        };
        saveLocalUser(appUser);
        return { user: appUser, error: null };
      }
    } catch (err: any) {
      return { user: null, error: err.message || "Giriş yapılamadı" };
    }
  }

  // 2. Çevrimdışı / Yerel Çalışma Modu (Kullanıcı dilediğinde hemen test edebilir)
  if (pass.length < 4) {
    return { user: null, error: "Şifre en az 4 karakter olmalıdır." };
  }

  const appUser: AppUser = {
    id: "user-" + Math.abs(cleanEmail.split("").reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)),
    email: cleanEmail,
    displayName: cleanEmail.split("@")[0],
    avatarLetter: (cleanEmail[0] || "Y").toUpperCase(),
    isCloud: false,
    createdAt: Date.now(),
  };

  saveLocalUser(appUser);
  return { user: appUser, error: null };
}

/** Yeni Hesap Oluştur (Kayıt Ol) */
export async function registerUser(email: string, pass: string, name?: string): Promise<{ user: AppUser | null; error: string | null }> {
  const cleanEmail = email.trim().toLowerCase();
  const displayName = name?.trim() || cleanEmail.split("@")[0];

  const sb = await getSupabase();
  if (isCloudConfigured && !sb) return { user: null, error: "Bulut servisine ulaşılamadı. Bağlantınızı kontrol edin." };
  if (sb) {
    try {
      const { data, error } = await sb.auth.signUp({
        email: cleanEmail,
        password: pass,
        options: {
          data: { display_name: displayName },
        },
      });
      if (error) return { user: null, error: error.message };
      if (data.user) {
        const appUser: AppUser = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          displayName,
          avatarLetter: (displayName[0] || "Y").toUpperCase(),
          isCloud: true,
          createdAt: Date.now(),
        };
        saveLocalUser(appUser);
        return { user: appUser, error: null };
      }
    } catch (err: any) {
      return { user: null, error: err.message || "Hesap oluşturulamadı" };
    }
  }

  // Çevrimdışı kayıt
  if (pass.length < 4) {
    return { user: null, error: "Şifre en az 4 karakter olmalıdır." };
  }

  const appUser: AppUser = {
    id: "user-" + Date.now(),
    email: cleanEmail,
    displayName,
    avatarLetter: (displayName[0] || "Y").toUpperCase(),
    isCloud: false,
    createdAt: Date.now(),
  };

  saveLocalUser(appUser);
  return { user: appUser, error: null };
}

/** Çıkış Yap */
export async function logoutUser(): Promise<void> {
  const sb = await getSupabase();
  if (sb) {
    try {
      await sb.auth.signOut();
    } catch { }
  }
  saveLocalUser(null);
}

/* ==========================================================================
   ASAMA 2 - KIMLIK DOGRULAMA EK FONKSIYONLARI
   ---------------------------------------------------------------------------
   Mevcut loginUser/registerUser/logoutUser'a DOKUNULMADI. Yalnizca EKLENDI:
     1) requestPasswordReset  -> e-posta ile sifre sifirlama
     2) getCurrentSessionUser -> sayfa yenilenince oturumu geri yukle
     3) onAuthStateChange     -> oturum degisimlerini dinle
     4) updatePassword        -> sifirlama baglantisindan sonra yeni sifre
   ========================================================================== */

/** Oturumdaki kullaniciyi AppUser'a cevir (AuthModal ile ayni sekil). */
function sessionUserToAppUser(u: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined): AppUser | null {
  if (!u || !u.id) return null;
  const email = u.email ?? "";
  const meta = u.user_metadata ?? {};
  const rawName = typeof meta.display_name === "string" ? meta.display_name : "";
  const displayName = rawName || (email ? email.split("@")[0] : "uye");
  const letter = (displayName.trim()[0] || "?").toUpperCase();
  return {
    id: u.id,
    email,
    displayName,
    avatarLetter: letter,
    isCloud: true,
    createdAt: Date.now(),
  };
}

/**
 * Sifre sifirlama e-postasi gonderir.
 * Basari durumunda { ok: true }, aksi halde { ok: false, error }.
 * Bulut yapilandirilmamissa sessizce hata doner (yerel mod bozulmaz).
 */
export async function requestPasswordReset(email: string): Promise<{ ok: boolean; error: string | null }> {
  const sb = await getSupabase();
  if (!sb) return { ok: false, error: "cloud_not_configured" };
  try {
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { ok: false, error: error.message };
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown_error" };
  }
}

/**
 * Sayfa acilisinda/ yenilendiginde mevcut oturumu okur.
 * Bulut oturumu varsa AppUser (isCloud:true) doner, yoksa null.
 * Boylece oturum sayfa yenilemesinde DUSMEZ.
 */
export async function getCurrentSessionUser(): Promise<AppUser | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) return null;
    return sessionUserToAppUser(data.session?.user);
  } catch {
    return null;
  }
}

/**
 * Oturum degisimlerini dinler (giris / cikis / token yenileme).
 * Donen fonksiyon abonelikten cikar.
 */
export function onAuthStateChange(cb: (user: AppUser | null) => void): () => void {
  if (!isCloudConfigured) return () => {};
  let cancelled = false;
  let unsubscribe: () => void = () => {};
  getSupabase().then((sb) => {
    if (!sb || cancelled) return;
    try {
      const { data } = sb.auth.onAuthStateChange((_event, session) => {
        cb(sessionUserToAppUser(session?.user));
      });
      unsubscribe = () => {
        try { data.subscription.unsubscribe(); } catch { /* yok say */ }
      };
    } catch { /* yok say */ }
  });
  return () => {
    cancelled = true;
    unsubscribe();
  };
}

/** Sifirlama baglantisindan sonra yeni sifre belirler. */
export async function updatePassword(newPass: string): Promise<{ ok: boolean; error: string | null }> {
  const sb = await getSupabase();
  if (!sb) return { ok: false, error: "cloud_not_configured" };
  try {
    const { error } = await sb.auth.updateUser({ password: newPass });
    if (error) return { ok: false, error: error.message };
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown_error" };
  }
}

/** Sifirlama baglantisi ile gelindi mi? (URL'de type=recovery) */
export function isPasswordRecoveryLink(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hash || "";
  const s = window.location.search || "";
  return /type=recovery/.test(h) || /type=recovery/.test(s);
}
