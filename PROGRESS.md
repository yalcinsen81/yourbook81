# yourbook — Geliştirme İlerleme Raporu (Progress.md)
*Son Güncelleme: yourbook v41.1 — Noktalama 7 dilde + hızlı kaydetme + teşhis sayfaları kaldırıldı*
*Canlı URL: https://yourbook-app.vercel.app/*

---

## 🔴 0. YENİ CHAT İÇİN ÖNCE OKU (Handoff)

### Proje Konumu
- **Gerçek kaynak dizin:** `C:\Users\yalci\CodeGPT\lexi-cards`
- **Workspace kökü** (`c:\Users\yalci\CodeGPT\saas-project`) bu proje DEĞİLDİR; orada sadece `progress.md` ve geçici yardımcı scriptler tutulur.
- **Dosya düzenleme araçları (`read`, `edit_file`) workspace köküne sandbox'lıdır ve `lexi-cards`'a erişemez (403 döner).** Bu yüzden TÜM `lexi-cards` düzenlemeleri PowerShell / Node scriptleri ile (`execute_terminal_command`) yapılmalı: dosyayı `[System.IO.File]::ReadAllText($p,[Text.Encoding]::UTF8)` ile oku, `.Replace(...)` yap, `New-Object System.Text.UTF8Encoding($false)` ile (BOM'suz) yaz.

### Zorunlu Doğrulama Döngüsü (her değişiklikten sonra)
1. `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH` (npm/npx PATH'te değil!)
2. `npx tsc --noEmit`  → **0 hata olmalı**
3. `npm test` → **210/210 geçmeli** (23 test dosyası)
4. `npm run build`
5. `npx vercel --prod --yes` → çıktıdan `yourbook-<hash>.vercel.app` URL'ini al
6. Alias'ları bağla (3 komut): `npx vercel alias set yourbook-<hash>-yalcin4.vercel.app yourbook-app.vercel.app` (ve `yourbook-defter`, `yourbook3`)
7. **Headless tarayıcı ile gözle doğrula** (aşağıya bak)

### Headless Tarayıcı Doğrulama
- Skill: `C:\Users\yalci\.codegpt\skills\browser-automation\SKILL.md`
- Komut: `node "C:\Users\yalci\.codegpt\skills\browser-automation\browser.mjs" "https://yourbook-app.vercel.app/" --script "C:\Users\yalci\CodeGPT\saas-project\qa.mjs" --screenshot "...\x.png"`
- Script `export default async function run(page, ui)` döner; `ui.click('@eN')`, `page.evaluate(...)`, `await ui.snapshot()` kullanılır.
- **Ekran görüntüsünü bizzat `read` ile oku ve gözle değerlendir.** Sadece DOM ölçümüne güvenme.
- **DİKKAT — `--eval` bazen YANLIŞ projeye (`VarlıkTakip`/finans app) gidebiliyor.** Her zaman açık URL ver ve `--script` kullan.

### KRİTİK TUZAKLAR (geçmişte saatler kaybettiren)
> ℹ️ **Güvenlik notu:** v27'deki "Supabase service-role anahtarı sızıntısı" uyarısı **yanlış alarmdı**; v39.1'de çürütüldü (§9). Yeniden kovalamayın — `.env` boş, canlı bundle temiz.
1. **CRLF tuzağı:** `lexi-cards` dosyaları CRLF'dir. `replace(/\n};\n\nexport default/)` gibi LF anchor'ları **eşleşmez** → anahtarlar sessizce eklenmez. Daima `\r\n` kullan ya da satır-satır (satır indeksi) düzenle.
2. **Toplu regex değiştirme kodu bozar:** `>metin<` → `t()` dönüşümünü kör regex'le yapma; `"metin"` → `{t()}` dönüşümü obje/ternary/alert içine JSX sızdırıp kodu kırar. **Nokta atışı tam-string `.Replace()` kullan**, her seferinde `tsc` ile doğrula.
3. **Satır indeksi kayması:** Bir dosyada ardışık satır-bazlı düzenleme yaparken indeksler kayar. Her düzenlemeden sonra dosyayı **yeniden oku**, indeksleri tazele.
4. **Module-scope `t()` yasak:** `t()` yalnızca React bileşeninin içinde (hook ile) çağrılabilir. `MOODS`, `WRITING_PROMPTS`, `MONTH_NAMES_TR`, `TIME_PERIOD_META`, `GREETINGS_*` gibi **modül seviyesindeki** dizilerde `t()` kullanılamaz → bu dizileri literal bırak, **render sırasında** (bileşen içinde) `t()` ile çevir.
5. **Geçersiz Tailwind sınıfı:** `border-[var(--ink)]` tek başına çizgi çizmez; `border` (genişlik) sınıfı da gerekir. **`border-1.5` Tailwind v4 ölçeğinde YOK → hiç CSS üretmez, çizgi görünmez.** Doğrusu `border-[1.5px]` (v26'da 50 tanesi düzeltildi).
6. **`String.replace(re, () => ...)` fonksiyon geri çağrımı `$1` GENİŞLETMEZ:** RTL dönüşümünde bu yüzden literal `ps-$1` yazıldı. Ya `out.replace(re, "ps-$1")` (string) ya da callback'te `(m, p1) => "ps-" + p1` kullan.
7. **Locale anahtar ekleme (GÜVENLİ YOL):** Anchor'ı `"  \"key\"` olarak almak, anahtarın DEVAMINI (`, "deger"`) bulup BÖLER. Bunun yerine: dosyayı satırlara ayır → kapanış `};` satırını bul → **son anahtara virgül garantile** → kapanıştan ÖNCE yeni satırları `splice` ile ekle. (`saas-project/add-keys.mjs` şablonu.)
8. **i18n stale state / useMemo:** `t()` sonucunu `useState`'e yazmak veya `useMemo` içinde `t()` çağırıp bağımlılık dizisine `t`/`lang` koymamak → dil değişince metin ESKİ dilde kalır. Ya `textKey` sakla + render'da `t(key)` çağır, ya da `t`'yi bağımlılığa ekle. (v26'da 2 gerçek bug bu sınıftandı.)

---

## 📌 1. Proje Özeti ve Mimari Temel

- **Teknoloji Yığını:** React 19, Vite, Tailwind CSS, Framer Motion, Web Audio API (sentetik ses sentezi), TypeScript, Vitest.
- **Canlı Dağıtım:** Vercel → `yourbook-app.vercel.app`, `yourbook-defter.vercel.app`, `yourbook3.vercel.app`
- **Karakter Kodlaması:** %100 UTF-8 (BOM'suz), sıfır mojibake.
- **İkonografi:** %100 SVG monokrom el çizimi (sketch) seti (`sketchIcons.tsx`, `sketchBadges.tsx`, `doodle.tsx`). Sıfır emoji.
- **Test/Tip:** `npx tsc --noEmit` (0 hata) & `npm test` (**210/210**, 23 test dosyası).
- **Diller (v39.1):** arayüz dili **tr / en / de / es / fr / it / ar** = **7 dil**. Kaynak = `tr` (**1095 anahtar**). (`pt`/`ru`/`nl` çevirileri hazır ama listede değil.) `ar` tek RTL dil. **10 dilin** her biri tr ile **birebir aynı anahtar setine** sahip (testli).
- **Kenarlık Dili (v25):** Tüm ana paneller ve günlük panelleri **siyah** kenarlıklı (`var(--ink)` = `#1c1917`). Hover'da siyah kalır (turuncuya dönmez).

---

## 📂 2. Önemli Dosyalar ve Rolleri

| Dosya | Rol |
|---|---|
| `src/lib/spaces.ts` | Çalışma masaları (sabit + kullanıcı tanımlı). `CraftSpace` artık `languageCode` taşır. `createLanguageSpace()`, `useSpaces()` (→ `addLanguageSpace`, `languageSpaceExists`). |
| `src/lib/languages.ts` | **Hedef dil kayıt defteri** (`LANGUAGES`): de, en, es. Yeni dil = tek kayıt ekle. |
| `src/lib/types.ts` | `Lang = string`, `Article = string`, `LanguageDef`, `LanguageField`, `WordCard.languageFields?` |
| `src/lib/deck.ts` | Kart destesi + SRS. `getCardsForSpace(spaceId, spaceLangTag?)` genelleştirilmiş. |
| `src/lib/notebookConfig.ts` | Rozet/milestone, kağıt dokusu, el yazısı, ses, ritüel. `getNotebookAgeTier()`, `TIME_PERIOD_META` (artık `labelKey`/`descriptionKey`), `getOpeningRitualGreeting()` (artık `textKey` döner). |
| `src/i18n/` | **Arayüz dili (i18n)**: `index.ts` (`translate`, `UI_LANGUAGES`, `DICTS`), `I18nProvider.tsx` (`useT()` → `{t, lang, dir, setLang}`), kaynak `locales/tr.ts`+`tr-extra.ts`, çeviriler `en/de/es/pt/ar` × (`<code>.ts` + `<code>-extra.ts`). Her çeviri tr ile **birebir aynı anahtar setine** sahip olmalı (testli). |
| `src/components/JournalMoodTrend.tsx` | **Haftalık duygu trendi** (mürekkep eğrisi, SVG polyline + boş gün segmentleri). v26. |
| `src/components/JournalSpread.tsx` | **Defter çift sayfa** okuma + **düzenleme** modu — spine, sayfa çevirme, klavye, satır içi `textarea` + ruh hali seçici + kaydet/vazgeç, veri kaybı koruması. v26/v29. |
| `src/lib/journalAgendaLink.test.ts` | Ajanda ↔ günlük çapraz bağlantı tarih mantığı testleri (9 test). v29. |
| `src/lib/journalHeatmap.test.ts` | Isı haritası gün seçimi + klavye gezinme testleri (6 test). v32. |
| `src/components/JournalYearCompare.tsx` | **Yıllık yazma karşılaştırması** — ölçekli çubuklar, aylık mini histogram, tıkla→ısı haritası senkronu. v38. |
| `src/lib/journalYearCompare.test.ts` | `calculateYearComparison` testleri (9 test). v38. |
| `src/components/AlarmAlert.tsx` | Hatırlatıcı alarm kartı — **"günlüğe yaz"** aksiyonu (`onOpenJournal`) + i18n. v32. |
| `public/sw.js` | Service Worker: offline cache (`yourbook-pwa-v3`), **aksiyonlu** alarm bildirimi (`aç` / `ertele`), `notificationclick` + `message(SHOW_ALARM)`. v26. |
| `src/components/JournalHeatmap.tsx` | **Yıllık katkı ısı haritası** (53×7, turuncu yoğunluk merdiveni, yıl sekmeleri, tıkla→güne git). v27. |
| `src/lib/useSpeechDictation.ts` | **Sesli dikte** (Web Speech API sarmalayıcı; kesinleşen + ara metin, dil→locale). v27. |
| `src/components/VolumeCompleteBanner.tsx` | **Cilt doluluk bandı** — otomatik geçiş önerisi (`advanceToNextVolume` + arşiv). v27. |
| `supabase/schema.sql` | **`user_sync_store` tablosu + RLS politikaları + trigger.** Supabase SQL Editor'de bir kez çalıştırılmalı. v27. |
| `.env.example` | Ortam değişkeni şablonu — **publishable/anon** anahtar uyarısıyla. v27. |
| `src/components/LovableInspector.tsx` | **Tasarım/UI öğe seçici** (Alt+I) — sayfa içi öğe seçer, dosya+açıklama çıkarır, sohbete yapıştırılacak prompt kopyalar. **Ctrl/⌘ ile çoklu seçim** destekler (v40.1). Geliştirici aracı; i18n'e tabi değil. |
| `src/components/SuperrHero.tsx` | Ana sayfa (hero). Selamlama + gülen yüz SVG + kıvrık ok + masa panelleri + haftalık ritim + panel kartları. |
| `src/components/SuperrSidebar.tsx` | Sol menü: bölümler, masalar, temalar, arayüz dili seçici, profil, "yeni çalışma masası" akışı + dil seçici modal. |
| `src/components/StudyDesk.tsx` | Kelime masası sayfası (üst başlık çerçevesi v25'te düzeltildi: `min-h-[80px]`, `border-b border-[var(--ink)]`, ikon kutusu `border`). |
| `src/components/JournalView.tsx` | "Sevgili günlük": 3 sekme (yaz/akış/duygu pusulası), ruh hali çipleri, ilham istemi, PIN, yazı alanı, OCR/PDF butonları. |
| `src/components/JournalMoodRadar.tsx` | Ruh hali pusulası + aylık takvim matrisi. |
| `src/components/CoverStickerCluster.tsx` | 9 kapak rozeti (postit). |
| `src/components/GiftNotebookModal.tsx` | Defter hediye et modalı. |
| `src/components/VolumeArchiveModal.tsx` | Cilt arşivi modalı. |
| `src/components/NotebookCustomizeModal.tsx` | "defterimi özelleştir" paneli (kağıt/el yazısı/ses/mühür/cilt/ışık sekmeleri) + El Yazısı Atölyesi tetikleyicisi. |
| `index.html` | `<html lang="en">` + İngilizce `<title>` (pre-mount). Runtime'da i18n günceller. |

---

## ✅ 3. Bu Oturumlarda Tamamlananlar (özet)

### v41.1 — Noktalama 7 dilde, hızlı kaydetme, teşhis temizliği

#### 1) Noktalama motoru 7 ARAYÜZ DİLİNİN TAMINI destekliyor
v41.0'da yalnızca Türkçe kurallarla yazılmıştı. Artık dil başına kural seti var ve **arayüz dilini otomatik izliyor**:

| Arayüz dili | Tanıma (BCP-47) | Soru işareti | Büyük harf |
|---|---|
| 🇹🇷 Türkçe | `tr-TR` | `?` | Türkçe kurallı (i→İ, ı→I) |
| 🇬🇧 İngilizce | `en-GB` | `?` | standart |
| 🇩🇪 Almanca | `de-DE` | `?` | standart |
| 🇪🇸 İspanyolca | `es-ES` | `?` | standart |
| 🇫🇷 Fransızca | `fr-FR` | `?` | standart |
| 🇮🇹 İtalyanca | `it-IT` | `?` | standart |
| 🇸🇦 Arapça | `ar-SA` | **`؟`** | **yok** (dilde büyük/küçük harf ayrımı yok) |

Her dilde çalışanlar: **söylenen noktalama** ("nokta"/"full stop"/"punkt"/"punto"/"point"/"نقطة" → `.`), **soru sezgisi**, **cümle başı büyük harf**, **uzun akış bölme** (dil başına bağlaçlar: ve/and/und/y/et/e/و).

**Bu turda düzeltilen 2 gerçek hata:**
1. **Türkçe soru sözcüğü cümle ORTASINDA olabiliyor** ("bugün hava **nasıl**") — yalnızca ilk kelimeye bakan mantık bunu kaçırıyordu. Artık tek anlamlı soru sözcükleri (`nasıl/neden/how/why/comment/perché/كيف`) cümle içinde de aranıyor; `ne/que/che` gibi hem soru hem bağlaç olabilenler **hariç** (yanlış pozitif önleme).
2. **Arapça'da `\b` kelime sınırı çalışmıyor** — Arapça yazı için JS regex `\b` güvenilmez. Beyaz boşluk sınırına geçildi.

#### 2) Uzun akış bölmede sade dizgi hatası riski
İki nokta / tırnak aç-kapa kalıpları **kaldırıldı** — Türkçe'de yanlış tetiklenme riski yüksekti. Kalan kalıplar: `nokta`, `virgül`, `soru işareti`, `ünlem`, `yeni satır`.

#### 3) Dikte kaydetme gecikmesi 750ms → **250ms**
Cümle kesinleşince neredeyse anında kaydediliyor. Normal (elle) yazmada 750ms debounce **korundu** — orası doğru değer.

#### 4) Teşhis sayfaları kaldırıldı
`public/` altından silindi: `mic-kesin.html`, `mic-ses-testi.html`, `mic-test.html`, `mikrofon-dene.html`, `mikrofon-teshis.html`, `ses-teshis.html`. `dist/` artık yalnızca `index.html` içeriyor.
*(Mikrofon sorunu bir daha yaşanırsa: tarayıcıda `chrome://settings/content/microphone`, Windows'ta Gizlilik → Mikrofon → "Masaüstü uygulamaları" kontrol edilir. Teşhis mantığı bu oturumun geçmişinde kayıtlı.)*

#### Testler
**253/253** (27 dosya). Bu sürümde eklenen:
- `dictationPunctuation.i18n.test.ts` → **10 test** — 7 dilin tamamında nokta, soru işareti (Arapça `؟` dahil), söylenen noktalama, yanlış-pozitif yokluğu, Arapça'da büyük harf YAPILMAMASI, bilinmeyen dilde Türkçe'ye düşme
- `dictationPunctuation.test.ts` → 18 test (dil parametreli)
- `useSpeechDictation*.test.ts` → 15 test

`npx tsc --noEmit` **0 hata** · `npm run build` başarılı · `dist/` temiz

#### Canlı doğrulama (7 dil, headless)
| Dil | Buton | Etiket | Yön |
|---|---|
| tr | ✅ | `sesle yaz` | ltr |
| en | ✅ | `dictate` | ltr |
| de | ✅ | `diktieren` | ltr |
| es | ✅ | `dictar` | ltr |
| fr | ✅ | `dicter` | ltr |
| it | ✅ | `dettare` | ltr |
| ar | ✅ | `إملاء صوتي` | **rtl** |

7/7 dilde `data-dictation-supported="1"`, **0 konsol hatası, 0 başarısız istek**.

### v41.0 — Sesle Yazma: Kök Neden Çözümü + Noktalama Motoru

**SONUÇ: sesle yazma çalışıyor.** Kök neden uygulama DEĞİL, Windows mikrofon ayarıydı.

#### Kök neden zinciri (sırayla çözülen)
1. **Hata mesajı hiç gösterilmiyordu** → `dictation.error` tutuluyor, render edilmiyordu. İzin/mikrofon/ağ hatalarında kullanıcı hiçbir şey görmüyordu.
2. **Buton, destek yokken tamamen gizleniyordu** (`{supported && <button>}`) → artık her zaman görünür, gerekiyorsa `disabled` + tooltip'te sebep.
3. **İzin diyaloğu hiç açılmıyordu** → `SpeechRecognition` izin yoksa sormadan `not-allowed` dönüyor. Artık başlatmadan önce `getUserMedia` ile izin isteniyor.
4. **Canlı yazmıyordu** → `onInterim` hiç bağlanmamıştı; ara metin yazı alanına akmıyordu. Artık akıyor.
5. **Stale closure** → `onFinal` içinde `currentText` eski değeri görüyordu, ikinci cümle birincinin üzerine yazıyordu. Temel metin `dictationBaseRef`'te.
6. **`fr`/`it`/`ru`/`nl` LANG_LOCALE'da eksikti** → `en-GB`'ye düşüp yanlış dilde dinliyordu.

**Gerçek sebep:** Windows'un mikrofon ayarı. Teşhis zinciri:
- Tarayıcı `enumerateDevices()` → **0 cihaz** (hata yok, boş liste)
- Windows registry: `ConsentStore\microphone\NonPackaged` → Chrome kaydı **var**, `Allow`
- Chrome profili: `yourbook-app.vercel.app` için **izin verilmiş**
- **Kullanıcı testi:** 3 mikrofon bulundu, `getUserMedia` açıldı, 2 eşzamanlı akış açıldı → **donanım sağlam**
- **Canlı seviye ölçümü:** zirve **242/255**, 147/154 ölçümde ses, hoparlör testi **+141** → **mikrofon mükemmel çalışıyor**
- Sonuç: kullanıcı mikrofon iznini verip yeniledikten sonra **çalıştı**.

#### YENİ: Noktalama motoru (`src/lib/dictationPunctuation.ts`)
**Sorun:** Web Speech API noktalama ÜRETMEZ — sadece düz kelime dizisi döner (*"merhaba nasılsın bugün hava güzel"*). Türkçe'de özellikle zayıf.

Çözüm — bilinçli olarak **dil modeli kullanmayan**, sadece güvenli kurallarla çalışan bir katman:
- **Söylenen noktalama:** "nokta" → `.`, "virgül" → `,`, "soru işareti" → `?`, "yeni satır" → satır sonu (10 kalıp). Kelime ortasında yakalanmaz ("nokta**lar**" korunur).
- **Soru sezgisi:** soru sözcüğüyle başlayan (`neden/nasıl/nereye/kim/kaç...`) veya `mi/mı/mu/mü` ile biten cümleler `?` alır.
- **Büyük harf:** cümle başı büyütülür; **Türkçe kurallı** (`i→İ`, `ı→I`) — `toLocaleUpperCase("tr")`.
- **Uzun akış bölme:** 34 kelimeyi geçen, hiç noktası olmayan akışlar bağlaçlardan (`ve/ama/çünkü/sonra/yani`) satırlara bölünür.
- **Güvenli varsayılan:** ara (interim) sonuçlara **cümle sonu işareti eklenmez** (cümle devam ediyor olabilir); emin olunmayan yerde hiçbir şey yapılmaz. **Idempotent** — iki kez işlemek sonucu değiştirmez.

**Örnekler (test edilmiş):**
| Giriş | Çıkış |
|---|---|
| `bugün hava güzel` | `Bugün hava güzel.` |
| `geldin mi` | `Geldin mi?` |
| `neden gelmedin` | `Neden gelmedin?` |
| `merhaba nokta bugün hava güzel nokta` | `Merhaba. Bugün hava güzel.` |
| `istanbul güzel` | `İstanbul güzel.` |
| `bugün hava` *(ara, sonuç açık)* | `Bugün hava` *(nokta yok)* |

#### Testler
- **243/243** (25+ dosya). Bu sürümde eklenenler:
  - `dictationPunctuation.test.ts` → **18 test** (söylenen noktalama, soru sezgisi, Türkçe büyük harf, uzun akış bölme, idempotency)
  - `useSpeechDictation.live.test.ts` → **7 test** (interim akışı, final kaydetme, Chrome interim→final dizisi, çok cümleli akış, sessizlikte yeniden başlatma, kullanıcı durdurunca durma)
  - `useSpeechDictation.test.ts` → **8 test** (hata eşlemesi, dil yerelleri, clearError)
- `npx tsc --noEmit` **0 hata** · `npm run build` başarılı (1.56 MB)

#### Canlı
**https://yourbook-app.vercel.app** (+ `yourbook-defter`, `yourbook3`) — tüm alias'lar v41.0'ı servis ediyor.

**Not — teşhis araçları:** `public/` altında kalıcı teşhis sayfaları bırakıldı:
- `mic-kesin.html` — cihaz listesi + seviye ölçer + meşguliyet testi
- `mic-ses-testi.html` — canlı seviye/dBFS ölçer + hoparlör-geri-besleme testi
- `mikrofon-dene.html`, `mikrofon-teshis.html`, `ses-teshis.html` — kademeli teşhis
Bunlar gelecekte mikrofon şikâyetlerinde ilk başvurulacak araçlar.

### v40.1 — Lovable Inspector: Çoklu Seçim (Ctrl/⌘) + Canlıya Alma

**Yeni özellik: çoklu panel seçimi.** Seçim modunda **Ctrl** (Windows/Linux) veya **⌘ Command** (Mac) basılı tutup tıklayınca öğe **seçime eklenir** ve modal **açılmaz** — böylece yan yana paneller, kartlar, başlık + alt metin gibi birden çok öğe tek seferde toplanıp **tek talimatta** birleştirilir.

- `selectedTarget` (tek) → `selected: InspectedElement[]` (dizi) + `isModalOpen` (ayrı bayrak).
- **Ctrl/⌘ + tıklama:** seçime **ekle/çıkar** (toggle), mod açık kalır, modal açılmaz.
- **Düz tıklama:** toplanmış öğeler **korunur** ve modal açılır (toplanmış yoksa yalnız o öğe seçilir).
- Toplanan öğeler sayfada **turuncu kesikli çerçeveyle** işaretlenir (`data-lovable-marked`); scroll/resize'da konum tazeleme var.
- Buton metni artık sayacı gösterir: **"Seçim Modu Açık · 2 öğe"**.
- Modal, çoklu modda **"N öğe seçildi / tek talimatta birleştirilecek"** başlığı + **numaralı liste** gösterir; her öğe **× ile tek çıkarılabilir** (son öğe çıkınca modal kapanır).
- Prompt formatı çoklu için değişir:
  ```
  [SEÇİLEN 3 ÖĞE]
  1. Başlık: "..." — src/components/... (H2 seviyesinde metin başlığı)
  2. Buton: "..." — src/components/... (tıklanabilir buton)
  Yapılacak Değişiklik / Hata: <kullanıcı metni>
  ```
- Çoklu seçime uygun **2 yeni şablon**: "Öğeleri birbiriyle hizala", "Aralarındaki boşluğu eşitle" (toplam 8).
- Metinler çoklu modda çoğullaşır ("Bu **öğelerde** neyi değiştirmemi istersin?", "**N öğe** tek talimatta kopyalanır").
- **Escape:** önce modalı, sonra modu kapatır.
- Öğe referansı `InspectedElement.el` (**hassas DOM referansı**) olarak saklanır; işaret kutusu konumu `findRect`/`querySelectorAll` ile yeniden aramaya gerek kalmadan doğrudan bu referanstan okunur (daha güvenilir, etiketsiz öğelerde de çalışır).

**Canlıda doğrulandı (headless, `yourbook-app.vercel.app`):**
- Alt+I → `"Seçim Modu Açık (Ctrl ile çoklu seç)"`.
- **Ctrl + tıklama ×2** → modal **kapalı kaldı**, sayaç `2 öğe`, **2 turuncu işaret kutusu**.
- Düz tıklama → modal açıldı, başlık **"2 öğe seçildi"**, liste: `1. Öğe <span>: "sıcak"`, `2. Buton: "tüm notlar"`.
- **× ile bir öğe çıkarma** → liste kapandı, modal açık kaldı, başlık kalan öğeye döndü: `Buton: "tüm notlar"` (kalan öğe **silinmedi**, doğrulandı).
- **0 konsol hatası / 0 başarısız istek.**

**Test & derleme:** `npx tsc --noEmit` **0 hata** · `npm test` **210/210** · `npm run build` başarılı.

**Canlı URL'ler (bu sürümü servis ediyor):**
- https://yourbook-app.vercel.app
- https://yourbook-defter.vercel.app
- https://yourbook3.vercel.app

### v40.0 — Lovable Inspector + Ölü Kod Temizliği (bu oturum)

**1) `LovableInspector` devreye alındı (tasarım/UI için sayfa içi öğe seçici):**
- Bileşen yedekten (`_lexi-cards_v66_deadcode_*`) **projeye uyarlanarak** yeniden yazıldı (`src/components/LovableInspector.tsx`, 381 satır).
- **Alt+I** (veya sağ alttaki buton) ile seçim modu açılır. Fare öğe üzerine gelince **vurgu kutusu** + etiket; tıklayınca öğe bilgisi yakalanır (isim + dosya + açıklama). Kullanıcı ne istediğini yazar, **"Talimatı Kopyala"** ile sohbete yapıştırılacak prompt panoya kopyalanır.
- **Projeye uyarlama (eski kopya uyumsuzdu):** lacivert `#1e2942` → `var(--ink)`, sarı `#ffc934` → `var(--accent)` (#ff6f1e), `#fffdf8` → `var(--paper)`, `btn-midnight` → `btn-pill-orange`, var olmayan `opennote-card` algılaması → `journal-card` / `superr-panel-card` / `aside` / `nav`.
- **Genişletilmiş algılama:** h1-h6, img/svg, input/textarea/select, `role=button`, günlük kartı, panel kartı, menü öğesi.
- `data-lovable-target` / `-name` / `-file` / `-desc` / `-ignore` etiketleriyle elle işaretleme destekli. `document.body`'ye portal ile render edilir (fixed katman transform'dan etkilenmesin).
- i18n: arayüz metinleri Türkçe (geliştirici aracı; kullanıcıya değil geliştiriciye hitap ediyor).

**Canlıda doğrulandı (headless, port 5211):**
- Buton görünür: `"Öğe Seç & Düzenle"` + `Alt+I` rozeti.
- **Alt+I** → `"Seçim Modu Açık (öğeye tıkla)"` (aktif durum siyah dolgu + turuncu halka).
- Hover → vurgu kutusu çizilir, etiket çıkar (`Görsel / ikon`, `Öğe <span>: "sıcak"`).
- Tıklama → modal açılır: başlık `Öğe <span>: "sıcak"`, alt bilgi `src/components/... — metin veya arayüz öğesi`.
- **6 hızlı şablon** + serbest metin kutusu; şablona tıklayınca metne eklenir (`"Rengini değiştir"`).
- **"Talimatı Kopyala"** → buton `"Kopyalandı!"` durumuna geçer (handler çalışıyor), ~1.5 sn sonra modal + mod otomatik kapanır.
- **Escape** seçimi/modu kapatır. **0 konsol hatası / 0 başarısız istek.**
- Ekran görüntüsü gözle incelendi: palet (siyah + turuncu) ve tipografi sayfayla uyumlu.

**2) Ölü kod temizliği:**
- `src_copy/` klasörü **silindi** (6 dosya: `CollectionsView`, `DailyNotesView`, `OffBrandSidebar`, `OpennoteHero`, `lib/spaces.ts`, `lib/themes.ts`).
- Silmeden önce doğrulandı: **hiçbir yerden referans edilmiyor**, `tsconfig.json` yalnızca `src`'yi include ediyor.
- Yedek: `C:\Users\yalci\CodeGPT\_lexi-cards_srccopy_removed_20260919`.
- Backlog'daki "ölü bileşenler" (`OpennoteSidebar`, `OffBrandHero`, `OffBrandSidebar`, `PanelSwitcher`, `CraftSidebar` vb.) **`src/` içinde zaten yoktu** — yalnızca `_lexi-cards_dead_backup_*` / `_lexi-cards_v66_deadcode_*` yedeklerinde duruyorlar. İstenirse o yedek klasörleri de silinebilir.
- `LovableInspector` **silinmedi, devreye alındı** (yukarıdaki madde 1).

**Doğrulama:** `npx tsc --noEmit` **0 hata** · `npm test` **210/210** · `npm run build` başarılı (1.63 MB).

### v39.0 — Fransızca + İtalyanca Arayüz Dili (bu oturum)
**Durum:** fr ve it çevirileri zaten mevcuttu (56557 / 54538 bayt) ama **arayüz dil listesinde (UI_LANGUAGES) değillerdi** — DICTS'te kayıtlı ama seçilemez durumdaydılar.
- `UI_LANGUAGES` genişletildi: **tr, en, de, es, fr, it, ar** (7 dil). fr ve it `dir: "ltr"`.
- `DICTS` kaydı zaten `fr`/`it` içeriyordu; import satırları (9 ve 11) doğruydu.
- **Eski/bayat yorum düzeltildi:** "pt/ru/nl/fr/it ARAYUZ dili DEGIL" diyen satırlar artık gerçeği yansıtıyor (yalnızca pt/ru/nl gizli; fr/it eklendi).
**Anahtar parity:** 10 dilin **hepsi tr ile birebir 1095/1095 anahtar** — 0 eksik, 0 fazla (vite SSR ile ölçüldü).
**Testler:** `i18n.test.ts` → **24 test** (22'den). 2 yeni test: (1) fr/it `UI_LANGUAGES`'te seçilebilir ve `ltr`, (2) `app.title` + `journal.tab.write` gerçek fr/it çevirileri.
**Canlıda doğrulandı (headless, port 5199):**
- Dil seçici listesi: 🇹🇷Türkçe, 🇬🇧English, 🇩🇪Deutsch, 🇪🇸Español, **🇫🇷Français**, **🇮🇹Italiano** (+ Arapça).
- **Fransızca:** `stored=fr`, `lang=fr`, `dir=ltr`, `title='yourbook — cahier de travail et agenda'`, sidebar *"cahier de travail et agenda / se connecter / SECTIONS DU CAHIER / toutes les notes"*.
- **İtalyanca:** `stored=it`, `lang=it`, `dir=ltr`, `title='yourbook — quaderno di studio e agenda'`, sidebar *"quaderno di studio / accedi / SEZIONI DEL QUADERNO / tutte le note"*; günlük *"caro diario"* → **"scrivi" / "flusso"**.
- **Türkçe kalıntı taraması İtalyanca modda: 0.** 0 konsol hatası / 0 başarısız istek.
- Ekran görüntüsü gözle incelendi: düzen bozulmadı, ruh hali çipleri de çevrildi.
**Ek not — `clean-temp-baks.mjs`:** çalıştırıldı → `src` altında geçici `.bak*` dosyası **kalmamış** (0 silindi).

### v38.0 — Yıllık Yazma Karşılaştırması (bu oturum)

**`calculateYearComparison(entries, years?)`** (`journalMoodAnalytics.ts`):
- Girdilerin bulunduğu **tüm yılları otomatik keşfeder**, yeniden eskiye sıralar; istenirse açık yıl listesi verilebilir.
- Yıl başına: `totalEntries`, `totalWords`, `activeDays` (benzersiz gün), `maxEntries` (en yoğun gün), `avgWordsPerActiveDay`, `firstDate`/`lastDate`, **12 slotlu aylık histogram**.
- 9 test (`journalYearCompare.test.ts`) — yıl keşfi, toplamlar, aktif gün sayımı, zirve, ortalama, aylık histogram, tarih aralığı, açık yıl listesi + bilinmeyen yıl, veri yokken cari yıla düşme.

**`JournalYearCompare.tsx`:**
- Katlanabilir bölüm (`data-year-compare-toggle`): yıl başlığı + `N yıl` özeti.
- Her yıl: **ölçekli turuncu çubuk** (yılın en yüksek girdi sayısına göre) + `girdi · aktif gün`
- Her yılın altında **aylık mini histogram** (12 ince şerit, yoğunluğa göre turuncu opaklığı)
- Seçili yılın **detay satırı**: kelime, ortalama, zirve, `İ-GG → İİ-GG` tarih aralığı
- **Yıl satırına tıklayınca ısı haritası o yıla geçer** — `JournalHeatmap` artık **controlled** (`year` + `onYearChange`), ortak state `JournalMoodRadar`'da (`heatYear`).
- 7 anahtar × 8 dil.

**Canlıda doğrulandı:** 2025 (3 girdi/2 gün) + 2026 (4/3) satırları; 2025'e tıklayınca detay *"30 kelime · ort. 15 · zirve 2 · 03-10 → 07-01"* ve **ısı haritası 2025'e senkron** geçti. 0 konsol hatası / 0 başarısız istek.

### v37.0 — PDF İçindekiler İnteraktif Bağlantı

**1) Her günlük girdisine anchor:**
- `<article class="journal-card">` → **`id="entry-<dateKey>-<idx>"`**. Böylece her girdi sayfa içinde adreslenebilir.
- `.journal-card { scroll-margin-top: 12mm }` → bağlantıya tıklanınca kart sayfa başlığının altında kalır.
- **`.journal-card:target { outline: 2px solid #ff6f1e }`** → hedefe atlandığında kart **turuncu çerçeveyle** vurgulanır.

**2) İçindekiler artık gün bazında linkli:**
- TOC iki seviyeli: **ay başlığı** (kalın + kayıt sayısı) ve altında **o ayın günleri** (ayın günü numarası, 14px içe girinti).
- Her gün satırı `#entry-<dateKey>-<idx>` adresine **sayfa içi bağlantı** verir; hover'da turuncu.
- Ay sırası: en yeni üstte; ay içindeki günler de yeniden eskiye.

**Testler:** 2 yeni test (toplam **10** PDF testi) — her girdinin **benzersiz anchor id**'si olduğu ve **TOC'taki her bağlantının gerçek bir hedefe** işaret ettiği doğrulanıyor (render edilmiş HTML üzerinden).

**Doğrulama yöntemi:** `vite-node` ile gerçek `generateJournalPrintHtml` çıktısı yazdırılarak TOC bölümü ve girdi anchor'ları gözle teyit edildi (ay grupları, `#entry-2026-03-18-1` bağlantıları, `id="entry-2026-03-10-0"` kartları).

### v36.0 — PDF İçindekiler + Sayfa Numarası

**1) İçindekiler (Table of Contents):**
- `generateJournalPrintHtml` artık özet kartının altına **`<section class="toc">`** basıyor: girdileri **aya göre gruplar** (`YYYY-MM`), **en yeni ay üstte**, her satırda ay + noktalı çizgi + **turuncu kayıt sayısı**.
- `page-break-inside: avoid` → TOC tek sayfada kalır; boş girdi listesinde TOC hiç render edilmez.
- Etiket `labels.toc` (varsayılan `İÇİNDEKİLER`).

**2) Sayfa numaraları:**
- `@page` bloğu genişletildi: `size: A4 portrait`, kenar boşlukları ve **`@bottom-center { content: counter(page) }`** → tarayıcı yazdırmada her sayfanın altında numara.

