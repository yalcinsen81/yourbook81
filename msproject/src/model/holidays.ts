// Türkiye resmî tatilleri (tam gün). Dini bayram tarihleri Diyanet takvimine göre yıllara elle girilir;
// listede olmayan yıllar için kullanıcı Takvim penceresinden ekleyebilir.

export interface Holiday {
  date: string;
  name: string;
}

const FIXED: [mmdd: string, name: string][] = [
  ["01-01", "Yılbaşı"],
  ["04-23", "Ulusal Egemenlik ve Çocuk Bayramı"],
  ["05-01", "Emek ve Dayanışma Günü"],
  ["05-19", "Atatürk'ü Anma, Gençlik ve Spor Bayramı"],
  ["07-15", "Demokrasi ve Millî Birlik Günü"],
  ["08-30", "Zafer Bayramı"],
  ["10-29", "Cumhuriyet Bayramı"],
];

// [ilk gün, gün sayısı, ad]
const RELIGIOUS: [string, number, string][] = [
  ["2026-03-20", 3, "Ramazan Bayramı"],
  ["2026-05-27", 4, "Kurban Bayramı"],
  ["2027-03-09", 3, "Ramazan Bayramı"],
  ["2027-05-16", 4, "Kurban Bayramı"],
];

export function turkishHolidays(fromYear: number, toYear: number): Holiday[] {
  const list: Holiday[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    for (const [mmdd, name] of FIXED) list.push({ date: `${y}-${mmdd}`, name });
  }
  for (const [first, days, name] of RELIGIOUS) {
    const y = Number(first.slice(0, 4));
    if (y < fromYear || y > toYear) continue;
    const d0 = new Date(`${first}T00:00:00Z`).getTime();
    for (let i = 0; i < days; i++) {
      list.push({ date: new Date(d0 + i * 86_400_000).toISOString().slice(0, 10), name: `${name} ${i + 1}. gün` });
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}
