# yourbook — Devam Notu (progress1.md)

> **Amaç:** Yeni bir chatte kaldığımız yerden devam etmek.
> Bu dosya tüm kararları, mevcut durumu ve yapılacakları içerir.

---

## 1. PROJE KONUMU (ÖNEMLİ)

| |
|---|---|
| **Asıl kod** | `C:\Users\yalci\CodeGPT\lexi-cards` |
| **Çalışma/geçici dosyalar** | `C:\Users\yalci\CodeGPT\saas-project-2-2` |
| **Canlı (Vercel)** | https://yourbook-app.vercel.app |
| **Diğer aliaslar** | yourbook-defter.vercel.app · yourbook3.vercel.app |

**KRİTİK:** Kod düzenlemeleri `lexi-cards` içinde yapılır. Editör aracı
`lexi-cards`'a erişemez (sandbox) — bu yüzden dosyalar **PowerShell veya Node
scriptleri** ile düzenlenir. `saas-project-2-2` geçici script/çıktı klasörüdür.

---

## 2. DOĞRULAMA DÖNGÜSÜ (her değişiklikten sonra)

```powershell
cd 'C:\Users\yalci\CodeGPT\lexi-cards'
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npx tsc --noEmit          # 0 hata olmalı
npm test                  # 259/259 geçmeli
npm run build             # başarılı olmalı
```

**Deploy:**
```powershell
$env:CI='1'; npx vercel --prod --yes
# çıkan deployment URL'ini aliaslara bağla:
npx vercel alias set <deploy-url> yourbook-app.vercel.app
npx vercel alias set <deploy-url> yourbook-defter.vercel.app
npx vercel alias set <deploy-url> yourbook3.vercel.app
```

**Canlı doğrulama:**
```powershell
node "C:\Users\yalci\.codegpt\skills\browser-automation\browser.mjs" "https://yourbook-app.vercel.app/" --script "<qa-script>.mjs"
```

---

## 3. GÜVENLİ TEST KURALI (çok önemli — defalarca hata yapıldı)

### Oturum açma (login ekranını geçmek)
Test scriptlerinde `addInitScript` **güvenilir çalışmıyor**. Şu desen kullan:
```js
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('yourbook_auth_user_v1', JSON.stringify({
    id:'qa-local', email:'qa@local.test', displayName:'QA',
    avatarLetter:'Q', isCloud:false, createdAt:Date.now()
  }));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
// doğrula:
const loggedIn = await page.evaluate(() => !/giriş yap|kaydol/i.test(document.body.innerText));
```

### ELEMANIN GERÇEKTEN GÖRÜNÜR OLUP OLMADIĞINI ÖLÇ
**`getBoundingClientRect()` YALAN SÖYLER** — transform/clip/overflow durumlarında
kutuyu doğru verir ama eleman görünmez/tıklanamaz olabilir.

**Doğru yol:**
```js
const r = el.getBoundingClientRect();
const cx = Math.round(r.left + r.width/2);
const cy = Math.round(r.top + r.height/2);
const hit = document.elementFromPoint(cx, cy);
const works = hit === el || el.contains(hit);   // gerçekten tıklanabilir mi?
```
Bu kural sayesinde "buton var" dediğim halde kullanıcı göremediği
(aside overflow:hidden ile kırpılan) hata bulundu.

---

## 4. MEVCUT DURUM — TAMLANMIŞ İŞLER (hepsi canlıda)

| # | İş | Detay |
|---|---|---|
| 1 | **Sidebar sürükleme kaldırıldı** | Panel artık yalnızca ok butonu / Ctrl+B ile açılıp kapanıyor. `isResizing` tamamen silindi (−40 satır). |
| 2 | **Sidebar gizle/göster butonu** | `‹`/`›` siyah yuvarlak buton, `+` (takvim) butonun 1px solunda. Panel gizliyken de görünür ve tıklanabilir. `aside`'ın **dışında** (`App.tsx`) — çünkü `aside` `overflow:hidden` ve içindeki butonu kırpıyordu. |
| 3 | **Ctrl+B kısayolu** | Buton ile aynı kaynağı kullanır: `useSidebarVisibility` hook'u (localStorage + window event). |
| 4 | **Noktalı arka plan hatası** | Sarmalayıcı `min-w-[280px] max-w-[280px]` idi; panel daralınca arkada kağıt dokusu görünüyordu. `w-fit` + sidebar rengi yapıldı. |
| 5 | **Sidebar scrollbar kaldırıldı** | `.scrollbar-none` sınıfı eklendi (global `.scrollbar-thin` 14 yerde kullanıldığı için ona DOKUNULMADI). |
| 6 | **Sidebar menü hizalaması** | 7 menü öğesinin yazıları aynı X'te: `gap-2.5` + `w-[22px]` sabit ikon kolonu. (önce 15px kayma vardı) |
| 7 | **Menü öğe araları** | `space-y-[3px]` (tutarlı). Gruplar arası 8px. |
| 8 | **Grup başlıkları eşitlendi** | DEFTER BÖLÜMLERİ / TEMALAR / ARAYÜZ DİLİ üçü de `mt-3 mb-1 px-2`; başlık→ilk öğe 4px. |
| 9 | **Grup başlığı üst boşluğu** | Scroll kabına `pt-2` (8px) — margin-collapse yüzünden etkisiz olan `mt-3` yerine. |
| 10 | **XP/seviye kartı** | 49px → **39px** (`pt-1.5 pb-1`, iç satır `pb-1` — çift boşluk kaldırıldı). |
| 11 | **Marka alt yazısı** | "çalışma defteri & ajanda" **15.5px → 14px** (inline `style={{fontSize}}` vardı, Tailwind sınıfı eziliyordu). |
| 12 | **"gece mürekkebi" teması kaldırıldı** | Tema tanımı + **10 dilde** i18n anahtarları (30 referans). Seçiliyse ilk temaya düşer. |
| 13 | **"özelleştir" butonu** | "yeni çalışma masası" gibi yapıldı: `border-[1.5px] border-dashed border-[var(--ink)]` + `bg-transparent` (önce beyaz kutu + solid çerçeve). |
| 14 | **Defter sticker'ları** | ⚡/🌱 sticker'ları kartın üstünden taşıyordu (`-top-3` + kart `rotate-2deg`). `top-0` yapıldı. |
| 15 | **Üst buton hizası** | "defter hediye et" + ⚡ + ♥ hepsi `mid: 29`'da. Rozet satırına `h-9` verilince **çizgi dengesi bozulmuştu**, `h-20` (80px) ile düzeltildi. |
| 16 | **Çizgi dengesi** | Sidebar logo bloğu **y=80** = hero rozet satırı **y=80** (`diff: 0`). Hero container `pt-[22px]`. |
| 17 | **Defter kartı konumu** | `mt-[50px]` — kart 50px aşağı alındı (başlık/paragraf etkilenmedi, grid `items-start`). |
| 18 | **Gülen yüz emojisi** | `mt-[38px]` (yazının taban hizasının altında). |
| 19 | **El çizimi ok** | `131×70` (önce 84×44 — **%25 büyütüldü**). `ARROW_W=131, ARROW_H=100, availH alt sınır=70`. |
| 20 | **Ok → emoji boşluğu** | **`4px`** — emojinin **gerçek alt çizgisinden** (SVG `bottom`). |


---

## 4-B. BU OTURUMDA TAMLANANLAR (canlıda)