**3) 🐛 Kalan sabit Türkçe (PDF başlığında 6 metin):** `DEFTER NO:`, `ORİJİNAL BASKI`, `Toplam Kayıt`, `Toplam Kelime`, `Yazı Karakteri`, `Dışa Aktarma` → `JournalExportLabels`'a yeni alanlar (`notebookNo`, `originalPrint`, `totalEntries`, `totalWords`, `handwritingLabel`, `exportedAt`, `toc`, `page`) eklendi ve `JournalExportModal` bunları `t()`'den geçiriyor.
- **9 anahtar × 8 dil**.

**Testler:** `journalPdfToc.test.ts` — 8 test **gerçek `generateJournalPrintHtml` çıktısı** üzerinde: TOC varlığı, Türkçe varsayılan, ay gruplama + sayım (regex ile render edilmiş HTML'den), en yeni ay önce, boş liste → TOC yok, `@page`/`@bottom-center`/`counter(page)`, İngilizce özet etiketleri, Türkçe varsayılanlar.

### v35.0 — Uygulama Genelinde i18n Temizliği

**Sistematik tarama:** `audit-tr.mjs` (sabit Türkçe metin tarayıcısı) + `qa-i18n-sweep.mjs` (canlıda İngilizce modda tüm görünümleri gezip Türkçe kalıntı arayan headless QA) yazıldı.

**Düzeltilen gerçek i18n açıkları (~35 yeni anahtar × 8 dil):**
| Dosya | Düzeltilen |
|---|---|
| `WordStatusPanel` | Göreli gün etiketleri (`bugün`/`yarın`/`N gün sonra`/`N gün/ay önce öğrenildi`) → `tFn` parametresi ile çevrilebilir; `TFn` tipi eklendi |
| `SuperrSidebar` | 6 sabit `title` (sidebar genişliği, ajanda, kapat, yeni masa, günlük XP, PWA) + mute/unmute |
| `AuthModal` | `KULLANICI GİRİŞİ`, PWA kurulum satırı, sync durumu, submit etiketi |
| `MobileBottomNav` / `MobileHeader` | 5 nav etiketi + 3 `title` + `useT()` import'ları |
| `XpToast` | 5 övgü kelimesi + 🐛 **`const t = setTimeout(...)` gölgeleme bug'ı** (translator'ı gölgeliyordu, `timer` yapıldı) |
| `EngagementSystem` | 4 streak tier etiketi (`çelik`/`ateşli`/`istikrarlı`/`başlangıç`), `useMemo` bağımlılığına `tFn` |
| `CollectionsView` | `notlar (N)`, `kelime:`, `İngilizce` |
| `YouTubeLinksView` | Başlık, alt başlık, **5 kategori adı** (`catLabel()` ile render'da çevriliyor — modül dizisindeki literal `name` alanı korunur) |
| `InstallPwaModal` | iOS kurulum adımları |
| `VolumeArchiveModal` / `HandwritingStudioModal` / `JournalExportModal` | `CİLT`, el yazısı stil adları, PDF butonu |

**Kasıtlı olarak çevrilmeyen (doğru davranış):** kullanıcı içeriği (notlar, kelime kartları), demo/seed verisi, marka ve kişi adları (`yourbook`, `Yalçın`), `CommandPalette` arama anahtar kelimeleri (görünmez), geliştirici yorumları.

**Doğrulama:** `qa-i18n-sweep.mjs` İngilizce modda 7 görünümü gezdi → **UI kalıntısı sıfır**; kalan `hits`'in tamamı kullanıcı içeriği veya kalıcı seed verisi. 0 konsol hatası / 0 başarısız istek.

### v34.0 — Notlar Nav + Kaynak Rozeti

**1) Sidebar'a "klasörlenmiş notlar" girdisi (keşfedilebilirlik):**
- v33'te tespit edilen boşluk kapatıldı: `"notes"` bir `NavView`'di ama **sidebar'da girdisi yoktu** (yalnızca komut paleti + hero kartı).
- `sevgili günlük` girdisinden sonra yeni nav girdisi: `SketchDocument` ikonu, `t("sidebar.item.notes")` etiketi + `t("sidebar.item.notes_short")` turuncu kısa rozeti, `layoutId="sidebar-view-indicator"` ile aynı aktif-dolgu dili.
- 2 anahtar × 8 dil. Canlıda doğrulandı (nav sırasında görünüyor, `hasNewNote: true`).

