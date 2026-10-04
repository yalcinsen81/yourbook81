import enExtra from "./en-extra";


/**
 * ARAYÜZ DİLİ — İngilizce (en)
 * Kaynak (tr) ile bire bir aynı anahtar setine sahip olmalıdır.
 * Marka/kimlik ifadeleri doğrudan çevrilmemiş, anlamı korunacak şekilde uyarlanmıştır.
 */
const en: Record<string, string> = {
  // Genel
  "common.customize": "customize",
  "common.open": "open",
  "common.open_state": "open",
  "common.today": "this month",
  "common.back": "cancel",

  // Sidebar
  "sidebar.desk.section": "study desks",
  "sidebar.desk.new": "new study desk",
  "sidebar.desk.picker.title": "which language do you want to learn?",
  "sidebar.desk.picker.note": "no ready-made word lists — open a desk and add your own words",
  "sidebar.desk.study_desk": "study desk",
  "sidebar.themes": "themes",
  "sidebar.customize.paper": "paper & handwriting",
  "sidebar.customize.action": "customize →",
  "sidebar.profile.guest": "sign in / sign up",
  "sidebar.profile.cloud": "cloud synced",
  "sidebar.profile.local": "local profile",
  "sidebar.profile.device": "saved on this device",
  "sidebar.profile.badge_identity": "IDENTITY",
  "sidebar.profile.badge_login": "SIGN IN",
  "sidebar.search": "search",
  "sidebar.youtube": "youtube archive",
  "sidebar.volumes": "volumes",

  // Cover (Hero)
  "cover.brand": "yourbook",
  "cover.greeting": "hello, diligent soul,",
  "cover.tagline.a": "learning should feel as warm as",
  "cover.tagline.highlight": "opening a notebook",
  "cover.tagline.b": "",
  "cover.tagline.c": "",
  "cover.tagline.d": ".",
  "cover.badges.title": "cover badges",
  "cover.badges.volume": "volume no:",
  "cover.customize": "customize",
  "cover.customize.tip": "Customize your notebook's paper texture, handwriting and stamp",
  "cover.volumes.tip": "See past notebooks and volumes",
  "cover.gift": "gift a notebook",
  "cover.gift.tip": "Gift an empty notebook to a friend",

  // Cover badges (titles)
  "badge.first_journal": "First Page",
  "badge.streak_rhythm": "Rhythm",
  "badge.word_master": "Word Master",
  "badge.word_hunter": "Word Hunter",
  "badge.level_up": "Level 2+",
  "badge.agenda_planner": "Time Keeper",
  "badge.dual_language": "Multilingual",
  "badge.custom_notebook": "Original Notebook",
  "badge.gift_notebook": "Gifted Notebook",

  // Themes
  "theme.theme-cream": "cream orange",
  "theme.theme-mint": "mint green",
  "theme.theme-ocean": "ocean notebook",

  // UI language picker
  "ui_language.title": "interface language",
  "ui_language.tip": "Choose the language the app is displayed in",

  "field.word": "word",
  "field.word_type": "word type",
  "field.note": "note",
  "theme.night.name": "night notebook",
  "theme.night.desc": "Dark brown and navy paper with cream ink",
};
export default { ...en, ...enExtra } as Record<string, string>;