| # | İş | Detay / kesin değer |
|---|---|---|
| 41 | **`‹` + `+` butonları 2px sağa** | `App.tsx`: `left: sidebarWidth - 85` → **`- 83`**. `SuperrSidebar.tsx` başlık satırı: `p-4` → **`pl-4 pr-[14px]`** (sağ padding 16→14, içerik 2px sağa). Ölçüm: `‹` 195→**197**, `+` 230→**232**, aralarındaki 3px korundu.|
| 42 | **Tagline 3px küçültme** | `SuperrSidebar.tsx` logo altı "çalışma defteri & ajanda": inline `fontSize: "14px"` → **`"11px"`**. Ölçüm: 156.42×21 → **122.91×16.5**. |
| 43 | **Sidebar "Almanca Masası" rozeti → "6 dil masası"** | `SuperrSidebar.tsx` "dil masaları" grubun sağ rozeti: `{activeSpace.nameKey ? t(activeSpace.nameKey) : activeSpace.name}` → **`{t("hero.n_lang_desks").replace("{n}", "6")}`**. 10 dilde doğru çeviri. |
| 44 | **Rozet el yazısı fontu** | Aynı rozet `font-mono` → **`font-handwritten`** (sidebar'daki diğer rozetlerle font birliği). Genişlik 70→58.1px. |
| 45 | **Ritüel paneli gölgesi siyah** | `OpeningRitualCard.tsx`: inline `shadow-[3px_4px_0_0_color-mix(var(--ink)_28%)]` → **`shadow-superrCard`** (index.css: `4px 5px 0 0 color-mix(var(--ink) 85%)`). Hero kartlarıyla **birebir aynı** ölçüldü. |
| 46 | **Tagline 2px küçültme** | `SuperrSidebar.tsx`: `"14px"` → **`"12px"`** (İspanyolca "cuaderno de trabajo y agenda" 189→134px). |
| 47 | **Hero 4 buton arası +1px** | `SuperrHero.tsx`: `gap-[4px]` → **`gap-[5px]`**. Ölçüm: `gaps: [5,5,5]`, buton genişlikleri DEĞİŞMEDİ. |
| 48 | **`‹` ile `+` dikey hizası** | `App.tsx`: `top: 24` → **`top: 21.5`** (hem `‹` hem gizli `›`). Ölçüm: delta **0** (`‹` 24→21.5, `+` sabit 21.5). |
| 21 | **Gülen yüz + ok TEK PARÇA** | Ok artık `absolute` değil; gülen yüzle aynı `inline-flex flex-col` grubunda. El yazısı tipi değişse bile ikisi birlikte hareket eder, kaymaz. |
| 22 | **Gülen yüz → ok görsel boşluğu = 2px** | Ok: `className="pointer-events-none mt-[-10.3px]"` (SVG iç çizim payı telafisi). 3 fontta ölçüldü: `2.01px` sabit. |
| 23 | **Sidebar çizgisi = hero çizgisi** | Hero konteyner üst boşluğu `sm:py-10` → `sm:pt-[15px]`. İki çizgi de `y=80`. Altındaki her şey yukarı geldi. |
| 24 | **`"gece mürekkebi" yerine `sammi & yuvarlak` el yazısı kaldırıldı** | `HANDWRITING_STYLES`'tan `caveat` çıkarıldı. Yeni varsayılan: **`kalam`**. 10 dilde `font.caveat.*` referansları temizlendi. |
| 25 | **Footer `your`/`book` renk düzeltmesi** | `book` ve altındaki cümle **`text-[var(--app-bg)]`** (krem). Önceki oturumda yanlışlıkla `--accent` yapılmıştı → turuncu üstü turuncu, metin görünmezdi. |
| 26 | **Hero footer'da 4 buton** | `Almanca`/`İngilizce` butonları kaldırıldı → **6 Dil Masası · İş & Projeler · Takvim & Ajanda · Günlük**. Aralarında `gap-[4px]`. |
| 27 | **4 buton 10 dilde çevrildi** | `hero.btn_desks` / `btn_work` / `btn_calendar` / `btn_daily` — 10 locale dosyasında. |
| 28 | **`ihale` kelimesi kaldırıldı** | `hero.notes_desc` → 10 dilde "tender/ihale" çıkarıldı. |
| 29 | **Font boyutları (bu oturumda)** | `merhaba çalışkan insan`: `clamp(41px,4vw,53px)`. Intro cümlesi: `text-[32px] sm:text-[34px]` (+13px toplam). Vurgulu `gerçekten`: `36px` sabit. `defter hediye et`: `14px`. |
| 30 | **Başlıkta kelime boşlukları** | `defter` ↔ `açmak kadar` ↔ `sıcak` ↔ `olmalı.` aralarına `{"? " : ""}` ile tek boşluk. |
| 31 | **AÇILIŞ RİTÜELİ kartı** | Keçeli kalem konturu: `border-[2.5px] border-dashed border-[color-mix(ink 55%)]` + grafit gölgesi `shadow-[3px_4px_0_0_color-mix(ink 28%)]`. İkon kutusu `w-[35px] h-[35px]`. |
| 32 | **Sidebar `‹` butonu** | `left: sidebarWidth - 85` (1px sola). |
| 33 | **Defter kartı: iki masa → tek kart** | `ALMANCA MASASI`/`İNGİLİZCE MASASI` → tek **`6 dil masası`** kartı (`t("hero.n_lang_desks").replace("{n}","6")`). |
| 34 | **`kelime durumu` paneli sağa dikey bant** | `StudyDesk` dış sarmalayıcı: `lg:flex-row lg:gap-6`; içerik sütunu `lg:mx-0 lg:max-w-none`. |
| 35 | **Kelime kartı arkasındaki beyaz katman kaldırıldı** | `hasStack && currentCard && <div ... bg-[var(--paper)]>` bloğu silindi. |
| 36 | **4 aksiyon butonu kartın hemen altında** | Kart alanı `flex flex-1` → `flex`; aksiyonlar `mt-5` → `mt-4`. |
| 37 | **Kart alanı 20px aşağı** | `mt-[60px]` → `mt-[80px]`. |
| 38 | **ANLAM ETİKETİ ARAYÜZ DİLİNE BAĞLI (kritik bug!)** | `cards.tr_meaning` (her dilde "türkçe anlamı" yazıyordu) → **`cards.meaning`**. Her dilde kendi dili: tr `türkçe anlamı`, en `english meaning`, de `deutsche Bedeutung`, es `significado en español`… `QuickAdd.tsx` + `StickyCard.tsx`. |
| 39 | **Örnek kelime destesi KALDIRILDI** | `INITIAL_ALL_CARDS: WordCard[] = []`. `deck.ts` içindeki 8 örnek (nehmen/warten/Geduld/Geheimnis/serenity/resilience/ubiquitous/epiphany) artık yüklenmiyor. |
| 40 | **Eski localStorage temizliği** | `sanitizeCards` içine `isRemovedSample()` filtresi: 8 örnek **kelime+dil+anlam üçlüsü** eşleşirse ayıklanır — **kullanıcının kendi kelimeleri KORUNUR**. |

### Bu oturumda öğrenilen KRİTİK dersler

1. **`usage rights` / sandbox:** Editör aracı `lexi-cards`'a **erişemez**. Tüm düzenlemeler
   PowerShell/Node `.mjs` scripti ile yapılır. Ama editör **`saas-project-2-2`**'ye erişebilir —
   bu yüzden scriptler orada tutulur.
2. **`fs.writeFileSync(PATH, ICERIK, "utf8")` = 3 ARGÜMAN.** Eksik içerik argümanı
   (`fs.writeFileSync(p, "utf8")`) dosyayı **SİLER** — bu oturumda `SuperrHero.tsx`'i 4 byte'a düşürdü.
   Düzenleme sonrası **her zaman** dosya boyutu + `tsc --noEmit` ile doğrula.
3. **Ekran görüntüsüne GERÇEKTEN bak.** `true`/`false` çıktısına bakıp geçmek yetmez — bu oturumda
   "onStudyDesk: true" deyip bozuk bir tasarımı onayladım. Görsel sonuç sayısal ölçümden önemli.
4. **`elementFromPoint` ile tıklanabilirliği doğrula.** `getBoundingClientRect` transform/overflow
   durumunda yalan söyler.
5. **Kelime kelime boşluklar i18n parçalarından gelir.** `tagline.a/b/c/d` gibi parçalar birleşirken
   aralarına `{"? " : ""}` koymak gerekir; yoksa `açmak kadarsıcak` gibi bitişik yazı çıkar.
6. **Renk = arka plan çakışması.** Turuncu bandın üstüne turuncu metin koyma — bu oturumda footer
   metni bu yüzden görünmez oldu. Bandın kendi metin rengini kullan.
7. **Vercel rollback hayat kurtarır.** `npx vercel rollback <deploy-url> --yes` ile canlıyı anında
   eski sağlam sürüme döndürebilirsin (bu oturumda `SuperrHero` silinince kullanıldı).
8. **Yedek alma kuralı.** Her değişiklikten önce `<Dosya>.BEFORE-<ne>.bak.tsx` olarak `saas-project-2-2`'ye
   kopyala. Beğenilmezse tek komutla geri dönülür (`REVERT-*.mjs`).

### QA testinde öğrenilenler (7-hata oturumu)
9. **Gerçek depolama anahtarı: `yourbook_deck_v7_clean`** (dizi) ve **`lexi_engagement_v1`** (XP).
   Kart alanları: `id, lang ("DE"/"EN" BÜYÜK HARF), word, translation ("meaning" DEĞİL!),
   note, tags, createdAt, learnedAt, reviewAt, grammar`. Yanlış alan adı → `sanitizeCards` kartı ELER.
10. **Kelime ekleme UI akışı:** masa → `yeni kelime ekle` → alan 0 = kelime, alan 1 = anlam
    → buton **"deftere ekle"** (`t("quick.add_btn")`, Enter değil!).
11. **Öğrenme butonu metni:** `öğrendim!` / `hatırlayamadım`. Kart metni input/textarea
    içinde olabilir — ölçümde `h1,h2,h3,div,span,p,textarea,input` tara.
12. **Sınav akışı:** `[data-quiz-open="1"]` → modal → **"sınavı başlat"** butonu.
    Modal açıkken arkadaki kartı okumak YANLIŞ sonuç verir.
13. **"Masa bitti" durumu normaldir.** Masa bitince kart alanı boşalır ve
    "masa tertemiz!" mesajı çıkar (kasıtlı). Kullanıcı bunu "kırıldı" sanıyor —
    QA'da "kart gelmiyor" demek yerine **masa sayacını** (`yeni kelimeler N`) kontrol et.
14. **Yatay taşma testi:** `document.documentElement.scrollWidth > window.innerWidth`.
15. **Dayanıklı script yazma (PowerShell tuzağı):** `@'...'@ | Set-Content` içinde kaçak
    tırnak/regex bozulur. Uzun JS'i `write` aracıyla `.mjs` dosyasına yaz, `node --check`
    ile sözdizimini doğrula. Klasör adında `_` olmasın (`_scratch/` yerine kök kullan).
16. **`playwright` sadece `lexi-cards\node_modules`'da.** Script'i oraya kopyala, iş bitince sil.
17. **React `key` eksikliği = "kart gelmiyor" hatası.** Liste/kart bileşenine `key` verilmezse React
    **aynı instance'ı korur** ve state (örn. `isLearnedAnimating`) **kart değişse de eski değerinde kalır**.
    Animasyon koşullu render ediliyorsa yeni içerik **hiç görünmez**. Belirti: "sayfa yenilenince düzeliyor".
    Çözüm: `key={item.id}` + state reset güvenlik ağı. `StudyDesk.tsx` bu yüzden bozuktu.
18. **Koşullu `animate`/`opacity` tuzağı.** Bir bileşen animasyon halindeyken (`opacity:0`) yeni veriyle
    yeniden render edilirse `opacity:1` dalına geçmeyebilir. Ölçümde **ataların `opacity` zincirini tara**:
    `while (el) { if (getComputedStyle(el).opacity !== "1") ... }` — bu, hatayı anında gösterir.
19. **Görünürlük ölçümünde `closest("article, div")` YANILTICI.** Çok küçük bir iç elemanı yakalar.
    Doğrusu: kelime metnini **en büyük alanlı** elemanda bul, sonra `elementFromPoint` ile doğrula.
20. **"Kart alanı boş" şikayetinde önce masa sayacına bak.** `yeni kelimeler: 0` ise masa bitmiştir
    ("masa tertemiz!" mesajı çıkar) — bu **hata değil**. QA'da bunu ayırt et, yoksa yanlış teşhis koyarsın.
21. **Soru tiplerinde "hangi alan soruluyor?" açık olmalı.** `grammar` tipi kaldırıldı çünkü:
    (a) soru metni alanı söylemiyordu (`grammarLabel` hesaplanip **render edilmiyordu**),
    (b) distractor'lar **farklı `label`'lardan** geliyordu → örnek cümle + tanım + kalıp aynı soruda.
    Kural: bir soru tipinde şıklar **aynı türden** olmalı (hep tanım, hep kelime, hep cümle).
22. **Sınav modalını ölçerken TÜM SAYFAYI tarama.** `querySelectorAll("button")` sidebar
    butonlarını da toplar (`yerel profil`, `ara veya komut...`) → yanlış teşhis. Modal kökünü bul
    (`[role=dialog]` veya `z-index >= 50` + ekran kaplayan), **sadece onun içinde** ara.
23. **"sonraki" butonu olmayabilir.** Sınav şık seçilince **otomatik** ilerliyor; testte
    `ileri/sonraki` aramak boşuna. Aynı sorunun tekrarlanması bu yüzden normaldir.
24. **Masa butonu metni birleşik olabilir.** Sidebar'da `"Almanca MasasıAlmanca A1-B2"` gibi
    bitişik; regex'te noktalı/noktasız i (`ingilizce` vs `İngilizce`) farkı butonu bulamaz.
25. **Regex'te çift ters bölü tuzagı (`/[,\\s]+/`).** Fazladan bir `\` karakter sınıfını bozar:
    `\s` yerine **ters bölü + `s` harfi** ayırıcı olur. Belirti: `"#test"` → `"#te" + "#t"`.
    Şüphelendiğinde regex'i **byte düzeyinde** kontrol et: `JSON.stringify(satır)`.
26. **Input temizleme + `maxLength` birlikte gerekir.** Sadece `maxLength` yetmez;
    her denemeden sonra state'i sıfırla (`setX("")`), yoksa eski değerin üstüne eklenır.
27. **PIN/kilit gibi “guard” state'leri kurduktan sonra HEMEN güncelle.**
    `setPin(...)` tek başına yetmez; `setIsUnlocked(false)` da çağrılmalı, yoksa sayfa
    yenilenmeden kilit ekranı açılmaz (tık sessiz kalır).
28. **`alert()` yerine görünür hata elemanı kullan.** `alert` bloklar, test edilemez ve stil verilemez.
    Doğrusu: state + `role="alert"` + `aria-live="assertive"`.
29. **Tema/CSS performansında `cssText` KULLANMA (dikkat).** `<html>`'de başka inline değişkenler
    olabilir (örn. `--font-handwritten`); `cssText` hepsini EZER. `setProperty` ile sadece
    hedef değişkenlere dokun.
30. **Sınav modalı butonu: `"kilidi aç"` / `"kaydet"`** gibi metinler `t()` ile çevrili ve
    birleşik olabilir (`"giriş & defter kapağı"` yanlış hedef). Form `submit` event'i daha güvenilir.
31. **Not formu alan seçimi:** arama kutusunun placeholder'ı da `"...etiketlerde ara..."` içerdiği
    için `/etiket/i` **yanlış alanı** seçer. `startsWith("etiketler (#")` gibi kesin eşleşme kullan.

### Supabase / bulut tuzakları (bu oturumda öğrenildi — ÇOK ÖNEMLİ)
32. **Vercel env değerinin BAŞINA BOŞLUK giriyor (PowerShell pipe).**
    `$URL | npx vercel env add ...` → değer ` https://...` olarak kaydolur.
    Sonuç: `supabaseUrl.startsWith("http")` **false** → `isCloudConfigured=false` →
    **auth sessizce yerel moda düşer** (hata vermez!). `vercel env ls` değeri gizli
    gösterdiği için göremezsin. **Doğru yol:** Node ile
    `spawnSync("npx", [...], { input: value + "\n", shell: true })`.
    **Doğrulama:** bundle'da `kF=\`https://...\`` (başında boşluk YOK) olmalı.
33. **`.single()` 0 satırda HATA verir (`406`).** Yeni kullanıcıda `user_sync_store`
    satırı yoktur → `PGRST116`. **`.maybeSingle()`** kullan (0 satır = geçerli).
34. **Migration onayı YARIŞ (race) sorunu.** Kayıt anında hem `App.tsx` (onAuthStateChange
    üzerinden) hem `AuthModal` `performCloudSync` çağırır. **Önce çalışan** satırı oluşturur,
    diğeri `else` dalına girmez → rapor `undefined` → **onay gösterilemez**.
    **Çözüm:** `window.dispatchEvent(CustomEvent("yourbook:migrated"))` + `App.tsx` seviyesinde
    dinleme + prop ile `AuthModal`'a iletme. Ayrıca **`if (!migrationNotice) onClose()`**
    (onay varken modal açık kalsın).
35. **Onay mesajını HEM form HEM profil görünümüne koy.** Kayıt sonrası kullanıcı
    "giriş yapılmış" olur → modal **profil dalına** geçer; mesaj yalnızca `<form>` içindeyse
    **görünmez**. İki yere de ekle.
36. **RLS'i anon anahtarıyla test et:** `apikey: <anon>` ile `user_sync_store` sorgusu
    **`[]` dönmeli**. Dönmezse RLS çalışmıyor (veya `grant` yanlış rolde).
37. **`apikey` header'ına ACCESS TOKEN koyma.** `apikey: <anon key>` (public),
    `Authorization: Bearer <access_token>` (kullanıcı). Karıştırırsan `401 Invalid API key`.
38. **Migration yalnızca İLK kayıtta çalışır.** Hesap zaten varsa onay mesajı çıkmaz
    (doğru davranış). Test için **yeni bir e-posta** kullan.

### Responsive / mobil tuzaklar (bu oturumda öğrenildi)
39. **Breakpoint'i taşırken TÜM bağımlı sınıfları güncelle.** `md→lg` yaparken `md:hidden`
    (mobil bileşenler), `hidden md:flex` (masaüstü), `md:flex-row` (düzen) **ve**
    `pb-16 md:pb-0` (alt menü boşluğu) **birlikte** değişmeli. Birini unutursan
    (ör. padding) **içerik alt menünün altında kalır** — görünmez ama gerçek hata.
40. **`sm:` breakpoint'i tablette beklenmedik sonuç verir.** `sm:flex-none` (**640px**)
    devreye girince `flex-1` eşitliği bozulur → tablet'te sekmeler **farklı genişlikte**.
    Tablet'te eşitlik istiyorsan `sm:` değil **`lg:`** kullan.
41. **Mobil düzeni genişletirken oranı ÖLÇ.** Sabit kenar çubuğu (280px) + dar içerik:
    768px'te **%34 kenar / %66 içerik** = sıkışık. Kural: **kenar çubuğu > %30** ise
    o genişlikte **mobil düzen** daha iyidir (özellikle dokunmatikte).
42. **`{theme.icon}` gibi opsiyonel ikonlar boş gelebilir.** Tema seçici dairesinde
    ikona güvenmek yerine **`theme.accent` rengini göster** → her temada **garantili görünür**.
43. **Uzun etiketler alt menüyü bozar.** `white-space: normal` + dar buton = **2 satır** →
    çubuk dengesiz. Çözüm: **`whitespace-nowrap` + `truncate` + sabit yükseklik + eşit genişlik**
    ve gerekirse **kısa çeviri anahtarı** (`cover_short` = "kapak") — 10 dilde ekle.
44. **Aynı bilgiyi iki yerde göstermeden önce KAYNAĞINI kontrol et.** DE/EN butonları
    "arayüz dili" sanılabilir ama `onSwitchSpace` çağırıyorsa **dil masası seçicidir** →
    global header'da değil, **o masa ekranında** gösterilmeli.
45. **Ekran görüntüsünü GERÇEKTEN incele (yine).** Ölçüm "drawer açılmadı" dedi ama
    görselde **açıktı** — `elementFromPoint` overlay'i yakalamıştı. Sayısal ölçüm + görsel **birlikte**.

---

## 4-C. 7 KRİTİK HATA DÜZELTMESİ (canlıda)

| # | Hata | Kök neden + düzeltme |
|---|---|---|
| 46 | **SRS akışı "öğrendim!" sonrası** | `StickyCard.tsx` `handleLearnClick`: `setTimeout(850ms)` **temizlenmiyordu** → kart değişince eski timeout ateşleniyordu. `learnTimerRef` + `learnFiredRef` ile tek-atış kilidi ve `useEffect` cleanup eklendi. Akış canlıda doğrulandı: 4 kelime ardışık geçti. |
| 47 | **Sınav sorusu kimin olduğu belirsiz** | `quiz.ts`: `grammar`/`article` sorusunda `prompt` **sadece** etiketti ("Sıfat"). Artık `prompt` hedef kelimeyi içeriyor + **`targetWord`** alanı eklendi. `QuizMode.tsx`: `{current.promptSubKey}` (ham i18n anahtarı!) → **`t(current.promptSubKey)`** + hedef kelime bağlamı. Canlı doğrulama: soru `schreiben` + "bu anlamın kelimesi ne? · schreiben" + 4 şık. |
| 48 | **`resilienceresilience` metin birleşmesi** | `QuizMode.tsx` "Yanlışları Gözden Geçir": `{c.word}` **iki kez** render ediliyordu (duplicate satır). Fazla satır silindi. |
| 49 | **"sevgili günlük" yatay taşma** | `JournalView.tsx` aksiyon satırı `flex items-center gap-2` (flex-wrap **yok**) → **`flex w-full flex-wrap ... sm:w-auto`**. Tüm sayfa yatay kayıyordu. |
| 50 | **Takvim varsayılan gün 1 gün önce** | `CalendarAgendaView.tsx`: yazma `selectedDate.toISOString()` (**UTC'ye çeviriyor!**) → **`toDateKey(selectedDate)`** (yerel). Okuma: `new Date(raw)` → `YYYY-MM-DD` ise **`new Date(y, m-1, dd)`** yerel parse. Ölçüm: `kayitli=2026-09-21 = bugun=2026-09-21`. |
| 51 | **XP göstergeleri tutarsız** | Sidebar `todayXp` (günlük) gösteriyordu ama "XP" yazıyordu → **`totalXp ?? todayXp`**. `totalXp` prop'u eklendi, `App.tsx`'ten `engagement.xp` bağlandı. Tooltip `tip.daily_xp` → **`tip.total_xp`** (10 dilde eklendi). `{...}{\" XP\"}` ile bitişiklik korundu. Ölçüm: `sidebar=240 = kayitli=240`. |
| 52 | **Çift kutlama toast'ı** | **2 kaynak** vardı: `XpToast` (sağ alt) + `FloatingXp` (her zaman render, `spawn` prop'u kullanılmıyor → `amount` undefined → sürekli "+ XP"). `FloatingXp` render + tetikleyicileri kaldırıldı. `XpToast` `bottom-24 end-6` → **`top-20 end-6`** (sağ alt yığından çıkarıldı). WordStatusPanel mini oyun kartına **`mb-10`** (Inspect düğmesiyle çakışıyordu). Ölçüm: kart `y785-863` → **`y745-823`**, Inspect `y850` → **27px boşluk** ✓ |

---

## 4-D. SON TUR: 3 KRİTİK DÜZELTME (canlıda)

| # | Hata | Kök neden + düzeltme |
|---|---|---|
| 53 | **SRS: "öğrendim!" sonrası kart alanı BOŞ kalıyordu** | **Kök neden:** `StudyDesk.tsx`'te `<StickyCard card={currentCard} />` çağrısında **`key` prop'u YOKTU**. React aynı instance'ı koruduğu için `isLearnedAnimating` state'i **kart değişse de `true` kalıyordu**; yeni kart `animate={isLearnedAnimating ? {...} : {opacity:1}}` ifadesinin **animasyon dalında** kalıyor ve `opacity:1` hiç uygulanmıyordu → kart görünmez. F5'te component yeniden mount olunca düzeliyordu (veri kaybı yoktu). **Çözüm:** (a) `key={currentCard.id}` eklendi → kart değişince yeni instance mount olur, tüm state sıfırlanır. (b) Güvenlik ağı: `StickyCard` içinde `card.id` değişince `setIsLearnedAnimating(false)` + `setShowStampBadge(false)`. **Doğrulama:** 4 kelime art arda öğrenildi, her kartta `elementFromPoint` + atalarda `opacity` tarandı → `faded=[]` (hiç soluk ata yok). |
| 54 | **Vurgu (highlight) kutusu gevşek + asimetrik** | `index.css` `.marker-highlight`: `padding: 0.06em 0.04em` → **`0.02em 0.05em`** + `border-radius: 0.1em`. **Ölçüm (font-size 84px):** önce `5.04px 3.36px` (dikey **yataydan büyük** = gevşek, kutu 105.06px) → sonra `1.68px 4.2px` (`pt=pb`, `pl=pr` **tam simetrik**, kutu 98.34px). |
| 55 | **Kapak kartındaki "ders:" satırı sabit (REGRESYON)** | **3 katmanlı kök neden:** (1) `SuperrStickers.tsx` → `{deskSub ?? t("hero.desk_sub")}`, `SuperrHero` `deskSub` prop'unu **hiç geçmiyordu** → sessizce 10 dildeki sabit metne düşüyordu. Sabit fallback **tamamen kaldırıldı**. (2) `"6"` **iki ayrı yerde** bağımsız sabitti (`SuperrHero.tsx` + `SuperrSidebar.tsx`). (3) **Asıl neden:** `"6"` **10 çeviri dosyasına kopyalanmıştı** (`hero.btn_desks` = "6 Dil Masası", "6 Language Desks", "6 Sprachtische"...). **Çözüm:** hepsi `{n}` şablonuna çevrildi; sayı artık **`lib/languages.ts → LANGUAGES.length`**'ten gelir (tek doğruluk kaynağı). Yeni dil eklenince hero butonu + sidebar rozeti + kart alt yazısı **otomatik** güncellenir. Canlı doğrulama: `hardcodedAlmanca: false`, üç gösterge de tutarlı. |
| 56 | **Sınav modu "bu alanın doğru değeri ne?" sorusu BOZUK** | **İki yapısal sorun:** (a) Soru metni **hangi alanın** sorulduğunu söylemiyordu — `grammarLabel` hesaplanıyordu ama `QuizMode.tsx:243`'te **hiç render edilmiyordu**. (b) Distractor'lar **farklı `label`'lardan** geliyordu: `others.reduce → (c.grammar ?? []).forEach` **tüm** değerleri havuza atıyordu → aynı soruda hem örnek cümle (`"He had an epiphany..."`) hem tanım (`"ubiquity (present everywhere)"`) hem kullanım kalıbı (`"to have an epiphany"`) şık oluyordu. **Çözüm (kullanıcının tercih ettiği güvenli yol):** `grammar` tipi **tamamen kaldırıldı** — `QuizQuestionType`, üretim bloğu, `grammarLabel`/`grammarFieldLabels` alanları, `GRAMMAR_KEYS`/`grammarLabels` ve 3 test. Kalan tipler **net ve doğru**: `wordToTrans` (bu kelimenin anlamı ne?) · `transToWord` (bu anlamın kelimesi ne?) · `article` (bu kelimenin artikeli ne?). **Canlı doğrulama:** 2 masada — Almanca `"bu kelimenin anlamı ne? · schreiben"` şıklar `almak/beklemek/yazmak/okumak`; İngilizce `"bu anlamın kelimesi ne? · ubiquitous"` şıklar `ubiquitous/resilience/epiphany/serenity`. Hepsi **tek tür (KISA)**, karışık şık YOK, i18n sızıntısı YOK. |

---

## 4-E. SON TUR: 5 DÜZELTME (canlıda)

| # | Hata | Kök neden + düzeltme |
|---|---|---|
| 57 | **Tema değiştirirken yavaşlık** | **Ölçülen:** medyan 155ms tıklama→paint, 70-186ms long task (823 element). **Kök nedenler:** (1) CSS değişkenleri **iki katmana** yazılıyordu — hem `<html>` (`useEffect` + 10× `setProperty`) hem kök `<div>` (`style` prop) → çifte yeniden hesaplama. (2) Gereksiz `root.style.backgroundColor` + `document.body.style.backgroundColor` → fazladan layout. (3) `meta[theme-color]` her temada güncelleniyordu. **Düzeltme:** kök div inline `style` bloğu **tamamen silindi**, `backgroundColor` yazımları kaldırıldı, meta **koşullu** güncelleniyor, `setProperty`'ler `themeVars` dizisinde toplandı. **Sonuç:** medyan **155 → 112ms (%28)**. ⚠️ `cssText` denemesi **geri alındı** — `<html>`'deki `--font-handwritten` (kullanıcının el yazısı fontu) siliniyordu, deploy etmeden yakalandı. |
| 58 | **YouTube Arşivi rozeti font-mono** | `SuperrSidebar.tsx:825` `t("sidebar.item.video_short")` ("video") rozeti `font-mono` kalmıştı → `font-handwritten text-[11px]`. Diğer tüm rozetlerle font birliği. ⚠️ İlk denemede **yanlış satır** (770 = dil masaları rozeti) hedeflendi, geri alındı. |
| 59 | **Günlük PIN — hata mesajı yok** | `handleUnlock`'ta `alert(t("journal.wrong_pin"))` vardı (bloklayıcı, kaybolmuyor). → `pinError` state + `role="alert" aria-live="assertive"` görünür mesaj. Yeni giriş yapılınca temizleniyor. |
| 60 | **Günlük PIN — input temizlenmiyor, 6 hane** | Yanlış girişte `setEnteredPin("")` **çağrılmıyordu** → rakamlar üstüne ekleniyordu. `maxLength={6}` (**4 olmalı**) iki yerde. **Düzeltme:** her denemede `setEnteredPin("")` + `maxLength={4}` + `onChange`'de `replace(/\D/g,"").slice(0,4)` (sadece rakam). |
| 61 | **Günlük PIN — kurduktan sonra kilit açılmıyor** | `handleSavePin`'de `setIsUnlocked(false)` **çağrılmıyordu** → `isUnlocked` `true` kalıyordu, kilit ekranı açılmıyordu (tık sessiz). → PIN kurulunca `setIsUnlocked(false)`, kilit kaldırılınca `setIsUnlocked(true)`. **Canlı doğrulama:** sayfa yenilemeden sekme değiştir → kilit ekranı **anında** açıldı. |
| 62 | **Etiket "#test" → "#te #t" bozuluyor** | **Kök neden:** `NotesView.tsx:117` regex'i `/[,\\s]+/` idi — çift ters bölü yüzünden karakter sınıfı **`,` `\` `s`** oluyordu, **`\s` (boşluk) DEĞİL**. Yani **`s` harfi** ayırıcıydı: `"#test"` → `s`'ten bölünüp `["#te","t"]`. Ayrıca boşluk hiç ayırıcı sayılmıyordu (`"#ihale #proje"` tek parça kalıyordu). **Düzeltme:** `/[,\s]+/` + çoklu `#` temizliği + boş/tekrarlı filtre. **Canlı doğrulama:** `#test` → tek etiket; `#ihale #proje` → ayrı ayrı. |

### Ek olarak (daha önce tamamlanmıştı)
- **Lovable Inspector** (Alt+I öğe seçici): 36 etiket noktası, 7 dilde çalışır, dosya adını gösterir.
- **Sesle yazma**: çalışıyor + noktalama motoru **7 dilde**, canlı yazma (interim→textarea), 250ms kaydetme.

---

## 4-F. KALEM/STYLUS DESTEĞİ (canlıda)

| # | İş | Detay |
|---|---|---|
| 63 | **Kalem yazma modu** | `PenCanvas.tsx` + `usePenCanvas.ts` + `lib/penTypes.ts` (**YENİ 3 dosya**). Pointer Events: `pointerType === "pen"` kalem, `"touch"` avuç (reddedilir), `"mouse"` de çalışır (test için). Basınç (`event.pressure`) → çizgi kalınlığı; desteklemeyende 0.5 sabit. Quadratik eğri ile yumuşak çizgi. |
| 64 | **AVUÇ REDDİ (palm rejection)** | Kalem son **700ms** içinde görüldüyse `touch` event'i **yok sayılır**. Ölçüm: touch fark = **0 piksel**. |
| 65 | **VEKTÖR veri (resim DEĞİL)** | `PenPoint = {x,y,p,t}` — **normalize 0..1** koordinat + basınç + zaman. `JournalEntry.pen?: PenLayer` (opsiyonel, eski kayıtlar bozulmaz). Ölçülen: 31 nokta = **2557 byte** (PNG olsaydı ~50-200 KB → **%98 küçük**). |
| 66 | **Mod toggle** | "klavye ile yaz" / "kalemle yaz" — mevcut textarea **korundu**, koşullu render. Geri al / temizle butonları. |
| 67 | **Görüntüleme** | Akış kartında **vektörden yeniden çizilir** (`readOnly` PenCanvas). Normalize sayesinde farklı boyutta **aynı görünür**. |
| 68 | **PDF** | `penLayerToSvg()` — vektörden **inline SVG** (PDF'te vektör kalır). |

---

## 4-G. SUPABASE / HESAP SİSTEMİ (Aşama 1-5 tamamlandı)

> **KRİTİK:** Proje artık **gerçek bulut hesabı + veritabanı** kullanıyor. Ama **localStorage modu da çalışıyor** (hesap zorunlu değil).

### Aşama 1 — Supabase kurulumu ✅
| | |
|---|---|
| Proje | `ignjomiurhennvfofkyd` → `https://ignjomiurhennvfofkyd.supabase.co` |
| Env | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (`.env` + Vercel Production) |
| Anahtar | **`anon`** (JWT `role: "anon"`). `service_role` kodu tarafından **reddedilir** (`looksLikeSecretKey`). |
| `.gitignore` | `.env` korumalı ✅ |

### Aşama 2 — Kimlik doğrulama ✅
- `lib/supabase.ts`'e **+5 fonksiyon**: `requestPasswordReset`, `getCurrentSessionUser`, `onAuthStateChange`, `updatePassword`, `isPasswordRecoveryLink`
- **Oturum kalıcılığı**: `App.tsx` açılışta `getSession` + `onAuthStateChange` → **F5'e dayanıklı**
- **Şifre sıfırlama**: `AuthModal` "şifremi unuttum" → sıfırlama modu (isim+şifre gizlenir)
- **Yerel profil KALDI** — "misafir devam et" + teşvik mesajı
- Canlı test: kayıt ✅ çıkış ✅ tekrar giriş ✅ şifre sıfırlama ✅ (`200 /auth/v1/recover`)

### Aşama 3 — Veritabanı şeması ✅
```sql
public.user_sync_store (user_id uuid PK → auth.users, data jsonb, updated_at timestamptz)
```
**Tek satır/kullanıcı + JSONB** modeli (uygulamanın `syncEngine.ts`'i 27 localStorage anahtarını **tek paket** olarak okuyor). SQL: `lexi-cards/supabase/schema.sql` (kullanıcı çalıştırdı). **404'ler gitti.**

### Aşama 4 — RLS izolasyonu ✅ (DB seviyesinde)
| Politika | Kural |
|---|---|
| select | `(select auth.uid()) = user_id` |
| insert | `with check (auth.uid() = user_id)` |
| update | `using + with check` (user_id değiştirilemez) |
| delete | `using (auth.uid() = user_id)` |

**Canlı kanıt:** A, sahte uid (`000...`) adına yazmayı denedi → **`403` + `42501` "violates row-level security policy"**. B, A'nın verisini **görmedi**. **`anon` anahtarıyla sorgu → `[]`** (hiçbir satır görünmez).

### Aşama 5 — Migration ✅
- **`performCloudSync` ZATEN iki yönlü** (bulut↔yerel, birleştirmeli — veri kaybı önleyici)
- **`MigrationReport`** + `window` event `yourbook:migrated` → **`App.tsx`** dinler (yarış sorunu çözümü)
- Onay mesajı: **"verilerin bulutuna taşındı! N bölüm, ~X KB"** (hem form hem **profil** görünümünde)
- Modal onay varken **açık kalır** (`if (!migrationNotice) onClose()`)
- Canlı kanıt: **6/6 kart** + günlük + kalem çizimi + XP korundu; **4-6 anahtar** taşındı; `<3s`'de onay mesajı

### ⏳ Aşama 6 (YAPILMADI — planlı tur gerekir)
Okuma/yazmayı **tamamen** buluta geçirme. Şu an **localStorage + bulut senkron paralel**. Aşama 6, tüm veri hook'larını (`useDeck`, `useEngagement`, …) değiştirmeyi gerektirir → **yüksek regresyon riski**. Ayrı ve planlı bir tur olmalı.

---

## 4-H. MOBİL + TABLET DÜZELTMELERİ (canlıda)

> **Kapsam:** Yalnızca **mobil (md altı)** ve **tablet** düzenleri. Masaüstüne **dokunulmadı**.
> Görsel kanıt: 390px telefon · 834px tablet · 1280px masaüstü — üçü de doğrulandı.

| # | Sorun | Kök neden + çözüm |
|---|---|---|
| 69 | **Tema dairesi görünmüyordu** | `MobileHeader.tsx`: `{theme.icon}` **boş** geliyordu (ölçüm: `svg=false`) → krem header üstünde boş daire. **Çözüm:** `theme.icon` yerine **`theme.accent` rengini gösteren `<span>`**: `className="block h-3.5 w-3.5 rounded-full border border-[color-mix(in_srgb,var(--ink)_45%,transparent)]" style={{ background: theme.accent }}`. Artık **her temada görünür**. |
| 70 | **DE/EN butonları global header'da** | Bunlar **genel arayüz dili değil**, `onSwitchSpace` çağıran **hızlı dil-masası değiştirici**. Ana ekranda gereksiz yer kaplıyordu. **Çözüm:** yeni **`showDeskSwitcher`** prop + `App.tsx`'te `showDeskSwitcher={currentView === "cards"}` → **yalnız kelime masası ekranında** görünür. |
| 71 | **Alt menü etiket taşması** | Ölçüm: `“giriş & defter kapağı”` = **123px** buton (diğerleri 56-71px), `white-space: normal` → dar ekranda **2 satıra kırılıyor** → çubuk dengesiz. **Çözüm:** (a) butonlar **`h-[52px] w-[19%] max-w-[74px]`** → **hepsi eşit**, (b) etiket **`whitespace-nowrap` + `truncate` + `text-[9px]`** → **asla 2 satır olmaz**, (c) yeni çeviri **`sidebar.item.cover_short`** = `"kapak"` (**10 dilde**). |
| 72 | **Arşivde kelime/not karışık** | Sekme (`cards`/`notes`) **zaten vardı** ama mobilde **fark edilmiyordu** (`text-xs`, `flex` taşması, belirsiz aktif durum). **Çözüm:** sekmeler mobilde **`flex-1` + tam genişlik + `whitespace-nowrap`**, aktif sekme **kalın + siyah dolgu**; ayrıca izgaradan önce **mobil bölüm başlığı**: `── dil kartları (N) ──` / `── notlar (N) ──` (el yazısı, turuncu). |
| 73 | **Tablet sıkışması (768-834px)** | **KÖK NEDEN:** `md` breakpoint (**768px**) masaüstü düzenini açıyordu → kenar çubuğu **280px (%34-36)**, içerik **488-554px'e sıkışıyordu**. **Çözüm:** masaüstü geçişi **`md` (768) → `lg` (1024)** taşındı. Artık **0-1023px mobil düzen** (dokunmatik için doğru), **1024px+ masaüstü** (%22-27 dengeli). |
| 74 | **Tablet'te arşiv sekmeleri eşit değil** | `sm:flex-none` (**640px**) devreye girip `flex-1` eşitliğini bozuyordu → 768px'te `133px vs 110px`. **Çözüm:** `sm:` → **`lg:`** (masaüstüne kadar eşit kalsın). |

### Tablet ince ayarı — değiştirilen breakpoint'ler

| Dosya | Önce | Sonra |
|---|---|---|
| `App.tsx` | `md:flex-row` · `hidden md:flex` · `md:hidden fixed` · `pb-16 md:pb-0` | **`lg:flex-row`** · **`hidden lg:flex`** · **`lg:hidden fixed`** · **`pb-16 lg:pb-0`** |
| `MobileHeader.tsx` | `md:hidden` | **`lg:hidden`** |
| `MobileBottomNav.tsx` | `md:hidden` | **`lg:hidden`** |
| `CollectionsView.tsx` | `sm:flex-none` · `sm:text-xs` · `sm:w-auto` | **`lg:flex-none`** · **`lg:text-xs`** · **`lg:w-auto`** |

> **NOT:** `pb-16 lg:pb-0` kritik — alt menü **1023px'e kadar** var; `md:pb-0` olsaydı **768-1023px arası içerik alt menünün altında kalırdı**.
> `md:grid-cols-2` gibi **içerik ızgarası** breakpoint'leri **bilinçli olarak korundu** (tablette 2 kolon iyi).

### Doğrulama (7 genişlik × 3 cihaz görünümü)

| Genişlik | Düzen | Yatay taşma | Alt menü | Arşiv sekmeleri |
|---|---|---|---|---|
| 375px | Mobil | ✅ yok | 52px eşit | 168=168 ✅ |
| 390px | Mobil | ✅ yok | 52px eşit | 175=175 ✅ |
| **768px** | **Mobil** | ✅ yok | 52px eşit | 196=196 ✅ |
| **834px** | **Mobil** | ✅ yok | 52px eşit | 224=224 ✅ |
| 1024px | Masaüstü | ✅ yok | — | — |
| 1194px | Masaüstü | ✅ yok | — | — |
| 1280px | Masaüstü | ✅ yok | — | — |

**Görsel kanıt (canlı):** telefon 390px (ana + arşiv + drawer), tablet 834px (ana + arşiv + drawer), masaüstü 1280px (ana) — üçünde de **tasarım bozulmamış**.

---

## 5. KRİTİK TUZAKLAR (geçmişte zaman kaybettiren)

1. **`getBoundingClientRect` yalan söyler.** Transform/overflow/clip durumlarında
   `elementFromPoint` ile doğrula (bkz. bölüm 3).
2. **`aside` `overflow:hidden`** — içine konan taşan buton KIRPILIR ve tıklanamaz.
   Panel dışı butonlar `App.tsx`'te, `position:fixed` olmalı.
3. **Margin-collapse.** `mt` boşlukları üst sarmalayıcı `pb-0` ise etkisiz olur.
   Boşluk gerekiyorsa **`padding`** kullan.
4. **Inline `style` Tailwind'i ezer.** Font boyutu değiştirken satırda
   mevcut `style={{fontSize}}` var mı diye bak.
5. **`.scrollbar-thin` global** — 14 yerde kullanılıyor. Sadece bir yeri
   değiştirmek için YENİ sınıf yaz (`.scrollbar-none`), globali bozma.
6. **`saas-project-2-2`'deki `.mjs` scriptleri** `lexi-cards` tarafından referans
   VERİLMEZ — güvenle silinebilir (`PROGRESS.md` ve `audit-real-results.json` hariç).
7. **PowerShell tırnak/parantez sorunu.** Çok satırlı JS'i terminale yazmak
   güvenilmez — **`.mjs` dosyasına yazıp `node` ile çalıştır**.
8. **`Add-Content`/`Set-Content` kod düzenlemesi için kullanılmaz** — satır
   bazlı değişiklikte `[System.IO.File]::ReadAllLines` / `WriteAllLines` kullan.
9. **`fs.writeFileSync(p, "utf8")` TUZAĞI (kod dosyasını SİLER).** Argüman
   sırası yanlış olursa `writeFileSync(path, "utf8")` dosyanın içine sadece
   `utf8` yazar ve tüm kaynağı yok eder. HER düzenleme scriptinde:
   `fs.writeFileSync(PATH, ICERIK, "utf8")` — üç argüman, içerik ikinci sırada.
   Bu hata bir kez `SuperrHero.tsx`'i 4 byte'a düşürdü.
10. **Düzenlemeden sonra doğrula.** Script çalıştıktan sonra dosya boyutunu
   ve `tsc --noEmit` sonucunu MUTLAKA kontrol et. `console.log("ok")` yetmez.
11. **Dosya boyutu düşerse PANİK YAPMA — önce satır sonunu kontrol et.**
   `Copy-Item` yedek CRLF + BOM'lu olur; `fs.writeFileSync` LF + BOM'suz yazar.
   Bu yüzden boyut düşer ama içerik sağlamdır. Doğrulama: `[System.IO.File]::ReadAllText()`
   ile `\r\n` sayısını yedekle karşılaştır (eşitse sorun yok).
12. **`vite preview` / `vite dev` arka planda başlatılamıyor.**
   `run_in_background` bile 120s'de öldürülür ("Command exceeded 120s").
   Çalışan yöntem: `Start-Process -FilePath "C:\Program Files\nodejs\node.exe"
   -ArgumentList "node_modules\vite\bin\vite.js","preview","--port","X"
   -WorkingDirectory "C:\Users\yalci\CodeGPT\lexi-cards" -WindowStyle Hidden`
   sonra `Start-Sleep 7` + `Invoke-WebRequest` ile "200" doğrula.
13. **`playwright` sadece `lexi-cards\node_modules`'da var.**
   QA scriptini `saas-project-2-2`'den çalıştırırsan `ERR_MODULE_NOT_FOUND` alırsın;
   scripti `lexi-cards` köküne kopyalayıp oradan `node` ile çalıştır, iş bitince sil.

---

## 6. YAPILACAKLAR / AÇIK KONULAR
### ✅ Son turda tamamlanan (canlıya deploy edildi)
1. **Gülen yüz ↔ ok boşluğu = 2px (gerçek çizgiden).**
   - Ok konumu `smiley.bottom + 2` (ölçülen gerçek kutu kenarından).
   - Ok boyutu `131×100` sabit, `arrowSize` state'e yazılıyor.
   - Yatay: okun merkezi vurgulu kelimenin ortasına hizalı (`anchor.width/2 - 65.5`).
2. **Dil/font değişiminde yeniden ölçüm (İspanyolca/Fransızca dahil).**
   - `notebook-config-changed` + `yourbook-ui-language-changed` dinleniyor.
   - Yeniden ölçüm: iki `requestAnimationFrame` + ek `120ms`.
   - `ResizeObserver` artık: `wrapRef, h1Ref, wordRef, greetingRef, smileyRef, hero-intro`.
   - `MutationObserver` metin değişimini yakalıyor.
3. **Hero içerik boşlukları.**
   - Karşılama satırı: `-mt-[50px]`
   - Başlık: `-mt-[22px] sm:mt-[-9px] lg:mt-[-22px]`
   - Intro paragrafı: `text-[32px] sm:text-[35px]`
   - Türkçe intro: `yeni diller öğrenmek gerçekten muhteşem.`

### ⚠️ KRİTİK OLAY — dosya silinmesi ve geri kurtarma
`fs.writeFileSync(p, "utf8")` (eksik içerik argümanı) nedeniyle
`src/components/SuperrHero.tsx` 4 byte'a düştü (`utf8` yazdı).
**Kurtarma yöntemi (işe yaradı):** son başarılı production build çıktısı
`dist/assets/index-*.js` içinden bileşen minified hali çıkarıldı
(`function tC({...})`), gerçek API imzaları (`useT`, `EngagementApi`,
`NotebookCustomizeModal`, `SuperrStickers`, `doodle-icons`) projeden okunarak
temiz TSX olarak yeniden yazıldı. Sonuç: `tsc 0 hata`, `npm test 259/259`,
`npm run build` başarılı, canlı görsel doğrulama tamam.
**DERS:** Düzenleme scriptlerinde daima `fs.writeFileSync(PATH, ICERIK, "utf8")`
(3 argüman) kullan; yazdıktan sonra dosya boyutu + `tsc --noEmit` ile doğrula.

### ❌ KAPSAM DIŞI — KULLANICI İSTEMEDİ (bir daha önerilmeyecek)

> **ÇOK ÖNEMLİ:** Kullanıcı bu iki konun **yapılmasını istemiyor**.
> Yeni chatte bu maddeleri "yapılacaklar" gibi okuma, **öneri olarak bile sunma**.

1. **Hero'daki defter kartı sticker'ları (⚡/🌱) taşma kontrolü.**
   Ölçümler `sticksOutAbove: false` diyor, taşma yok. Konu **kapatıldı**.
2. **`pt`/`ru`/`nl` dillerini `UI_LANGUAGES`'e ekleme.**
   Çeviriler `DICTS`'te duruyor ama **eklenmesi istenmiyor**. Konu **kapatıldı**.

### ✅ TAMAMLANDI
3. **`saas-project-2-2` temizliği — TAMAMLANDI.**
   365 → **14 dosya**, **351 geçici dosya silindi**, 25.84 MB → **0.19 MB**.
   - **Silinenler:** 223 `.mjs` QA scripti, 76 `.png` ekran görüntüsü, 12 `.log`,
     9 `.txt` (bundle/html dump'ları), 6 `.js` bundle çıkarımı, 3 ham `.bak` bundle,
     `SuperrHero.tsx.BROKEN` (4 byte), `*.REJECTED-*.tsx`, `*.MY-BROKEN-*.bak`,
     `hero-component-min.txt`, ve 6 geçici klasör (`old-deploy`, `target-deploy`,
     `vercel-src-pull`, `-c`, `.exe`, `git --version`).
   - **Korunanlar:** `progress1.md`, `PROGRESS.md`, `audit-real-results.json`,
     `progress1.BEFORE-session2.bak.md`, ve **canlıya deploy edilmiş çalışır
     sürümlerin yedekleri** (`SuperrHero.BEFORE-headline-fix.bak.tsx`,
     `StudyDesk.BEFORE-*.bak.tsx` ×4, `OpeningRitualCard.BEFORE-icon-size.bak.tsx`,
     `deck.BEFORE-*.bak.ts`, `deck.test.BEFORE-seed.bak.ts`).
   - **Kanıt:** `lexi-cards` içinden `saas-project-2-2`'ye **hiçbir referans yok**
     (grep ile doğrulandı, 0 sonuç) — dosyalar güvenle silindi.
   - **Not:** Yeni QA scriptleri gerekirse `_scratch/` altında tutulmalı ve iş
     bitince silinmeli; ana klasör temiz kalsın.

### Açık konu (bilgi)
4. **UI_LANGUAGES / DICTS yapısı** — `src/i18n/index.ts`, `LANG_LOCALE` (7 dil):
   tr-TR, en-GB, de-DE, es-ES, fr-FR, it-IT, ar-SA.

---

## 7. ÖNEMLİ DOSYALAR

| Dosya | Ne |
|---|---|
| `src/components/SuperrHero.tsx` | Ana ekran (hero). Defter kartı, emoji, ok, sticker'lar. |
| `src/components/SuperrSidebar.tsx` | Sol dikey panel. Menü, temalar, XP kartı. |
| `src/App.tsx` | Sidebar + hero sarmalayıcı, gizle/göster butonları. |
| `src/lib/useSidebarVisibility.ts` | Sidebar gizli/genişlik paylaşılan hook. |
| `src/lib/dictationPunctuation.ts` | Sesli yazma noktalama motoru (7 dil). |
| `src/lib/useSpeechDictation.ts` | Sesle yazma hook'u. |
| `src/components/LovableInspector.tsx` | Alt+I öğe seçici. |
| `src/lib/themes.ts` | Tema listesi (9 tema, gece mürekkebi çıkarıldı). |
| `src/components/QuizMode.tsx` | Sınav ekranı + sonuç ("Yanlışları Gözden Geçir"). |
| `src/lib/quiz.ts` | Soru ÜRETİCİ. **3 tip:** `wordToTrans` · `transToWord` · `article`. |
| `src/components/QuizMode.tsx` | Sınav ekranı. Soru: `t(promptSubKey)` + `· targetWord`. `grammar` kaldırıldı. |
| `src/lib/deck.ts` | `useDeck`, `sanitizeCards`, SRS (`reviewAt`). Depolama: `yourbook_deck_v7_clean`. |
| `src/components/XpToast.tsx` | **Tek kutlama kaynağı** (sağ üst `top-20 end-6`). |
| `src/components/WordStatusPanel.tsx` | "kelime durumu" paneli + mini oyun daveti. |
| `src/components/CalendarAgendaView.tsx` | Takvim + ajanda. Tarih: **`toDateKey` (yerel)**, `toISOString` DEĞİL. |
| `src/components/JournalView.tsx` | "sevgili günlük" + **PIN kilidi** (`handleUnlock`, `handleSavePin`, `pinError`). Etiket yok. |
| `src/components/NotesView.tsx` | Klasörlenmiş notlar. Etiket ayrıştırma: **`/[,\s]+/`** (tek ters bölü — bozma!). |
| `src/components/OpeningRitualCard.tsx` | Hero ritüel kartı. Gölge: **`shadow-superrCard`**. |
| `src/components/StudyDesk.tsx` | Kelime masası. `<StickyCard **key={currentCard.id}** />` — key'i KALDIRMA! |
| `src/components/StickyCard.tsx` | Kelime kartı. `isLearnedAnimating` sıfırlama güvenlik ağı var. |
| `src/lib/languages.ts` | **`LANGUAGES`** — dil masası sayısının TEK kaynağı. "6" sabiti YAZMA. |
| `src/lib/penTypes.ts` | 🆕 **Kalem vektör veri modeli** (`PenPoint`, `PenStroke`, `PenLayer`, `sanitizePenLayer`). |
| `src/lib/usePenCanvas.ts` | 🆕 **Kalem hook'u** — Pointer Events, basınç, **avuç reddi (700ms)**, yumuşak çizgi. |
| `src/components/PenCanvas.tsx` | 🆕 **Kalem canvas'ı** (yazma + `readOnly` görüntüleme). |
| `src/lib/supabase.ts` | Bulut client + auth (`loginUser`, `registerUser`, `logoutUser`, `requestPasswordReset`, `getCurrentSessionUser`, `onAuthStateChange`). |
| `src/lib/syncEngine.ts` | İki yönlü senkron + **`MigrationReport`** + `yourbook:migrated` event. **`SYNC_KEYS` (27 anahtar)**. |
| `src/components/AuthModal.tsx` | Giriş/kayıt/çıkış + **şifre sıfırlama** + **migration onayı** (form + profil dalı). |
| `supabase/schema.sql` | **DB şeması**: `user_sync_store` + RLS 4 politika + trigger. (Supabase SQL Editor'de çalıştırıldı.) |
| `src/components/MobileHeader.tsx` | **Mobil üst bar.** Tema dairesi = **`theme.accent` rengi** (ikon değil). `showDeskSwitcher` prop'u. `lg:hidden`. |
| `src/components/MobileBottomNav.tsx` | **Alt menü.** Butonlar **52px eşit** (%19). Etiket: `whitespace-nowrap` + `truncate` + 9px. `cover_short`. |
| `src/components/CollectionsView.tsx` | **Arşiv.** Mobil **bölüm başlığı** (`── dil kartları (N) ──`). Sekmeler `lg:flex-none`. |
| `src/App.tsx` (düzen) | **Breakpoint: `lg` (1024px)**. `lg:flex-row` / `hidden lg:flex` / `lg:hidden fixed` / `pb-16 lg:pb-0`. **`md:` DOKUNMA** (izgara). |
| `src/index.css` | Tema değişkenleri, `.scrollbar-thin` / `.scrollbar-none`. |

---

## 8. HIZLI DEVAM KOMUTU

```powershell
# 1. Durumu doğrula
cd 'C:\Users\yalci\CodeGPT\lexi-cards'
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npx tsc --noEmit; npm test

# 2. Dev sunucusu (canlı önizleme için)
npx vite --port 5244 --strictPort

# 3. Canlı doğrulama örneği
node "C:\Users\yalci\.codegpt\skills\browser-automation\browser.mjs" \
  "https://yourbook-app.vercel.app/" --script "<script>.mjs" --screenshot "out.png"
```

---

## 9. KULLANICI TALİMAT TARZI (dikkat)

- Kullanıcı **Türkçe** konuşur, kısa ve net istekler verir.
- **"bir şey yaparken başka bir şeyi bozma"** — değişiklik öncesi/sonrası
  **ölçüm al** ve ilgisiz öğeleri etkilemediğini doğrula.
- Görsel sonuç sayısal ölçümden önemli: **ekran görüntüsü al ve bak.**
- Kullanıcı "deploy et" dediğinde hemen deploy et, sorma.
- Kullanıcı istemeden **ekstra özellik ekleme** (kendisi söylemeden etiket,
  tema, dil ekleme gibi işler YAPILMAZ).
- **KAPATILMIŞ KONULAR — bir daha önerme:** (a) defter kartı sticker taşma
  kontrolü, (b) `pt`/`ru`/`nl` dillerini `UI_LANGUAGES`'e ekleme. Kullanıcı bu
  ikisini **defalarca reddetti**. Bunları "bekleyen iş" olarak sunma.
- **Kapsam dışına çıkma.** Kullanıcı "sadece X'i yap" dediğinde, YALNIZCA X
  yapılır; komşu maddeleri "iyilik olsun" diye ele alma.

---

## 10. YENİ CHATTE NASIL DEVAM EDİLİR (adım adım)

### İlk mesajın (kopyala-yapıştır)
```
C:\Users\yalci\CodeGPT\saas-project-2-2\progress1.md dosyasını oku ve
kaldığımız yerden devam et.
```

Yeni chat'te ilk iş: **`progress1.md`'yi oku.** Bu dosya tüm kararları,
kesin değerleri ve tuzakları içerir. Başka hiçbir şeye ihtiyaç yok.

### Sonra doğrula (2 komut)
```powershell
cd 'C:\Users\yalci\CodeGPT\lexi-cards'
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npx tsc --noEmit; npm test        # 0 hata + 259/259 olmalı
```

### Sonra canlıya bak
```powershell
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
node "C:\Users\yalci\.codegpt\skills\browser-automation\browser.mjs" \
  "https://yourbook-app.vercel.app/" --screenshot "C:\Users\yalci\CodeGPT\saas-project-2-2\check.png"
```
Ekran görüntüsünü **gerçekten incele** (bkz. bölüm 4-B ders 3).

### Altın kurallar (her değişiklikte)
1. **Yedek al:** `Copy-Item <dosya> <saas-project-2-2>\<Ad>.BEFORE-<ne>.bak.tsx`
2. **Ölç:** değişiklikten ÖNCE değeri kaydet
3. **Uygula:** tek amaçlı `.mjs` scripti ile (`fs.writeFileSync(PATH, ICERIK, "utf8")` — 3 argüman!)
4. **Doğrula:** `npx tsc --noEmit` + `npm test` + ekran görüntüsü
5. **Deploy:** `$env:CI='1'; npx vercel --prod --yes`
6. **Alias:** 3 alias'ı yeni deployment URL'ine bağla
7. **Beğenilmezse:** yedekten geri al

### Açık kalan tek konu
Bölüm 6'daki `⏳` ve `⚠️` başlıklı maddeler. Bunlar dışında her şey canlıda ve tamam.