**2) Üç değerli istem kaynağı rozeti:**
- `promptFromAgenda: boolean` → **`promptSource: "agenda" | "alarm" | "note" | null`**. Artık istemin hangi dış kaynaktan geldiği ayırt ediliyor.
- Rozet metni kaynağa göre: **`ajandadan`** / **`hatırlatıcıdan`** / **`notundan`**.
- Rozete `data-prompt-source={promptSource}` eklendi (test kancası).
- 2 anahtar × 8 dil. Canlıda doğrulandı: not tohumu → `data-prompt-source="note"` + "notundan"; alarm tohumu → `data-prompt-source="alarm"` + "hatırlatıcıdan".

### v33.0 — Not → Günlük Bağlantısı

**Not → Günlük:**
- `NotesView`'e **`NotesViewProps`** + **`onSendToJournal(title, content)`** eklendi; her not kartına **"günlüğe taşı"** aksiyonu (`data-note-to-journal`, `DNote` ikonu, `title` i18n'den).
- `App.tsx`, not metnini `sessionStorage`'da **tek kullanımlık tohum** olarak saklayıp günlüğe geçiyor (`fromNote: true`).
- `JournalView` tohumu okuyup **`aprompt.from_note`** şablonuna yerleştiriyor (alarm tohumundan ayrışır: `fromNote` bayrağıyla `aprompt.from_alarm` / `aprompt.from_note` seçimi) ve tüketiyor.
- Yan ürün i18n: `not silindi` → `t("notes.deleted")`, `title="Notu Sil"` → `t("notes.delete")`.
- 4 anahtar × 8 dil. Canlıda doğrulandı (günlükte istem not başlığını taşıyor, tohum temizleniyor).

