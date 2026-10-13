// Türkiye tatil verisi (yıl bazlı). Sabit tatiller her yıl aynı gündedir; dini bayramlar ay takvimine bağlı
// olduğundan yalnızca Diyanet takviminden doğrulanmış yıllar girilir. Listede olmayan yıllar için kullanıcı
// tarihleri Proje takvimi penceresinden kendisi ekler (tahmini tarih yazılmaz).
// halfDay: yarım gün (arife). Zamanlayıcı yarım günü iş günü sayar; yalnızca takvimde işaretlenir.

export interface HolidayName {
  tr: string;
  en: string;
}

export interface FixedHoliday extends HolidayName {
  /** AA-GG */
  mmdd: string;
  halfDay?: boolean;
}

export interface ReligiousHoliday extends HolidayName {
  /** İlk gün (YYYY-AA-GG) */
  start: string;
  days: number;
  /** Arife adı (bayramdan önceki gün, yarım gün) */
  eve: HolidayName;
}

export const FIXED_HOLIDAYS: FixedHoliday[] = [
  { mmdd: "01-01", tr: "Yılbaşı", en: "New Year's Day" },
  { mmdd: "04-23", tr: "Ulusal Egemenlik ve Çocuk Bayramı", en: "National Sovereignty and Children's Day" },
  { mmdd: "05-01", tr: "Emek ve Dayanışma Günü", en: "Labour and Solidarity Day" },
  { mmdd: "05-19", tr: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", en: "Commemoration of Atatürk, Youth and Sports Day" },
  { mmdd: "07-15", tr: "Demokrasi ve Millî Birlik Günü", en: "Democracy and National Unity Day" },
  { mmdd: "08-30", tr: "Zafer Bayramı", en: "Victory Day" },
  { mmdd: "10-28", tr: "Cumhuriyet Bayramı arifesi", en: "Republic Day eve", halfDay: true },
  { mmdd: "10-29", tr: "Cumhuriyet Bayramı", en: "Republic Day" },
];

const RAMAZAN = { tr: "Ramazan Bayramı", en: "Eid al-Fitr", eve: { tr: "Ramazan Bayramı arifesi", en: "Eid al-Fitr eve" } };
const KURBAN = { tr: "Kurban Bayramı", en: "Eid al-Adha", eve: { tr: "Kurban Bayramı arifesi", en: "Eid al-Adha eve" } };

/**
 * Yıla göre dini bayramlar (Diyanet takvimi). Ramazan 3 gün, Kurban 4 gün; arife bir önceki gündür.
 * 2028 ve 2029: Diyanet Vakit Hesaplama "2028 Dini Günler" (icerik=185) ve "2029 Dini Günler Listesi" (icerik=186)
 * sayfalarındaki tarihler, 2026-10-13'te kontrol edildi. 2030 ve sonrası bilerek yok: kesin tarih girilmeden
 * tahmin yazılmaz, kullanıcı Takvim penceresinden ekler.
 */
export const RELIGIOUS_HOLIDAYS: Record<number, ReligiousHoliday[]> = {
  2026: [
    { start: "2026-03-20", days: 3, ...RAMAZAN },
    { start: "2026-05-27", days: 4, ...KURBAN },
  ],
  2027: [
    { start: "2027-03-09", days: 3, ...RAMAZAN },
    { start: "2027-05-16", days: 4, ...KURBAN },
  ],
  // Arife 25 Şubat 2028 Cuma; Kurban arifesi 4 Mayıs 2028 Perşembe
  2028: [
    { start: "2028-02-26", days: 3, ...RAMAZAN },
    { start: "2028-05-05", days: 4, ...KURBAN },
  ],
  // Arife 13 Şubat 2029 Salı; Kurban arifesi 23 Nisan 2029 Pazartesi (23 Nisan tatiline denk gelir)
  2029: [
    { start: "2029-02-14", days: 3, ...RAMAZAN },
    { start: "2029-04-24", days: 4, ...KURBAN },
  ],
};

/** Dini bayram verisinin son yılı; sonrası için kullanıcı tarihleri elle girer */
export const LAST_RELIGIOUS_YEAR = Math.max(...Object.keys(RELIGIOUS_HOLIDAYS).map(Number));
