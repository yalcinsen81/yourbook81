export type Lang = string;
export type Article = string;

export interface GrammarRow {
  label: string;
  value: string;
  hint?: string;
}

export interface WordCard {
  id: string;
  lang: Lang;
  article?: Article;
  word: string;
  translation: string;
  note?: string;
  imageUrl?: string;
  grammar?: GrammarRow[];
  tags?: string[];
  createdAt: number;
  /** Dile özgü isteğe bağlı ek alanlar (örn. { artikel: "der", plural: "die Häuser" }).
   *  Yalnızca ilgili dilin LanguageDef.fields tanımı doldurulmuşsa kullanılır. */
  languageFields?: Record<string, string>;
  learnedAt?: number | null;
  reviewAt?: number | null;
  /** Başarılı tekrar sayısı — SRS aralık indeksini belirler (0 = ilk tekrar). */
  reviewCount?: number;
  /** MADDE 5: SRS aralık indeksi. "Hatırlayamadım" bunu 0'a çeker (1 gün).
   *  reviewCount'tan AYRI tutulur; istatistik geçmişi bozulmaz. */
  intervalIndex?: number;
}

export type NoteCategory = "work" | "ideas" | "reminders" | "quotes" | "personal";

export interface PersonalNote {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  imageUrl?: string;
  tags: string[];
  isPinned?: boolean;
  reminderAt?: number | null;
  isAlarmTriggered?: boolean;
  createdAt: number;
  updatedAt: number;
}

/* ============================================================
   HEDEF DİL KAYIT DEFTERİ (Extensible Target-Language Registry)
   Yeni bir öğrenme dili eklemek için buraya bir kayıt eklemek yeterlidir;
   masa oluşturma, kelime kartı alanları ve dil etiketleri buradan türetilir.
   ============================================================ */

export type LanguageFieldType = "text" | "select";

export interface LanguageField {
  /** Kart üzerinde saklanacak anahtar (örn. "artikel", "gender", "tenses") */
  key: string;
  /** Kullanıcıya gösterilen etiket (örn. "Artikel") */
  label: string;
  /** Etiket icin i18n anahtari (opsiyonel) */
  labelKey?: string;
  type: LanguageFieldType;
  /** select tipinde seçenekler */
  options?: string[];
  /** Yer tutucu metin */
  placeholder?: string;
}

export interface LanguageDef {
  /** ISO-639-1 benzeri kısa kod: "de", "en", "es" ... */
  code: string;
  /** Kart üzerinde kullanılan büyük harfli etiket: "DE", "EN", "ES" ... */
  langTag: string;
  /** Türkçe görünen ad: "Almanca", "İngilizce", "İspanyolca" ... */
  name: string;
  /** Gorunen ad icin i18n anahtari (opsiyonel) */
  nameKey?: string;
  /** "Almanca Masası" gibi masa adının çekirdeği */
  deskName: string;
  /** Masa adi icin i18n anahtari (opsiyonel) */
  deskNameKey?: string;
  /** Bayrak / işaret (elle çizilmiş dilde boş bırakılabilir) */
  flag: string;
  /** Masa kapağı ve vurgu rengi */
  accentColor: string;
  /** Masa kapağı CSS sınıfı */
  coverClass: string;
  /** Kısa açıklama (masa kartında gösterilir) */
  description: string;
  /** Aciklama icin i18n anahtari (opsiyonel) */
  descriptionKey?: string;
  /** Seviye aralığı rozeti (örn. "İspanyolca A1-B1") */
  badge: string;
  /** Rozet icin i18n anahtari (opsiyonel) */
  badgeKey?: string;
  /**
   * Bu dile özgü, kart üzerinde tutulacak EK alanlar.
   * Dil değişince alan seti değişir — SRS/XP/oyun mantığı bunlardan bağımsızdır.
   */
  fields: LanguageField[];
}
