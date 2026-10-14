import { t } from "./i18n";

// Dosya indirme yardımcıları (tarayıcı)

const TR_ASCII: Record<string, string> = { ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U" };

/** Dosya adı: Türkçe harfler ASCII'ye çevrilir (bazı tarayıcılar ASCII olmayan adı "download" yapıyor) */
export function safeFileName(name: string): string {
  return name
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TR_ASCII[c])
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // İndirme başlamadan bağlantı iptal edilmesin
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Proje adından güvenli dosya adı ve uzantı; parçalar " - " yerine "_" ile birleşir */
export function fileNameFor(parts: string[], ext: string): string {
  const base = parts.map(safeFileName).filter(Boolean).join("_") || t("default.fileName");
  return `${base}.${ext}`;
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