**⚠️ Bulgu — `NotesView`'e UI erişimi:** (v34'te ÇÖZÜLDÜ — sidebar'a "klasörlenmiş notlar" girdisi eklendi.) Ayrıca not→günlük rozeti artık "notundan" diyor.

### v32.0 — Isı Haritası A11y + Alarm → Günlük

**1) Isı haritası: tıkla → güne git, klavye erişilebilirliği ve vurgu:**
- Her hücre artık **`role="button"`**, **`tabIndex=0`**, **`aria-label`** (tarih + girdi/kelime sayısı) ve **`data-heat-day`** taşıyor.
- **Klavye gezinme:** `Enter`/`Space` o günü açıyor; `←/→` bir gün, `↑/↓` bir hafta geziyor; **gelecek günlere geçiş engelli** (`next.isFuture` → durur), odak hedef hücreye veriliyor.
- Tıklamada **kısa vurgu (1.2 sn)**: yazma alanı `data-jump-flash="1"` alıp aksan renginde hafifçe yanıyor → "bir güne atlandı" hissi.
- 6 test (`journalHeatmap.test.ts`) — seçim, gelecek gün engeli, sağa/aşağı/sola/yukarı gezinme, benzersiz tarih anahtarı, girdi seviyesi korunması.
- Canlıda doğrulandı: **259 hücrenin hepsi** `role=button` + `tabindex=0` + `aria-label`; tıklama → günlük o güne atladı, içerik yüklendi.

