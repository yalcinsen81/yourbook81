import { getSupabase, isCloudConfigured, type AppUser } from "./supabase";

export type SyncStatus = "synced" | "syncing" | "offline" | "ready";

/**
 * yourbook genelindeki tüm yerel depolama anahtarları.
 * Çoklu tarayıcı, mobil ve masaüstü arasında tam ve eksiksiz
 * senkronizasyon sağlar.
 */
/** v-migrate: ilk bulut aktariminin raporu (kullaniciya gosterilir). */
export interface MigrationReport {
  happened: boolean;
  keyCount: number;
  bytes: number;
  keys: string[];
}

/** performCloudSync sonucu (mevcut alanlar korundu, migrated EKLENDI). */
export interface SyncResult {
  success: boolean;
  lastSyncedAt: number;
  message?: string;
  /** v-migrate: yalnizca ILK aktarimda dolu olur */
  migrated?: MigrationReport;
}

export const SYNC_KEYS = [
  "yourbook_deck_v7_clean",
  "yourbook_notes_v1",
  "superr_daily_tasks_v3",
  "superr_daily_thought_v3",
  "superr_calendar_agenda_events_v2",
  "superr_agenda_events_v4",
  "superr_youtube_links_archive_v2",
  // Is & Projeler: fikirler / aksiyonlar / kisisel notlar (GERCEK VERI)
  "superr_work_section_items_v2",
  // Is & Projeler: network / kisi kayitlari (GERCEK VERI)
  "superr_work_network_contacts_v2",
  "lexi_engagement_v1",
  "superr_theme_v1",
  // Günlük & Mahremiyet
  "yourbook_journal_entries_v1",
  // Gunluk: ilham istemi kapatildi mi (kullanicinin bilincli tercihi)
  "yourbook_journal_prompt_closed_v1",
  "yourbook_journal_pin_v1",
  // Sıcak Defter Kişiselleştirme & Ciltler
  "yourbook_paper_texture_v1",
  "yourbook_handwriting_font_v1",
  "yourbook_custom_handwriting_v1",
  "yourbook_ink_stamp_v1",
  "yourbook_notebook_volume_v1",
  "yourbook_volumes_archive_v1",
  "yourbook_time_lighting_enabled_v1",
  "yourbook_ritual_window_v1",
  "yourbook_gifted_notebook_v1",
  // Ses tercihi
  "lexi_sound_muted",
  "yourbook_sound_profile_v1",
  // Arayüz dili & Cilt tercihleri (v26)
  "yourbook_ui_language_v1",
  "yourbook_volume_autoswitch_v1",
  // Kullanıcı tanımlı dil masaları (v25)
  "craft_custom_spaces_v1",
  "craft_active_space_taste_v1",
] as const;

export interface SyncPayload {
  updatedAt: number;
  data: Record<string, any>;
}

/** Cihazdaki tüm verileri JSON paketi olarak toplar */
export function exportCurrentData(): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const k of SYNC_KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (v !== null && v !== undefined) {
        try {
          payload[k] = JSON.parse(v);
        } catch {
          payload[k] = v; // Düz string değerleri (ör. "theme-cream") koru
        }
      }
    } catch { }
  }
  return payload;
}

/** Gelen JSON paketini cihaza uygular */
export function importDataToStorage(data: Record<string, any>): boolean {
  if (!data || typeof data !== "object") return false;
  let changed = false;
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null) {
      try {
        const valStr = typeof v === "string" ? v : JSON.stringify(v);
        const currentVal = localStorage.getItem(k);
        if (currentVal !== valStr) {
          localStorage.setItem(k, valStr);
          changed = true;
        }
      } catch {}
    }
  }
  return changed;
}


