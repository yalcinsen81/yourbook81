import trExtra from "./tr-extra";
/**
 * KAYNAK DİL — Türkçe (tr)
 * Tüm çeviri anahtarlarının referansı budur. Yeni metin eklerken önce buraya yaz.
 * Anahtarlar düz (flat) tutulur; nokta ile gruplanır: "sidebar.themes", "cover.brand" ...
 */
const tr = {
  // ---------- Genel / paylaşılan ----------
  "common.customize": "özelleştir",
  "common.open": "aç",
  "common.open_state": "açık",
  "common.today": "bu ay",
  "common.back": "vazgeç",

  // ---------- Sidebar ----------
  "sidebar.desk.section": "çalışma masaları",
  "sidebar.desk.new": "yeni çalışma masası",
  "sidebar.desk.picker.title": "hangi dili öğrenmek istersin?",
  "sidebar.desk.picker.note": "hazır kelime listesi yok — masayı açıp kendi kelimelerini ekle",
  "sidebar.desk.study_desk": "çalışma masası",
  "sidebar.themes": "temalar",
  "sidebar.customize.paper": "kağıt & el yazısı",
  "sidebar.customize.action": "özelleştir →",
  "sidebar.profile.guest": "giriş yap / kaydol",
  "sidebar.profile.cloud": "bulut senkronize",
  "sidebar.profile.local": "yerel profil",
  "sidebar.profile.device": "cihazda kayıtlı",
  "sidebar.profile.badge_identity": "KİMLİK",
  "sidebar.profile.badge_login": "GİRİŞ",
  "sidebar.search": "ara",
  "sidebar.youtube": "youtube arşivi",
  "sidebar.volumes": "ciltler",

  // ---------- Kapak (Hero) ----------
  "cover.brand": "yourbook",
  "cover.greeting": "merhaba çalışkan insan,",
  "cover.tagline.a": "öğrenmek bir",
  "cover.tagline.highlight": "defter",
  "cover.tagline.b": "açmak kadar",
  "cover.tagline.c": "sıcak",
  "cover.tagline.d": "olmalı.",
  "cover.badges.title": "kapak rozetleri",
  "cover.badges.volume": "cilt no:",
  "cover.customize": "özelleştir",
  "cover.customize.tip": "Defterin kağıt dokusu, el yazısı ve damgasını özelleştir",
  "cover.volumes.tip": "Geçmiş defterleri ve ciltleri gör",
  "cover.gift": "defter hediye et",
  "cover.gift.tip": "Bir dostuna boş bir defter hediye et",

  // ---------- Kapak rozetleri (başlıklar) ----------
  "badge.first_journal": "İlk Sayfa",
  "badge.streak_rhythm": "Ritim",
  "badge.word_master": "Kelime Ustası",
  "badge.word_hunter": "Kelime Avcısı",
  "badge.level_up": "Seviye 2+",
  "badge.agenda_planner": "Zaman Ustası",
  "badge.dual_language": "Çok Dilli",
  "badge.custom_notebook": "Özgün Defter",
  "badge.gift_notebook": "Hediye Defter",

  // ---------- Temalar ----------
  "theme.theme-cream": "krem portakal",
  "theme.theme-mint": "nane yeşili",
  "theme.theme-ocean": "okyanus defteri",

  // ---------- Arayüz dili seçici ----------
  "ui_language.title": "arayüz dili",
  "ui_language.tip": "Uygulamanın görüneceği dili seç",

  "field.word": "kelime",
  "field.word_type": "kelime türü",
  "field.note": "not",
  "theme.night.name": "gece defteri",
  "theme.night.desc": "Derin gece mavisi, kömür kâğıt, kehribar ışık",
};
export default { ...tr, ...trExtra };