**2) Alarm → tek tıkla günlüğe geçiş:**
- `AlarmAlert`'e **"günlüğe yaz"** aksiyonu eklendi (`onOpenJournal(title, dateKey)`).
- Hatırlatıcı metni (başlık + içerik) `sessionStorage`'da **tek kullanımlık tohum** olarak taşınıyor; `JournalView` bunu okuyup **ilham istemi** olarak gösteriyor ve tüketiyor (`aprompt.from_alarm`).
- 🐛 **Yan ürün i18n:** `AlarmAlert`'teki 4 sabit Türkçe metin (`hatırlatıcı`, `tamam`, `10 dk sonra`, `1 saat sonra`) çevrilebilir hale geldi.
- 6 anahtar × 8 dil. Canlıda doğrulandı: alarm açıldı → "günlüğe yaz" → günlüğe atladı, istemde hatırlatıcı başlığı göründü, tohum temizlendi.

### v31.0 — PDF Export i18n + Dil Önerisi

**1) PDF/TXT export başlıkları i18n'e taşındı:**
- `journalPdfExport.ts`'e **`JournalExportLabels`** tipi + **`DEFAULT_EXPORT_LABELS`** (Türkçe) + **`resolveLabels()`** eklendi. `labels?: Partial<JournalExportLabels>` opsiyonel — verilmezse eski davranış korunur.
- HTML çıktısındaki 5 başlık kullanıldı: `<title>`, `<h1>`, alt başlık, footer, arşiv mührü.
- TXT çıktısında başlık + `TARİH:` / `RUH HALİ:` / `İSTEM:` etiketleri; **ruh hali değerleri de `moodMap` ile çevriliyor**.
- `JournalExportModal` artık `exportLabels`'ı `t()`'den üretip iki export'a geçiriyor (8 anahtar × 8 dil).
- 5 test (`journalPdfExportI18n.test.ts`) — Türkçe varsayılan, İngilizce, Arapça, kısmi override, içerik korunması.

**2) Dil masası açarken arayüz dili önerisi:**
- Dil seçicide bir masa açıldığında, hedef dilin **arayüz dili karşılığı varsa** ve mevcut arayüz dilinden farklıysa sidebar'da **öneri bandı** belir (turuncu kenarlık, çeviri ikonu).
- **"evet, çevir"** → arayüz dili anında değişir; **"şimdilik değil"** → bant kapanır. Her iki eylem de i18n'li.
- 4 anahtar × 8 dil + yan ürün: `alreadyOpen ? "açık" : "aç"` sabit metni `t("common.open_state")` / `t("common.open")` oldu.
- 🐛 **Kritik bug (canlıda yakalandı):** öneri başlığında **`{lang}` iki kez** geçiyordu ama `String.replace(string, ...)` **yalnızca ilkini** değiştir → ekranda *"...arayüzü de {lang} yapalım mı?"* görünüyordu. **`replaceAll`** ile düzeltildi (kod + 8 dil). `.replace()` ile `t()` kullanan tüm yerler için **placeholder sayısı denetimi** yapıldı (diğerleri tek `{n}`, sorun yok).
- Canlıda doğrulandı: İspanyolca masası açıldı → öneri bandı → kabul → `lang="es"`, sidebar tamamen İspanyolca, bant kayboldu.

### v30.0 — Yeni Sayfa + Ajandadan İlham İstemi

**1) Çift sayfada YENİ sayfa oluşturma** (`JournalSpread.tsx`):
- Boş sayfa artık **tıklanabilir davet**: *"boş sayfa / + bu güne yaz · YYYY-MM-DD"*.
- Tıklayınca sayfa `textarea`'ya dönüşür (**6 ruh hali** düğmesi, placeholder, kelime sayacı, **kaydet/vazgeç**); **boşken kaydet kapalı**.
- `onCreateEntry(dateKey, content, mood)` prop'u + `JournalView.handleSpreadCreate` → yeni `JournalEntry` üretir (id, timeStr, timestamp, wordCount) ve listeye ekler.
- **Trailing blank spread:** giriş sayısı çiftken yeni sayfa için her zaman bir **boş spread** eklenir (`totalSpreads + 1`) — `hasTrailingBlank`.
- `blankDateKey` = son girdiden **sonraki gün**, bugünü geçmiyorsa bugün (gelecek tarih açılmaz).
- Sayfa çevirme kilidi ve **Esc** artık yeni sayfa yazımını da kapatıyor; `hasUnsaved` yeni sayfayı da sayıyor.
- 3 anahtar × 8 dil. Canlıda uçtan uca doğrulandı (2 girdi → boş spread → yaz → kaydet → 3 girdi, `dateKey: 2026-09-16`).

**2) Ajanda kaydından günlük ilham istemi** (`JournalView.tsx`):
- `buildAgendaPrompt(events, t)` — o gün ajanda kayıtlarından **bağlama duyarlı** istem üretir:
  - tek kayıt → *"bugün {time}'te \"{title}\" var. bunun için ne hissediyorsun?"*
  - tek kayıt + alarm → *"bugün {time}'te \"{title}\" için alarmın var. hazır mısın?"*
  - çok kayıt → *"bugün {count} kaydın var; {time}'te \"{title}\" ile başlıyor. gün nasıl gidiyor?"*
- İstem bandında **\"ajandadan\" rozeti** (turuncu kapsül); yoksa rastgele yazma istemine düşer.
- 🐛 **Eski stale-effect bug'ı düzeltildi:** istem seçimi `useEffect(..., [])` ile bir kez çalışıyordu → **gün veya dil değişince istem güncellenmiyordu**. Artık `[selectedDateKey, dayAgendaEvents.length, lang]` bağımlılıklarıyla yenileniyor.
- Yan ürün: sabit **\"ilham istemi:\"** etiketi `t(\"radar.stat.prompt\")` oldu (8 dil).
- 4 anahtar × 8 dil. Canlıda doğrulandı (çok kayıt + tek kayıt/alarm senaryoları).

### v29.0 — Çift Sayfa Düzenleme + Çapraz Bağlantı

**1) Defter çift sayfa DÜZENLEME modu** (`JournalSpread.tsx`):
- Her sayfada **"sayfada düzenle"** → sayfa `textarea`'ya dönüşür; **6 ruh hali** düğmesi, kelime sayacı, **kaydet / vazgeç**.
- `onSaveEntry(entryId, { content, mood })` prop'u eklendi; `JournalView.handleSpreadSave` localStorage'a yazar (`wordCount` yeniden hesaplanır, `timestamp` güncellenir).
- **Veri kaybı koruması:** düzenleme sırasında **sayfa çevirme kilitlenir** (`disabled`), **Esc** önce düzenlemeyi iptal eder, kaydedilmemiş değişiklik varken kapatmada **onay** istenir, üst şeritte **"kaydedilmedi"** rozeti.
- 5 anahtar × 8 dil. Canlıda uçtan uca doğrulandı (metin + ruh hali kaydedildi, localStorage doğrulandı).

**2) Ajanda ↔ Günlük çapraz bağlantı (iki yön):**
- **Ajanda → Günlük:** `CalendarAgendaView`'e `onOpenJournal` prop'u; seçili gün altında **günlük bandı** — o gün günlüğü varsa **turuncu vurgulu** ("bu gün günlüğü var"), yoksa "ilk sayfayı yaz" daveti.
- **Günlük → Ajanda:** `JournalView` "yaz" sekmesinde **o gün ajanda kayıtları** paneli (saate göre sıralı, alarm noktası, ilk 4 + `+N`).
- **Ortak gezinme:** `App.tsx`'te `crossLinkDateKey` state'i; ajandadan tıklanınca hedef gün + `journal` görünümüne geçilir, `JournalView` hedef günü uygulayıp `onConsumedDateKey` ile state'i temizler.
- 🐛 **Ölü kod düzeltildi:** `journalDates` ajandada hesaplanıyor ama **hiç kullanılmıyordu** → artık günlük bandının vurgusunu besliyor.
- Yan ürün: `CalendarAgendaView`'deki 2 sabit Türkçe metin i18n'e taşındı (`agenda.tab.other`, `act.delete`).
- 8 anahtar × 8 dil + 9 test (`journalAgendaLink.test.ts`). Canlıda uçtan uca doğrulandı.

### v28.0 — 8 Dil + Anahtar Güvenlik Koruması

**1) Rusça (ru) arayüz çevirisi:** 578/578 anahtar (tr ile birebir), `locales/ru.ts` + `ru-extra.ts`, `UI_LANGUAGES` 🇷🇺 ltr. Canlıda doğrulandı: `yourbook — рабочая тетрадь и ежедневник`.

**2) Fransızca (fr) arayüz çevirisi:** 578/578 anahtar, `locales/fr.ts` + `fr-extra.ts`, 🇫🇷 ltr. Canlıda doğrulandı: `yourbook — cahier de travail et agenda`.

**3) Supabase anahtar güvenlik koruması (SAVUNMACI):**
- 🔴 **Tespit:** `VITE_SUPABASE_ANON_KEY` bir **`sb_secret_...` service-role anahtarı** içeriyor → Vite bunu `dist/assets/*.js` içine gömüyor ve canlıda **herkese açık**; service-role RLS'i tamamen atlar.
- ✅ **Kod koruması (`supabase.ts`):** `looksLikeSecretKey()` eklendi — `sb_secret_` önekini **veya** JWT `role: "service_role"` claim'ini yakalarsa bulut **devre dışı** kalır (`isCloudConfigured = false`) + net bir konsol uyarısı basar. `isCloudBlockedBySecretKey` export edilir (UI uyarısı için).
- ✅ **`supabase/schema.sql`** eklendi: `user_sync_store` tablosu + **RLS politikaları** + `updated_at` trigger (şema hiç yoktu).
- ✅ **`.env.example`** eklendi: doğru anahtar tipini (publishable/anon) belgeler, secret kullanımını açıkça yasaklar.
- 7 test (`supabaseKeyGuard.test.ts`) — secret/publishable/`service_role` JWT/`anon` JWT/bozuk JWT.
- ⚠️ **Kullanıcı aksiyonu gerekli:** anahtar hâlâ bundle'da — **rotate edilmeli** (bkz. §9).

