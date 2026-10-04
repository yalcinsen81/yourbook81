# Mikrofon Sorunu — Windows Ayarları (kod tarafı değil)

## Bulgu

Tarayıcıda "sesle yaz" çalışmıyor. Kök neden **uygulama kodu DEĞİL**, Windows'un
mikrofon gizlilik ayarı. Kanıtlar:

| Kontrol | Sonuç |
|---|---|
| Windows ses servisi (`Audiosrv`) | **Running** ✅ |
| Sistemde mikrofon cihazı | `Microphone Array on SoundWire Device (6- Cirrus Logic XU)` — **Status OK** ✅ |
| Genel mikrofon izni (`ConsentStore\microphone\Value`) | **Allow** ✅ |
| **`NonPackaged` anahtarı** (masaüstü uygulamaları için) | **YOK — hiç oluşmamış** ❌ |
| Chrome site izni (`yourbook-app.vercel.app`) | **izin verilmiş** (setting=1) ✅ |
| Tarayıcının gördüğü cihaz sayısı | **0** ❌ |

**Yorum:** Donanım var, servis çalışıyor, Chrome'a site izni verilmiş — ama tarayıcı
hiçbir ses cihazı göremiyor. Bunun tek açıklaması Windows'un **"Masaüstü uygulamalarının
mikrofonunuza erişmesine izin ver"** anahtarının KAPALI olmasıdır. Windows, bu ayar
kapalıyken `enumerateDevices()` çağrısına **boş liste** döner (hata vermez).

---

## Çözüm (Windows tarafında — 3 dakika)

### Adım 1 — Windows mikrofon erişimini aç

1. **Windows tuşu** → **"Mikrofon gizlilik ayarları"** yaz → aç
   (veya: Ayarlar → **Gizlilik ve güvenlik** → **Mikrofon**)
2. **"Mikrofon erişimi"** → **Açık** yap
3. **"Uygulamaların mikrofonunuza erişmesine izin ver"** → **Açık** yap
4. Sayfayı aşağı kaydır → **"Masaüstü uygulamalarının mikrofonunuza erişmesine izin ver"**
   → **AÇIK** yap  ← **Kritik olan bu.** Chrome bir masaüstü uygulamasıdır.

Bu anahtar açıldığında, yukarıda **YOK** olan `NonPackaged` kayıt defteri anahtarı oluşur.

### Adım 2 — Tarayıcıyı tamamen kapat ve yeniden aç

Mikrofon cihaz listesi **tarayıcı başlangıcında** okunur ve önbelleğe alınır.
Sekmeyi yenilemek yetmez:

- Chrome'da `chrome://settings/content/microphone` aç → **"Siteler izin isteyebilir"** seçili olsun
- Chrome'u **tamamen kapat** (tüm pencereler, arka planda çalışan Chrome dahil — sistem tepsisinden çık)
- Yeniden aç ve `https://yourbook-app.vercel.app/mikrofon-dene.html` adresine git

### Adım 3 — Test et

`mikrofon-dene.html` sayfasında:
1. Sayfa **kaç audioinput** görüyor? (0 ise 1. adım uygulanmamış)
2. "Mikrofonu Aç" → izin sor → **İzin Ver** → konuş
3. Ses seviyesi çubuğu hareket ediyorsa mikrofon çalışıyor

### Hâlâ çalışmıyorsa

- **`chrome://restart`** yazıp Enter (Chrome'u arka plan işlemleriyle yeniden başlatır)
- Windows'ta **`Microphone Array (Cirrus Logic)`** aygıtını **Devre Dışı** → **Etkinleştir**
  (Aygıt Yöneticisi → Ses, video ve oyun denetleyicileri)
- Bluetooth mikrofon değil, **dahili** mikrofona odaklan; Bluetooth cihazlar
  `Unknown` durumunda ve bağlı olmadıkları için listeye gürültü katıyor

---

## Uygulama tarafında yapılanlar (bunlar gerekliydi ama yeterli değildi)

Bu sorun ortaya çıkarken uygulamada bulunan ve düzeltilen **gerçek** hatalar:

1. **Hata mesajı hiç gösterilmiyordu.** `dictation.error` state'i tutuluyordu ama
   render edilmiyordu → izin reddi / mikrofon yok / ağ hatası durumlarında kullanıcı
   hiçbir geri bildirim görmüyordu. Artık her hata durumu için ayrı, çevrilmiş mesaj
   gösteriliyor (10 dil).
2. **Buton, destek yokken tamamen gizleniyordu.** Artık her zaman görünür; desteklenmezse
   devre dışı ve sebebi tooltip'te.
3. **Canlı yazma yoktu.** `onInterim` hiç bağlanmamıştı — konuşurken ara metin yazı
   alanına akmıyorudu. Artık akıyor (gerçek zamanlı yazma).
4. **Stale closure hatası.** `onFinal` içinde `currentText` eski değeri görüyordu →
   ikinci cümle birincinin üzerine yazıyordu. Temel metin artık `ref`'te.
5. **`fr`/`it`/`ru`/`nl` LANG_LOCALE'da eksikti** → o dillerde `en-GB`'ye düşüp
   yanlış dilde dinliyordu.
6. **İzin diyaloğu hiç açılmıyordu.** `SpeechRecognition`, izin yoksa hiç sormadan
   `not-allowed` dönüyor. Artık başlatmadan önce `getUserMedia` ile izin isteniyor
   (izin diyaloğunu açan güvenilir yol).

**Testler:** 18 dikte testi eklendi (toplam **225/225**) — hata eşlemesi, dil yerelleri,
interim→final→append akışı, sessizlikte yeniden başlatma, kullanıcı durdurunca durma.

---

## Not: bu uygulama hatası değil

Chrome `enumerateDevices()` çağrısına işletim sistemi ayarı nedeniyle boş liste
döndüğünde JavaScript bunu **algılayamaz** — hata da dönmez. Bu yüzden uygulama
"mikrofon yok" ile "izin yok" durumunu ayırt edemez. En iyi yaptığı şey:
`getUserMedia` ile izin istemek, `NotFoundError` gelirse kullanıcıya
**işletim sistemi ayarını** işaret eden mesajı göstermek. Bu da eklendi.
