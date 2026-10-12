# Proje Planlayıcı (MS Project klonu)

Tarayıcıda çalışan, MS Project benzeri görev planlama uygulaması. React 19 + Vite + TypeScript; sunucu yok,
veri tarayıcıda (localStorage) otomatik saklanır, JSON olarak indirilip geri açılabilir.

## Özellikler (v0.1)
- Görev tablosu: WBS, ad, süre (iş günü), başlangıç, bitiş, öncüller, % tamamlanma, toplam bolluk
- Özet görevler (girintile / girintiyi azalt), alt görevleri gizle/göster, kilometre taşları (süre 0)
- Bağımlılıklar: FS, SS, FF, SF ve gecikme/öne çekme (`2`, `3SS`, `4FS+2g`, `5FF-1g`; Türkçe `BB`, `BşBş` de olur)
- Zamanlama motoru: kritik yol yöntemi (ileri/geri geçiş), toplam bolluk, kritik yol kırmızı
- "Şundan önce başlamasın" kısıtı (Başlangıç hücresine tarih yazınca; silince kalkar)
- Döngü ve özet–alt görev bağı engellenir
- Gantt şeması: gün/hafta/ay ölçeği, hafta sonu gölgesi, bugün çizgisi, bağlantı okları, ilerleme çubuğu
- Geri al / yinele, JSON aç/kaydet, örnek inşaat projesi
- Kısayollar: Insert (görev ekle), Delete (sil), Alt+Shift+→/← (girinti), Ctrl+F2 (bağla), Ctrl+Z / Ctrl+Y

Takvim: Pazartesi–Cuma iş günü. Resmî tatiller henüz yok.

## Geliştirme
```
cd msproject
npm install
npm run dev        # http://localhost:5173
npm test           # zamanlama motoru testleri
npm run typecheck
npm run build
```

## Yapı
- `src/model/` saf mantık (testli): `calendar.ts` iş günü takvimi, `schedule.ts` CPM motoru,
  `predecessors.ts` öncül metni, `outline.ts` girinti/WBS, `storage.ts` kayıt ve dosya doğrulama
- `src/components/` `TaskGrid` (tablo), `Gantt` (SVG şema), `EditableCell`
- `src/useProject.ts` durum + geri al geçmişi