### v27.0 — Yeni Özellikler + Cloud Sync

**1) Defter yıllık ısı haritası (contribution graph):**
- `journalMoodAnalytics.ts`: `calculateYearHeatmap()` → 53 hafta × 7 gün ızgara, `HeatmapDay[]`, aylık işaretler, yoğunluk 0..4 (quartile), `isFull`/`reasons`.
- `JournalHeatmap.tsx`: turuncu opaklık merdiveni (0=boş → 4=aksan), ay etiketleri, gün satırları, hover tooltip + **tıkla → o güne git**, yıl sekmeleri, `az/çok` göstergesi. Duygu pusulası sekmesinde trend'in altında.
- 8 test + 6 anahtar × 6 dil.

**2) Sesli dikte (Web Speech API):**
- `lib/useSpeechDictation.ts` — `SpeechRecognition` sarmalayıcı: kesinleşen + ara (interim) metin ayrı, `continuous` + sessizlikte otomatik yeniden başlatma, dil→locale eşlemesi (tr/en/de/es/pt/ar), temizlik.
- `JournalView` yazma sekmesine **`sesle yaz` mikrofon butonu** (dinlerken aksan dolgu), ara metin önizlemesi, `data-dictation` kanc.
- Yeni `SketchMic` ikonu. 6 anahtar × 6 dil.
- Ayrıca `JournalView`'de kalan **sabit Türkçe** i18n'e taşındı: `bugün`, `kelime`, `şimdi kaydet`, `+ bu güne ayrı not`, `kişisel günlük & iç dökme defteri`, `sevgili` (başlık aksanı), `gündür yazıyorsun`, `imza`.

**3) Çoklu cilt otomatik geçişi:**
- `notebookConfig.ts`: `evaluateVolumeFill()` (rozet %60 + günlük %25 + kelime %15 ağırlıklı doluluk), `isVolumeAutoswitchEnabled`/`setVolumeAutoswitchEnabled`, `getVolumeAutoswitchState()` (off/idle/prompt), `TOTAL_BADGES = 9`.
- `VolumeCompleteBanner.tsx`: cilt dolunca üstte öneri bandı — "yeni cilde geç" tek tıkla `advanceToNextVolume()` + eski cilt arşive; "sonra" → tercihi kapatır.
- `NotebookCustomizeModal` cilt sekmesine **otomatik geçiş anahtarı** + o sekmedeki 6 sabit Türkçe metin i18n'e taşındı.
- 8 test + 10 anahtar × 6 dil. Canlıda doğrulandı: cilt 1→2, arşiv 0→1, bant kayboldu.

**4) Supabase cloud sync sağlamlaştırma:**
- 🐛 **`SYNC_KEYS` bayattı** — `yourbook_ui_language_v1`, `yourbook_volume_autoswitch_v1`, `craft_custom_spaces_v1`, `craft_active_space_taste_v1` **hiç senkronlanmıyordu**. Eklendi.
- 🐛 **Veri kaybı riski:** bulut daha yeni olduğunda yerel **tümüyle eziliyordu** → artık bulut+yerel **mutabakat**, bulutta olmayan yerel anahtarlar korunur, birleşik paket buluta geri yazılır.
- 🐛 `upsert` hataları **sessizce yutuluyordu** → artık `error` kontrol edilip fırlatılır.
- **Yeni tetikleyiciler:** `online` (ağ geri geldi), `visibilitychange` (sekme odaklandı), `storage` (başka sekmede değişiklik) → anında senkron. (Periyodik 30s + debounce zaten vardı.)
- **`supabase/schema.sql` eklendi** — `user_sync_store` tablosu + **RLS politikaları** + `updated_at` trigger + anon-auth notu. Önceden **tablo şeması hiç yoktu** (sync "relation does not exist" ile patlardı).
- `.env.example` eklendi (doğru anahtar tipini belgeler).
- 5 test.

### v26.0 — Büyük Özellikler + 6 Dil

**Doğrulanan 4.1 grubu (hepsi ✅):** Günlük sekmeleri siyah (taze profil), StudyDesk `border-b` butonu kesmiyor, DE/EN/ES masa üst çerçeveleri üçünde de doğru.

**4.3.1 — PWA Offline + bildirimler:**
- `sw.js`: `notificationclick` **aksiyonlu** (aç / 5 dk ertele), `message` ile `SHOW_ALARM` zengin bildirimi, `CACHE_NAME` v3.
- 🐛 **KRİTİK:** `App.tsx` merkezi ajanda alarmı **yanlış anahtarı** (`superr_calendar_agenda_events_v2`) izliyordu → `CalendarAgendaView` `superr_agenda_events_v4`'e yazıyor. **Alarm hiç çalmıyordu.** Düzeltildi.
- `alarm.ts`: `icon` yolu `/favicon.ico` (yok) → `/icon-192.png`; alarm sonrası sekme başlığı sabit Türkçe'ye sıfırlanıyordu → `restoreTitle` ile i18n'e saygılı.
- `showAlarmViaServiceWorker()` eklendi (SW bildirimi, yoksa klasik bildirime düşer). 8 yeni `alarm.*` anahtarı × 6 dil.

**4.3.2 — Haftalık duygu trendi (mürekkep eğrisi):**
- `journalMoodAnalytics.ts`: `MOOD_SCORE` (-2..+2), `calculateWeeklyMoodTrend()` (Pzt..Paz, boş gün = `null`), `buildMoodTrendPath()` (boş günler eğriyi **böler**).
- `JournalMoodTrend.tsx`: turuncu `motion.polyline(pathLength animasyonu)`, bugün = siyah nokta, sıfır referans çizgisi, gün etiketleri. Ruh hali dağılımının altına yerleşti. 6 test + 4 anahtar × 6 dil.

**4.3.3 — Defter çift sayfa (book spread):**
- `JournalSpread.tsx`: sol/sağ sayfa, **orta kat (spine)** + iç kenar kıvrım gölgesi, sayfa numaraları, ruh hali + kelime sayısı, `önceki/sonraki`, **← → / Esc** klavye kısayolları, `paper-texture-surface`.
- `JournalView` "akış" sekmesine `data-spread-open` butonu; düzenle → yaz sekmesine döner. 9 anahtar × 6 dil.
- ⚠️ Yerleşim tuzağı: ilk denemede takvim hücresi döngüsün İÇİNE eklendi (30+ kopya render). Parantez dengesi takip eden tek-geçişli taşıma ile düzeltildi.

**4.4 — i18n Kademe 2/3: 6 dil:**
- **es** (İspanyolca) + **pt** (Portekizce) + **ar** (Arapça) — her biri **554/554 anahtar** (tr ile birebir, 0 eksik / 0 fazla).
- Üretici boru hattı: `tr-keys.json` (vite-node ile çıkar) → `{es,pt,ar}-map.json` → `gen-locale.mjs` → `locales/<code>.ts` + `<code>-extra.ts`.
- `UI_LANGUAGES`: `de`/`es`/`pt` = ltr, **`ar` = rtl** 🇸🇦.
- **RTL turu:** 97 fiziksel yön sınıfı → **mantıksal** (`pl/pr/ml/mr` → `ps/pe/ms/me`, `left/right` → `start/end`, `text-left/right` → `text-start/end`), 22 canlı dosyada 85+ dönüşüm. `I18nProvider` zaten `documentElement.dir` uyguluyordu.
- 🐛 **`weekDays` useMemo stale bağımlılık:** `t()` çağrılıyor ama bağımlılıkta yoktu → Arapça modda günler Türkçe kalıyordu. `t` eklendi.
- 🐛 **`border-1.5` geçersiz (50 adet):** hiç CSS üretmiyordu → `border-[1.5px]`; artık `.border-\[1\.5px\]{border-width:1.5px}` üretiliyor.
- 5 yeni i18n testi (es/pt/ar parity + ar RTL-only).

**4.2 tamamlandı:** `WorkProjectsView` demo seed verisi artık `t()` ile dil-duyarlı (14 yeni `work.seed.*` anahtarı × 6 dil).

### v13–v25 (önceki oturumlar)

#### v13–v17
- Ruh hali Radar + Takvim, Defter Yaşlanması, El Yazısı Atölyesi tamiri, kalan emojilerin sketch ikona dönüşümü, i18n altyapısı + pilot, genelleştirilmiş dil masaları (İspanyolca eklendi).

### v18–v20 — i18n'in uygulama geneline yayılması
- **~200+ UI metni** `t()` anahtarlarına taşındı: Sidebar, Hero, Journal (tüm sekmeler/modallar), Mood Radar (12 ay + 7 gün + ruh halleri), OCR, Export, Kelime Durumu Paneli, Kelime Avı, Ajanda (kategoriler + aylar), Auth, ErrorBoundary, YouTube arşivi, İş & Projeler, Daily Notes, Notes, Collections, StudyDesk, CommandPalette, Özelleştirme paneli, Ritüel karşılama metinleri (4 sabah + 4 ikindi + 4 gece).
- `document.title` ve `documentElement.lang/dir` runtime'da i18n'e bağlandı.
- **Kritik bug:** `addKeys` fonksiyonunun CRLF anchor sorunu → ~60 anahtar sessizce eklenmiyordu; düzeltildi.

### v21–v25 — Görsel rötuşlar
- **v21:** Hediye paneli pembe→turuncu; ok konumu; rozetler küçültüldü.
- **v22:** Hediye paneli **siyah çerçeve + turuncu dolgu + beyaz yazı/ikon**; alt "yourbook" markası **"your" siyah + "book" turuncu**, nokta kaldırıldı.
- **v23:** Sağdaki masa panelleri + haftalık ritim + ana 3 panel + günlük panelleri → **siyah kenarlık** (`card-superr` hover artık siyah).
- **v24–v25:** "yeni çalışma masası" dashed kenarlık turuncu→**siyah noktalı**; günlük ruh hali çipleri + kartları siyah; günlük sekmeleri **birleşik siyah dil** (aktif = siyah dolgu, pasif = siyah kenarlık, konteyner `bg-[var(--paper)]`); StudyDesk üst başlık çerçevesi metni kesmiyor.

---

## ✅ 4. BİTMEMİŞ İŞLER (Yeni Chat Backlog)

> **Durum özeti (v39.1): açık iş KALMADI.** Aşağıdaki listelerin hepsi tamamlandı veya bilinçli olarak ertelendi.
> Bu bölüm ileride yeniden kovalanmasın diye ✅/⏸️ etiketleriyle yenilendi.

