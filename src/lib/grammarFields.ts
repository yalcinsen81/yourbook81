/**
 * Deki/grammar alan etiketleri icin i18n anahtar eslemesi.
 * demo kart verisindeki (deck.ts) Turkce/dil-bagimsiz "label" degerlerini
 * arayuz diline cevirmek icin kullanilir.
 */
export const GRAMMAR_FIELD_KEY: Record<string, string> = {
  "Präsens": "gf.praesens",
  "Präteritum": "gf.praeteritum",
  "Perfekt": "gf.perfekt",
  "Edat": "gf.edat",
  "Örnek": "gf.ornek",
  "Kalıp": "gf.kalip",
  "Sıfat": "gf.sifat",
  "Deyim": "gf.deyim",
  "Eş Anlam": "gf.es_anlam",
  "Zıt Anlam": "gf.zit_anlam",
  "İsim Hali": "gf.isim_hali",
  // languages.ts GRAMMAR_FIELDS etiketleri (v65'te eksikti -> TR sizinti)
  "Çoğul": "field.plural",
  "Tür": "field.pos",
  "Zaman / Çekim": "field.tenses",
  "Cinsiyet (el/la)": "field.gender",
  "Çekim": "field.conjugation",
  "Artikel": "field.artikel",
};
