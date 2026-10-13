import { en } from "./en";
import { tr, type MessageKey } from "./tr";

// Arayüz metinleri: yeni eklenen her metin anahtarla (tr + en) yazılır. Dil şimdilik Türkçe; İngilizce modu
// Faz 2'de ayarlanabilir olacak. Saf modüller (MCP sunucusu dahil) de aynı t() işlevini kullanır.

export type Lang = "tr" | "en";
export type { MessageKey };

const DICTS: Record<Lang, Record<MessageKey, string>> = { tr, en };
let current: Lang = "tr";

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

/** "{n} görev" gibi yer tutucular params ile doldurulur. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  const text = DICTS[current][key] ?? tr[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}