### 4.1. Doğrulamalar — ✅ TAM
1. ~~Günlük sekmeleri siyah mı?~~ — ✅ taze profille doğrulandı: `yaz` siyah dolgu, `akış`/`duygu pusulası` siyah kenarlık.
2. ~~StudyDesk "yeni kelime" düz çizgisi~~ — ✅ doğrulandı: `btnCrossesBorder: false`.
3. ~~DE/EN/ES masa üst çerçevesi~~ — ✅ üçünde de `borderBottom: rgb(28,25,23)`, metin kesilmiyor.

### 4.2. i18n — ✅ TAM (bilinçli istisnalar aşağıda)
- ~~**PDF export başlıkları**~~ — ✅ **v31/v36'da ÇÖZÜLDÜ.** `JournalExportLabels` + `resolveLabels()` + `DEFAULT_EXPORT_LABELS` (Türkçe fallback). `JournalExportModal` etiketleri `t()`'den geçiriyor. `journalPdfExport.ts` içinde hâlâ görünen `"DEFTER NO:"`, `"Toplam Kayıt"` vb. **varsayılan (fallback) değerlerdir** — hata değil. 5 test (`journalPdfExportI18n.test.ts`).
- ~~**"PDF başlığında 6 sabit Türkçe metin"**~~ — ✅ v36'da eklendi (9 anahtar × 8 dil).
- ⏸️ **`WorkProjectsView` demo/seed verisi** — bilinçli olarak Türkçe bırakıldı (örnek içerik). İstenirse çevrilebilir.
- ⏸️ **`CommandPalette` arama anahtar kelimeleri** — görünmez; arama eşleşmesi için literal kalmalı.
- ⏸️ **Kullanıcı içeriği** (`ihale` vb.) — otomatik çevrilmemeli (doğru davranış).
- ✅ **Ölü kod temizliği — v40.0'da YAPILDI.** `src_copy/` silindi (yedek: `_lexi-cards_srccopy_removed_20260919`). Diğer "ölü bileşenler" (`OpennoteSidebar`, `OffBrandHero`, `OffBrandSidebar`, `PanelSwitcher`, `CraftSidebar`) **`src/` içinde zaten yoktu** — yalnızca `_lexi-cards_dead_backup_*` / `_lexi-cards_v66_deadcode_*` yedeklerinde duruyorlar. `LovableInspector` **silinmedi, devreye alındı** (bkz. v40.0).

### 4.3. Büyük özellikler — ✅ TAM
- ~~PWA Offline + bildirimler~~ ✅ (v26)
- ~~Haftalık duygu trendi eğrisi~~ ✅ (v26, `JournalMoodTrend.tsx`)
- ~~Defter çift sayfa **okuma** modu~~ ✅ (v26, `JournalSpread.tsx`)
- ~~Defter çift sayfa **düzenleme**~~ ✅ (v29 — `textarea` + `onCreateEntry` kaynakta doğrulandı)
- ~~Ajanda ↔ günlük otomatik bağlantı~~ ✅ (v29 — `journalAgendaLink.test.ts`, 9 test)
- ~~Almanca/Fransızca dil masası otomatik oluşturma~~ ✅ (`languages.ts`, `createLanguageSpace()` mevcut)

**Kalan tek aday (opsiyonel, bloklayıcı değil):** gerçek cihazlar arası Supabase sync testi — **bulut sync zaten kapalı** (§9), açmak isterseniz publishable/anon anahtarı `.env`'e yazılmalı. Anahtar rotasyonu **gerekmiyor** (sızıntı yok).

### 4.4. Arayüz dilleri — ✅ TAM (v39.1: 7 dil)
| Dil | Kod | Durum |
|---|---|---|
| Türkçe (kaynak) | tr | ✅ aktif |
| İngilizce | en | ✅ aktif |
| Almanca | de | ✅ aktif |
| İspanyolca | es | ✅ aktif |
| **Fransızca** | **fr** | ✅ **v39.1'de aktif edildi** |
| **İtalyanca** | **it** | ✅ **v39.1'de aktif edildi** |
| Arapça (RTL) | ar | ✅ aktif |

- ⏸️ **Hazır ama arayüz listesinde DEĞİL:** `pt` (Portekizce), `ru` (Rusça), `nl` (Felemenkçe) — çevirileri **1095/1095 tam**, `DICTS`'te kayıtlı. Aktif etmek için `UI_LANGUAGES`'e tek satır eklemek yeterli.
- Yeni RTL dil (Farsça/İbranice) gerekirse **ek stil dönüşümü GEREKMEZ** — altyapı hazır.

**Parity kuralı:** tr'ye yeni anahtar eklenirse **10 dilin hepsi** güncellenmeli, yoksa `npm test` parity testleri kırılır (istenen davranış). v39.1 itibarıyla **10 dilde 1095/1095 anahtar**.

---

## 🔑 5. Önemli Mimari Kararlar ve Veri Şemaları

Tüm kullanıcı verileri tarayıcıda `localStorage`'da izole saklanır (isteğe bağlı Supabase Cloud Sync):

| Depolama Anahtarı | İşlevi |
|---|---|
| `yourbook_deck_v7_clean` | Kelime kartları, dil (`DE`/`EN`/`ES`/`Memo`), SRS sayaçları (`reviewCount`, `learnedAt`, `reviewAt`) |
| `lexi_engagement_v1` | XP, `streak`, günlük XP (`bonusXpToday`, `answeredToday`, `masteredToday`) |
| `superr_agenda_events_v4` | Ajanda (`dateKey`, `timeStr`, `title`, `hasAlarm`, `isDone`) |
| `yourbook_journal_entries_v1` | Günlük girdileri (`dateKey`, `timeStr`, `mood`, `content`, `promptUsed`, `wordCount`) |
| `yourbook_journal_pin_v1` | Günlük 4 haneli yerel PIN kilidi |
| `yourbook_paper_texture_v1` | Kağıt dokusu (`plain`, `ruled`, `dotted`, `kraft`) |
| `yourbook_handwriting_font_v1` | El yazısı stili (`caveat`, `kalam`, `architect`, `marck`, `custom`) |
| `yourbook_custom_handwriting_v1` | Kullanıcının çizdiği/yüklediği el yazısı (`slant`, `weight`, `letterSpacing`, `previewImage`, `analysis`) |
| `yourbook_sound_profile_v1` | Kalem sesi (`fountain`, `pencil`, `ballpoint`, `typewriter`) |
| `yourbook_ink_stamp_v1` | Kapak mürekkep damgası |
| `yourbook_notebook_volume_v1` | Aktif cilt numarası |
| `yourbook_volumes_archive_v1` | Arşivlenmiş ciltler |
| `yourbook_time_lighting_enabled_v1` | Zamana duyarlı şık tonu |
| `yourbook_ritual_window_v1` | Açılış karşılama tercihi (`auto`/`morning`/`afternoon`/`night`) |
| `yourbook_gifted_notebook_v1` | Defter hediye etme durumu (9. rozet) |
| **`yourbook_ui_language_v1`** | **Arayüz dili (`tr`/`en`)** |
| **`craft_custom_spaces_v1`** | **Kullanıcının açtığı dil masaları** |
| **`craft_active_space_taste_v1`** | **Aktif masa id** |

---

##  6. Tasarım Dili Notları (yeni chat için)

- **Aksan rengi:** `var(--accent)` = turuncu `#ff6f1e` (tema: krem portakal). `--ink` = `#1c1917` (siyah/koyu).
- **Kenarlık kuralı (v25 itibarıyla):** Ana paneller + günlük panelleri + masa panelleri **siyah** kenarlıklı. Aktif öğeler siyah dolgu (`bg-[var(--ink)] text-white`).
- **Postit rozetleri:** `CoverStickerCluster.tsx` — 80×89px, grain dokusu, washi bant, kilitli/kilitsiz ayrımı.
- **Organik sketch ikonlar:** `strokeWidth ~1.75`, `strokeLinecap/Linejoin="round"`, `currentColor`, bazıları `<feTurbulence>` + `<feDisplacementMap>` wobble filtresi ile.
- **Hediye butonu:** siyah çerçeve + turuncu dolgu + beyaz yazı/ikon (`SuperrHero.tsx` ~satır 115).

---

## 🧪 7. Son Doğrulanan Durum (v41.1)

