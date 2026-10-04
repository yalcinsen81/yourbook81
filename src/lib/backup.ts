/**
 * Tüm localStorage verisinin JSON yedeği (export/import).
 * Masaüstü (Tauri) ve tarayıcı ortamında çalışır.
 */

const KNOWN_KEYS = [
  "yourbook_deck_v7_clean", // kelime kartları
  "yourbook_notes_v1", // notlar
  "craft_active_space_taste_v1", // aktif çalışma alanı
  "lexi_engagement_v1", // XP / streak
];

export interface BackupFile {
  app: "lexi-cards";
  version: 1;
  exportedAt: string; // ISO tarih
  data: Record<string, unknown>; // localStorage key → değer
}

export function createBackup(): BackupFile {
  const data: Record<string, unknown> = {};
  for (const key of KNOWN_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
  }
  return {
    app: "lexi-cards",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/** JSON dosyası olarak indir (tarayıcı & Tauri WebView indirme API'si). */
export function downloadBackup(): void {
  const backup = createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = backup.exportedAt.slice(0, 10);
  a.href = url;
  a.download = `yourbook-yedek-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  restoredKeys: string[];
  skippedKeys: string[];
}

/** Yedek dosyasını localStorage'a geri yükler. Mevcut verilerin üzerine yazar. */
export function restoreBackup(backup: BackupFile): ImportResult {
  const restoredKeys: string[] = [];
  const skippedKeys: string[] = [];

  if (backup.app !== "lexi-cards" || !backup.data) {
    return { restoredKeys, skippedKeys };
  }

  for (const [key, value] of Object.entries(backup.data)) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      restoredKeys.push(key);
    } catch {
      skippedKeys.push(key);
    }
  }
  return { restoredKeys, skippedKeys };
}

/** Kullanıcıdan yedek dosyası seçtirir ve dönen içeriği parse eder. */
export function pickBackupFile(): Promise<BackupFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const parsed = JSON.parse(await file.text());
        resolve(parsed as BackupFile);
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}
