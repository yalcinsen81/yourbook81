// Türkçe metinler (varsayılan dil). Anahtar eklerken en.ts'e de ekleyin; tür denetimi eksik anahtarı yakalar.
export const tr = {
  "common.day": "gün",
  "common.empty": "—",
  "common.cancel": "Vazgeç",

  "day.short.0": "Paz",
  "day.short.1": "Pzt",
  "day.short.2": "Sal",
  "day.short.3": "Çar",
  "day.short.4": "Per",
  "day.short.5": "Cum",
  "day.short.6": "Cmt",
  "day.long.0": "Pazar",
  "day.long.1": "Pazartesi",
  "day.long.2": "Salı",
  "day.long.3": "Çarşamba",
  "day.long.4": "Perşembe",
  "day.long.5": "Cuma",
  "day.long.6": "Cumartesi",

  "weight.cost": "maliyet",
  "weight.work": "iş (adam-gün)",
  "weight.duration": "süre",
  "weight.option.cost": "Maliyet",
  "weight.option.work": "İş (adam-gün)",
  "weight.option.duration": "Süre",
  "weight.hint.cost": "Planlanan % = planlanan maliyet / toplam maliyet",
  "weight.hint.work": "Görevler atanan iş miktarıyla (birim × süre) ağırlıklanır",
  "weight.hint.duration": "Görevler iş günü süresiyle ağırlıklanır",

  "warn.taskNoCost": "Maliyeti yok, ilerleme ağırlığı 0",
  "warn.zeroCostTasks": "{n} görevin maliyeti yok, ilerleme ağırlığı 0 (satır {rows}).",
  "warn.weightFallback": "Hiçbir görevde {weight} yok; ilerleme süreye göre ağırlıklandırıldı.",

  "stat.info": "Bilgi",
  "stat.progressTitle": "Girilen % tamamlanmalar, {weight} ağırlığıyla",
  "stat.noCostShort": "{n} görev maliyetsiz",
  "stat.weightFallbackShort": "Ağırlık: süre",

  "charts.weight": "İlerleme ağırlığı",
  "charts.asOf": "{date} itibarıyla · {weight} ağırlıklı",
  "charts.sCurveSub":
    "Planlanan kümülatif ilerleme ({weight} ağırlıklı); nokta, girilen % tamamlanmalara göre bugünkü gerçekleşen (aynı ağırlıkla).",

  "setup.title": "Yeni proje",
  "setup.note": "MS Project'teki gibi takvimi proje başında seçin. Hepsi sonradan Takvim penceresinden değiştirilebilir.",
  "setup.name": "Proje adı",
  "setup.start": "Başlangıç tarihi",
  "setup.weight": "İlerleme ağırlığı",
  "setup.create": "Projeyi oluştur",
  "setup.buttonTitle": "Yeni proje: takvim ve tatilleri seçerek",

  "calendar.buttonTitle": "Proje takvimi: çalışma günleri ve tatiller",
  "calendar.note":
    "Seçili günler çalışılır; listedeki tam gün tatilleri görevler atlar. Yarım günler (arife) iş günü sayılır, yalnızca işaretlenir.",
  "calendar.workdays": "Çalışma günleri",
  "calendar.holidays": "Türkiye tatilleri ({from}–{to})",
  "calendar.official": "Resmî tatiller (Yılbaşı, 23 Nisan, 1 Mayıs, 19 Mayıs, 15 Temmuz, 30 Ağustos, 29 Ekim)",
  "calendar.religious": "Dini bayramlar (Ramazan 3 gün, Kurban 4 gün)",
  "calendar.religiousMissing": "{years} için hazır veri yok; bu yılların bayramlarını Takvim penceresinden kendiniz ekleyin.",
  "calendar.halfDays": "Arifeleri yarım gün olarak işaretle",
  "calendar.halfDaysHint": "Yarım gün iş günü sayılır; Gantt ve takvimde işaretlenir.",
  "calendar.halfDay": "yarım gün",
  "calendar.addPreset": "Hazır Türkiye tatillerinden ekle",
  "calendar.addSelected": "Seçilenleri ekle",
} as const;

export type MessageKey = keyof typeof tr;