- `npx tsc --noEmit` → **0 hata**
- `npm test` → **210/210** (23 dosya)
- `npm run build` → başarılı
- Canlı: 3 alias da son derlemede; **0 konsol hatası / 0 başarısız istek**
- **4.1 grubu canlıda doğrulandı:** günlük sekmeleri siyah (`rgb(28,25,23)`), StudyDesk butonu kesilmiyor, DE/EN/ES üst çerçeveleri doğru
- **Diller canlıda doğrulandı:** tr (varsayılan LTR bozulmadı), en, de, es, pt — hepsi tam çeviri; **ar → `dir=rtl`, sidebar sağa taşındı, mantıksal padding/ikon çalışıyor**
- **Yeni özellikler canlıda görsel olarak doğrulandı:** duygu trendi eğrisi (turuncu, 7 nokta, hafta ortalaması), çift sayfa okuma (sol/sağ + spine + sayfa no), PWA alarm bildirimi
- `border-[1.5px]` fix canlıda görünür (50 çizgi artık gerçek)
- **v27 canlıda doğrulandı:** ısı haritası (259 hücre, yoğunluk dağılımı doğru, 12 ay etiketi), sesli dikte butonu (`sesle yaz`, `speechSupported: true`), cilt otomatik geçişi (bant göründü → geçiş → `volume: 2`, `archived: 1`, bant kayboldu)
- **Dil kalıntısı taraması:** İngilizce modda JournalView'de Türkçe kalıntı **0** (`bugün`/`kelime`/`şimdi kaydet`/`sevgili` hepsi çevrildi)
- **v28 canlıda doğrulandı:** dil seçici **8 dili** listeliyor (🇹🇷🇬🇧🇩🇪🇸🇵🇹🇸🇦🇷🇺🇫🇷); **ru** → `lang="ru"`, `dir="ltr"`, sidebar tamamen Rusça; **fr** → `lang="fr"`, `dir="ltr"`, sidebar tamamen Fransızca
- **v29 canlıda doğrulandı (çift sayfa düzenleme):** "sayfada düzenle" → textarea açıldı, 6 ruh hali düğmesi, kaydet/vazgeç, düzenlerken nav kilitli (`navDisabled: true`), kaydet → `storedContent`/`storedMood: "tense"`/`storedWords: 9` localStorage'da doğrulandı
- **v29 canlıda doğrulandı (çapraz bağlantı):** ajanda bandı `data-has-journal="1"` turuncu vurgulu; tıklayınca günlük o güne atladı; günlük tarafında ajanda özeti *"bu gün ajandası / 3 kayıt / 09:30 / 14:00 • / 18:00"* (saat sıralı, alarm noktası, başlıksız süzüldü)
- **v30 canlıda doğrulandı (yeni sayfa):** `navigated: [false, true]` (2. spread'de boş sayfa) → davet *"boş sayfa / + bu güne yaz · 2026-09-16"* → editör açıldı → boşken kaydet kapalı → yaz+kaydet → **girdi sayısı 2→3**, `dateKey: 2026-09-16`, `mood: peaceful`, `wordCount: 9`
- **v30 canlıda doğrulandı (ajanda istemi):** 2 kayıt → *"bugün 2 kaydın var; 14:00'te \"Ihale teslimi\" ile başlıyor. gün nasıl gidiyor?"* + **"ajandadan"** rozeti; tek kayıt + alarm → *"09:15'te \"Toplanti\" için alarmın var. hazır mısın?"*
- **v31 canlıda doğrulandı (dil önerisi):** İspanyolca masası açıldı → bant göründü → **"evet, çevir"** → `lang="es"`, `dir="ltr"`, `document.title` İspanyolca, sidebar tamamen İspanyolca, bant kayboldu; dil seçicide `aç` i18n'den
- **v32 canlıda doğrulandı (ısı haritası):** 259 hücrenin **tamamı** `role=button` + `tabindex=0` + `aria-label`; bir güne tıklayınca günlük o güne atladı ve içerik yüklendi
- **v32 canlıda doğrulandı (alarm → günlük):** hatırlatıcı açıldı → **"günlüğe yaz"** → günlüğe atladı, ilham istemi hatırlatıcı başlığını gösterdi, `sessionStorage` tohumu temizlendi
- **v33 canlıda doğrulandı (not → günlük):** `fromNote` tohumu → günlükte ilham istemi ***"notundan: \"Kitap fikri\" — bu konuda ne düşünüyorsun?"*** biçiminde göründü, tohum temizlendi, 0 konsol hatası / 0 başarısız istek
- **v34 canlıda doğrulandı (nav + rozet):** sidebar sırası `sevgili günlük` → **`klasörlenmiş notlar · not`**; rozet `data-prompt-source`: not → **"notundan"**, alarm → **"hatırlatıcıdan"**; 0 konsol hatası / 0 başarısız istek
- **v35 canlıda doğrulandı (i18n sweep):** İngilizce modda 7 görünüm tarandı → `filed notes` **temiz**, `dear journal` **temiz**, `all notes` **temiz**, `youtube archive` kategori adları çevrildi; kalan `hits` yalnızca **kullanıcı içeriği** ve **kalıcı seed verisi**; 0 konsol hatası / 0 başarısız istek
- **v36 testlerle doğrulandı (PDF TOC):** 8/8 test geçti — ay gruplama (`2026-03→2`, `2026-01→3`), en yeni ay önce, boş liste → TOC yok, `@page`/`counter(page)` sayfa numarası, İngilizce/Türkçe özet etiketleri. Canlıda TOC gruplama mantığı da doğrulandı (`2026-03→2`, `2026-02→1`, `2026-01→2`)
- **v37 testlerle doğrulandı (PDF anchor):** 10/10 PDF testi geçti; `vite-node` ile gerçek çıktıda `id="entry-2026-03-10-0"` kartları ve `href="#entry-2026-03-18-1"` gün bağlantıları teyit edildi; canlıda 0 konsol hatası / 0 başarısız istek
- **v38 canlıda doğrulandı (yıl karşılaştırma):** bölüm bulundu ("yıllık karşılaştırma · 2 yıl"); **2026 → `4 · 3`**, **2025 → `3 · 2`**; 2025'e tıklayınca detay *"30 kelime · ort. 15 · zirve 2 · 03-10 → 07-01"* ve ısı haritası **2025'e senkron** geçti; 0 konsol hatası / 0 başarısız istek
### ⚠️ QA harness notu
`NotesView` v33'te yalnızca **komut paleti** (⌘K) ve **hero kartı** ile açılıyordu; headless tarayıcıda `Control+K` ve palet butonu paleti açmıyordu. v34'te **sidebar girdisi eklendiği için** artık doğrudan nav ile erişilebiliyor — komut paleti testi gerekmez. Tohum tüketimi hâlâ doğrudan `sessionStorage` yazarak doğrulanıyor.
### ⚠️ TEKRARLAYAN TUZAK (v31'de eklendi)
**`String.prototype.replace` dize kalıbıyla yalnızca İLK eşleşmeyi değiştir.** Çeviri metninde aynı yer tutucu birden fazla geçiyorsa (`"{lang} masası açıldı — arayüzü de {lang} yapalım mı?"`) mutlaka **`replaceAll`** kullanın. Yeni anahtar eklerken yer tutucu sayısını denetleyin:
```js
(val.split("{n}").length - 1) === 1  // beklenen sayı
```

---

## 🔐 9. GÜVENLİK DURUMU — Supabase anahtarı

> ✅ **GÜNCEL SONUÇ (v39.1): Sızıntı YOK, yapılacak bir şey yok.**
> Aşağıdaki «Tarihsel iz» bölümündeki v27 uyarısı **yanlış alarmdı** — kayıt amacıyla duruyor, geçerli değil.

### ✅ Güncel durum (v39.1 — yeniden denetlendi)
v27'de not düşülen "anahtar sızıntısı" iddiası baştan sona denetlendi ve **çürütüldü**. Kanıtlar:

**1) `.env` boş ve güvenli.** `VITE_SUPABASE_URL=` ve `VITE_SUPABASE_ANON_KEY=` — ikisi de **len=0**. Dosya yalnızca hangi anahtar tipinin kabul edildiğini açıklayan Türkçe yorumlar içeriyor. Bulut sync kapalı, uygulama yerel (localStorage) modda çalışıyor.
**2) `sb_secret_` eşleşmeleri anahtar DEĞİL, koddaki tespit literal'i.** `src/lib/supabase.ts` içindeki `looksLikeSecretKey()` fonksiyonu `key.startsWith("sb_secret_")` ile kötü anahtarı **reddetmek için** o string'i arıyor. Aynı literal testte (`supabaseKeyGuard.test.ts`) ve `.env.example` belgesinde de var. v27 taraması bu literal'i gerçek anahtar sanmış.
**3) Canlı bundle temiz.** `https://yourbook-app.vercel.app/` → `/assets/index-BIf8fZgk.js` (1.57 MB) indirildi ve tarandı:
- gerçek `sb_secret_` token: **0**
- JWT (`eyJ….eyJ….…`) token: **0**
- bundle içinde `*.supabase.co` URL'i: **0** (hiçbir Supabase uç noktası/anahtarı istemciye gömülü değil)
**4) `.vercel/.env.production.local`** yalnızca Vercel CLI'ın kendi otomatik değişkenlerini taşıyor; tek JWT `VERCEL_OIDC_TOKEN` (Vercel'in kendi kimliği, `role` yok). Supabase anahtarı yok.
**5) Yereldeki `dist/` bundle'ı da temiz** — aynı guard literal'ini içeriyor, gerçek token yok.

**Savunma katmanı (zaten kodda var):** `supabase.ts` anahtar `sb_secret_` ile başlıyorsa veya `role: "service_role"` içeriyorsa **bulut özelliklerini otomatik kapatıyor** — yani yanlışlıkla secret konsa bile istemciye sızmadan devre dışı kalır. 7 test (`supabaseKeyGuard.test.ts`) bunu koruyor.

**Peki rotate gerekli mi? → Hayır.** İfşa olmuş bir anahtar olmadığı için döndürülecek bir şey yok. Bulut sync'i ileride açmak isterseniz Supabase panelinden **publishable/anon** anahtarı alıp `.env`'e yazmanız yeterli; `sb_secret_` yazmayın (guard zaten reddeder).

<details>
<summary>⚠️ <b>Tarihsel iz — v27 uyarısı (GEÇERSİZ / yanlış alarm)</b></summary>

> **Bu bölüm artık geçerli değil.** Yalnızca "v27'de ne yazıyordu, neden yazıyordu" sorusun kaydı olarak duruyor.
> Çürütülme tarihi: v39.1. Yukarıdaki «Güncel durum» bölümü esas alınmalıdır.

v27'de tespit edildiği iddia edilen durum:
- `VITE_SUPABASE_ANON_KEY` bir `sb_secret_...` service-role anahtarı taşıyor iddiası.
- Vite `VITE_*` değişkenlerini istemci paketine dahil ettiği için anahtarın `dist/assets/*.js` içinde ve canlı sitede herkese açık olduğu iddiası.
- Service-role anahtarının RLS'i tamamen atladığı iddiası.
- Anahtarın istemci auth'u için yanlış tipte olduğu iddiası.

**Neden yanlıştı:** Tarama, `src/lib/supabase.ts` içindeki **koruma kodun string literal'ini** (`"sb_secret_"`, anahtarı reddetmek için kullanılıyor) gerçek bir anahtar sanmıştı. `.env` zaten boştu ve canlı bundle'da tek bir gerçek token yoktu.

</details>

---

## 📦 8. v26 Üretim Scriptleri (saas-project, geçici)

| Script | İş |
|---|---|
| `extract-tr2.mjs` | vite-node ile tr kaynak anahtarlarını `tr-keys.json`'a çıkarır |
| `gen-locale.mjs <code> "<Ad>"` | `{code}-map.json` → `locales/<code>.ts` + `<code>-extra.ts` (parity kontrolü dahil) |
| `add-keys.mjs` | **GÜVENLİ** locale anahtar ekleyici (kapanış `};` öncesi splice + virgül garantisi) |
| `fix-border15.mjs` | `border-1.5` → `border-[1.5px]` |
| `rtl-convert2.mjs` | Fiziksel yön sınıfları → mantıksal (Tailwind v4) |
| `find-stale-memo.mjs` | `t()` çağırıp bağımlılıkta `t` olmayan `useMemo`'ları bulur |
| `qa*.mjs` | Headless tarayıcı QA senaryoları (günlük, trend, spread, diller, RTL, ısı haritası, dikte, cilt, sync, 8 dil, i18n sweep, PDF) |
| `audit-tr.mjs` | Kaynakta kalan sabit Türkçe metinleri bulur (yorum/`t()`/ölü bileşen ayıklayarak) |
| `addkeys.mjs` | Yeniden kullanılabilir **güvenli** locale anahtar ekleyici + `auditPlaceholders()` |
| `gen-locale.mjs <code> "<Ad>"` | `{code}-map.json` → `locales/<code>.ts` + `<code>-extra.ts` (parity kontrolü dahil) |
| `register-locale.mjs <code> <Ad> <bayrak> [dir]` | index.ts'e dil kaydı — ⚠️ UI_LANGUAGES satırının **diziye** eklendiğini mutlaka doğrula (interface'e kaçabilir) |
| `env-check.mjs` | `.env` içindeki Supabase anahtar tipini güvenli raporlar (secret tespiti) |

---

*Bu dosyayı `C:\Users\yalci\CodeGPT\saas-project\progress.md` ve `C:\Users\yalci\CodeGPT\lexi-cards\PROGRESS.md` olarak senkron tut.*