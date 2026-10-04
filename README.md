# yourbook

Cok dilli kelime karti, gunluk, takvim/ajanda ve not defteri uygulamasi.
React 19 + Vite + Tailwind v4 + Supabase (opsiyonel bulut senkronu), PWA.

## Gelistirme
```
npm install
cp .env.example .env   # Supabase anahtarlarini girin (yalnizca publishable/anon)
npm run dev
npm test
npm run build
```

## Klasorler
- `src/` uygulama kodu, `src/i18n/` ceviriler
- `supabase/schema.sql` bulut senkron tablosu + RLS
- `qa/` headless tarayici QA betikleri
- `docs/` notlar ve ekran goruntuleri
- `PROGRESS.md` gelistirme gunlugu ve handoff notlari