/* ==========================================================================
   UC YONLU BIRLESTIRME (base / local / cloud)
   --------------------------------------------------------------------------
   base  = son basarili eşitlemede iki tarafın da paylaştığı değer
   local = bu cihazdaki şu anki değer
   cloud = buluttaki şu anki değer
   Yalnızca bir taraf değiştiyse o taraf kazanır. İki taraf da değiştiyse,
   `id` alanlı nesne dizileri öğe bazında birleştirilir (silmeler dahil);
   diğer değerlerde bu cihazın değeri kazanır.
   ========================================================================== */

const BASE_KEY = "yourbook_sync_base_v1";

const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};

type Item = { id: string | number; [k: string]: any };
const isIdArray = (v: unknown): v is Item[] =>
  Array.isArray(v) && v.every((x) => x && typeof x === "object" && !Array.isArray(x) && (typeof x.id === "string" || typeof x.id === "number"));

function mergeIdArrays(base: Item[], local: Item[], cloud: Item[]): Item[] {
  const b = new Map(base.map((x) => [x.id, x]));
  const l = new Map(local.map((x) => [x.id, x]));
  const c = new Map(cloud.map((x) => [x.id, x]));
  const out: Item[] = [];
  const seen = new Set<string | number>();
  // Sıra: yerel sıra, sonra buluttaki yeni öğeler
  for (const id of [...l.keys(), ...c.keys()]) {
    if (seen.has(id)) continue;
    seen.add(id);
    const bi = b.get(id), li = l.get(id), ci = c.get(id);
    if (li && ci) {
      if (same(li, ci)) out.push(li);
      else if (bi && same(li, bi)) out.push(ci);   // yalnız bulut düzenledi
      else if (bi && same(ci, bi)) out.push(li);   // yalnız yerel düzenledi
      else {
        // İkisi de düzenledi: updatedAt varsa yeni olan, yoksa yerel
        const lt = Number(li.updatedAt ?? 0), ct = Number(ci.updatedAt ?? 0);
        out.push(ct > lt ? ci : li);
      }
    } else if (li && !ci) {
      // Bulutta yok: base'te vardıysa bulut sildi (yerel dokunmadıysa sil)
      if (bi && same(li, bi)) continue;
      out.push(li);
    } else if (ci && !li) {
      if (bi && same(ci, bi)) continue; // yerel sildi
      out.push(ci);
    }
  }
  return out;
}

/** Tek anahtar için üç yönlü birleştirme. */
export function mergeValue(base: unknown, local: unknown, cloud: unknown): unknown {
  if (same(local, cloud)) return local;
  if (local === undefined) return base === undefined ? cloud : (same(cloud, base) ? undefined : cloud);
  if (cloud === undefined) return base === undefined ? local : (same(local, base) ? undefined : local);
  if (base !== undefined && same(local, base)) return cloud;
  if (base !== undefined && same(cloud, base)) return local;
  if (isIdArray(local) && isIdArray(cloud) && (base === undefined || isIdArray(base))) {
    return mergeIdArrays((base as Item[]) ?? [], local, cloud);
  }
  return local;
}

/** Tüm paket için birleştirme. */
export function mergeSyncData(
  base: Record<string, any>,
  local: Record<string, any>,
  cloud: Record<string, any>
): Record<string, any> {
  const out: Record<string, any> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(cloud)]);
  for (const k of keys) {
    const v = mergeValue(base[k], local[k], cloud[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function loadBase(): Record<string, any> {
  try {
    const raw = localStorage.getItem(BASE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* yok say */ }
  return {};
}
function saveBase(data: Record<string, any>) {
  try { localStorage.setItem(BASE_KEY, JSON.stringify(data)); } catch { /* kota dolu olabilir */ }
}

/**
 * Bulut senkronizasyonunu yürütür.
 * Supabase bağlıysa buluttaki son paketle birleştirir, bağlı değilse yerel yedeklemeyi tazeler.
 */
export async function performCloudSync(user: AppUser | null): Promise<SyncResult> {
  const now = Date.now();

  // v-migrate: ilk aktarim raporu (varsa donuse eklenir)
  let migrated: MigrationReport | undefined;
  if (!user) {
    return { success: true, lastSyncedAt: now, message: "Kullanıcı girişi bekleniyor" };
  }

  // Çevrimdışı bağlantı kontrolü
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { success: false, lastSyncedAt: now, message: "İnternet bağlantısı yok (Çevrimdışı)" };
  }

  // 1. Supabase Cloud Sync
  // v-sync: user.id gecerli bir UUID degilse bulut sorgusu YAPMA.
  // Postgres "user_id uuid" kolonu gecersiz degeri 400 ile reddeder; bu durum
  // yerel/misafir profillerinde gereksiz istek firtinasi ve konsol hatasi uretir.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(user.id || ""));
  const supabase = isCloudConfigured && isUuid ? await getSupabase() : null;
  if (supabase) {
    try {
      const localData = exportCurrentData();

      // Buluttaki mevcut kaydı çek
      const { data: cloudRow, error: fetchErr } = await supabase
        .from("user_sync_store")
        .select("data, updated_at")
        .eq("user_id", user.id)
        .maybeSingle(); // v-sync: 0 satir hata sayilmasin (406 onlendi)

      if (!fetchErr && cloudRow?.data) {
        const cloudTime = new Date(cloudRow.updated_at).getTime();
        // Üç yönlü birleştirme: iki tarafın da değişikliği korunur.
        const merged = mergeSyncData(loadBase(), localData, cloudRow.data);

        if (!same(merged, localData)) {
          const changed = importDataToStorage(merged);
          if (changed && typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("yourbook_data_synced", { detail: { updatedAt: cloudTime } }));
            window.dispatchEvent(new Event("notebook-config-changed"));
          }
        }
        if (!same(merged, cloudRow.data)) {
          const { error: upErr } = await supabase.from("user_sync_store").upsert({
            user_id: user.id,
            data: merged,
            updated_at: new Date().toISOString(),
          });
          if (upErr) throw upErr;
        }
        saveBase(merged);
      } else {
        // İlk kayıt veya tablo henüz boş: yereli buluta gönder
        const { error: insErr } = await supabase.from("user_sync_store").upsert({
          user_id: user.id,
          data: localData,
          updated_at: new Date().toISOString(),
        });
        if (insErr) throw insErr;
        saveBase(localData);

        // v-migrate: ILK AKTARIM. Yerel veri buluta tasindi -> rapor uret.
        const migKeys = Object.keys(localData).filter((x) => localData[x] !== undefined);
        let migBytes = 0;
        try { migBytes = JSON.stringify(localData).length; } catch { /* yok say */ }
        migrated = {
          happened: migKeys.length > 0,
          keyCount: migKeys.length,
          bytes: migBytes,
          keys: migKeys.slice(0, 5),
        };

        // v-migrate: raporu GLOBAL olarak yayinla. Kayit aninda App.tsx ile
        // AuthModal arasinda YARIS olusuyor; hangisi once calisirsa calissin
        // kullanici onayi gorebilsin diye event ile duyuruyoruz.
        try {
          window.dispatchEvent(new CustomEvent("yourbook:migrated", { detail: migrated }));
        } catch { /* SSR/ortam yoksa yok say */ }
      }

      localStorage.setItem("yourbook_last_synced_at", String(now));
      return { success: true, lastSyncedAt: now, message: "Bulut ile eşitlendi" , migrated };
    } catch (err: any) {
      console.warn("[SyncEngine] Bulut senkronizasyonunda hata:", err);
      return { success: false, lastSyncedAt: now, message: err?.message || "Eşitleme hatası" };
    }
  }

  // 2. Çevrimdışı / Yerel Çalışma Modu
  localStorage.setItem("yourbook_last_synced_at", String(now));
  return { success: true, lastSyncedAt: now, message: "Yerel depolamada güncellendi" };
}

/** Son senkronizasyon zamanını döndürür */
export function getLastSyncedTime(): number | null {
  try {
    const raw = localStorage.getItem("yourbook_last_synced_at");
    if (raw) return parseInt(raw, 10);
  } catch {}
  return null;
}