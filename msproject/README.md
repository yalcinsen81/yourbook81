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
- Gantt'ta sürükle-bırak: çubuğu taşımak başlangıç kısıtı koyar, sağ ucundan çekmek süreyi değiştirir
- Proje takvimi kullanıcı tarafından kurulur (MS Project gibi): "Yeni proje" penceresinde çalışma günleri (ör. Pzt–Cmt),
  resmî tatiller, dini bayramlar (hazır veri 2026–2027; diğer yıllar elle girilir) ve arifelerin yarım gün işareti seçilir;
  hepsi Takvim penceresinden değiştirilebilir. Yarım gün iş günü sayılır, yalnızca Gantt ve takvimde işaretlenir.
- MS Project XML aç/kaydet: MS Project'te "Farklı Kaydet > XML Biçimi" ile kaydedilen dosya açılır; "MS Project'e" düğmesi MS Project'te açılan .xml indirir (.mpp doğrudan okunamaz)
- Kaynaklar: kişi, ekip ya da makine; kapasite (%300 = üç kişilik ekip) ve günlük ücret. Görev tablosundaki Kaynaklar
  sütununa `Ali[50%]; Vinç` yazılır; yeni ad kaynak listesine eklenir. Aşırı yüklenen kaynak kırmızı ünlemle işaretlenir.
- Kaynaklar sayfası: iş (adam-gün), maliyet, en yüksek yük ve seçili kaynağın günlük yük histogramı
- Grafikler sayfası: S eğrisi (planlanan / gerçekleşen), maliyet eğrisi ve kazanılan değer, haftalık kaynak yük haritası,
  kaynak başına maliyet ve iş. İlerleme ağırlığı seçilir: maliyet (varsayılan), iş (adam-gün) ya da süre; planlanan %,
  gerçekleşen % ve sapma aynı ağırlıkla hesaplanır. Maliyeti olmayan görevler bilgi notuyla gösterilir.
- Kaynaklar ve atamalar MS Project XML'ine yazılır ve oradan okunur
- Riskler sayfası (dosya sürümü 6): risk sicili (olasılık × etki, 5×5 matris, yanıt, durum, sorumlu), riskleri görevlere ek gün ve
  maliyetle bağlama, görev başına üç nokta süre tahmini; Monte Carlo benzetimi (üçgen ya da PERT, tohumlu, Web Worker'da; P50/P80/P95
  bitiş ve maliyet, plan tarihinde bitme olasılığı, kritiklik indeksi, bitişi en çok etkileyen görevler, risklerin etkisi) ve DCMA tarzı
  plan kalite denetimi. Risk sicili, benzetim özeti ve plan kalitesi Raporlar'dan CSV/Excel/PDF olarak alınır.
- Geri al / yinele, JSON aç/kaydet, örnek inşaat projesi
- MS Project tarzı esneklik (dosya sürümü 7): komut paleti (Ctrl+K) ve göreve git (Ctrl+G); seçim sırasıyla bağla (Ctrl+F2) ve
  bağları kaldır (Ctrl+Shift+F2); özet altına al / özeti çöz; daralt-genişlet ve 1./2./3. düzeye kadar göster; sağ tık menüsü;
  satırı tutamaçtan sürükleyip bırakma (yatay hareket girintiyi değiştirir); Gantt'ta çubuğu taşıma (SNET kısıtı), uzatma, yüzde
  sürükleme, uçtan uca bağ çizme, bağ okuna tıklayıp tür/gecikme düzenleme; doldurma tutamacı ve Ctrl+D; toplu düzenleme; Excel'den
  çok satırlı yapıştırma; hazır süzgeçler, başlıktan sıralama, kaynağa/özete göre gruplama; not önizlemesi; Gantt üstünde zaman
  çizelgesi şeridi (PNG/yazdırmaya da girer); taban çizgisini göster/gizle; görevi böl (göreve özel çalışılamayan dönem) ve
  etkisizleştir (hesaba girmez); yinelenen görev (haftalık/aylık); Kaynaklar'da günlük/haftalık yük ısı haritası
- Kısayollar: Insert (görev ekle), Delete (sil), Alt+Shift+→/← (girinti), Ctrl+F2 (bağla), Ctrl+Z / Ctrl+Y, Alt+T (bugün); tam liste F1

Takvim: varsayılan Pazartesi–Cuma iş günü, projeye tanımlı tam gün tatiller hariç. Dosya biçimi sürümlüdür (`version`);
eski `proje.json` dosyaları açılırken otomatik yükseltilir (Pzt–Cum, maliyet ağırlığı, tatil listesi aynen).

## Bilgisayara kurulum (uygulama olarak)

Proje Planlayıcı kurulabilir bir web uygulamasıdır (PWA): bir kez kurulunca kendi penceresinde, internetsiz ve
sunucu çalıştırmadan açılır.

1. [nodejs.org](https://nodejs.org) adresinden Node.js'in **LTS** sürümünü kurun (bir kez; Claude bağlantısı için de gerekir).
2. Kodu indirip bir klasöre açın (ör. `C:\Projeler`).
3. `msproject` klasöründeki **Baslat.bat** dosyasına çift tıklayın (macOS'ta `baslat.command`). İlk açılışta paketler
   yüklenir, uygulama derlenir ve Chrome/Edge'de `http://localhost:5173` adresinde açılır.
4. Üstteki **Uygulamayı yükle** düğmesine (ya da adres çubuğundaki yükle simgesine) tıklayın. Uygulama Başlat menüsüne ve
   masaüstüne eklenir. Artık siyah pencereyi kapatabilirsiniz.
5. **Dosyaya bağla** ile projeyi bir `.json` dosyasına bağlayın ve Claude'u aynı dosyaya bağlayın (aşağıda). Uygulama bağlı
   dosyayı hatırlar: sonraki açılışlarda kendiliğinden ya da tek tıkla ("yeniden bağlan") aynı dosyaya döner.

Yeni bir sürüm indirdiğinizde Baslat.bat'ı bir kez çalıştırıp uygulamayı açmanız yeterlidir; güncelleme kendiliğinden alınır.
Veriler `localhost:5173` adresine bağlı saklanır; bu yüzden adres sabittir.

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
- `src/model/` saf mantık (testli): `calendar.ts` iş günü takvimi (`WorkCalendar`), `holidays.ts` + `holidayData.ts` Türkiye tatilleri (yıl bazlı veri, tr + en adlar), `schedule.ts` CPM motoru,
  `predecessors.ts` öncül metni, `outline.ts` girinti/WBS, `storage.ts` kayıt ve dosya doğrulama, `mspXml.ts` MS Project XML okuma/yazma,
  `resources.ts` kaynak atama, yük, maliyet ve S eğrisi, `ops.ts` MCP'nin kullandığı işlemler,
  `risks.ts` risk sicili, `simulation.ts` Monte Carlo benzetimi (`src/simWorker.ts` arka planda çalıştırır), `quality.ts` plan kalite denetimi
- `src/components/` `TaskGrid` (tablo), `Gantt` (SVG şema), `ResourceView` (kaynaklar), `ChartsView` + `charts.tsx` (bağımlılıksız SVG grafikler), `EditableCell`
- `src/i18n/` arayüz metinleri (`t("anahtar")`, `tr.ts` + `en.ts`); yeni metinler buradan eklenir
- `src/useProject.ts` durum + geri al geçmişi

## Claude'a bağlama (MCP)

`mcp/dist/msproject-mcp.mjs` tek dosyalık bir MCP sunucusudur. Claude bu sunucuyla diskteki proje dosyasını
okur ve düzenler: görev ekler, siler, girintiler, bağlar, tatil tanımlar, kaynak tanımlayıp atar, aşırı yükü ve S eğrisini
okur, MS Project XML'ine aktarır, riskleri yönetir ve Monte Carlo benzetimi çalıştırır.
Çalıştırmak için yalnızca Node 20 veya üzeri gerekir; `npm install` yapmanız gerekmez.

**En kolay yol (Claude Desktop eklentisi):** `mcp/dist/proje-planlayici.mcpb` dosyasına çift tıklayın (ya da Claude Desktop'ta
Ayarlar > Uzantılar'a sürükleyin) ve **Yükle** deyin. Node kurmanız gerekmez; Claude Desktop kendi Node'unu kullanır. Proje dosyası
varsayılan olarak `Belgeler/Proje Planlayici/proje.json` olur (kurulumda değiştirebilirsiniz) ve yoksa oluşturulur. Uygulamada
**Dosyaya bağla > Var olan dosyayı aç ve bağla** ile bu dosyayı seçin. Eklentiyi yeniden üretmek için `npm run build:mcpb`.

Elle yapılandırmak isterseniz:

**Claude Desktop:** Ayarlar > Geliştirici > Yapılandırmayı düzenle ile `claude_desktop_config.json` dosyasını açıp şunu ekleyin:

```json
{
  "mcpServers": {
    "proje-planlayici": {
      "command": "node",
      "args": ["C:/yol/yourbook81/msproject/mcp/dist/msproject-mcp.mjs", "C:/Projelerim/proje.json"]
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add proje-planlayici -- node /yol/msproject/mcp/dist/msproject-mcp.mjs /yol/proje.json
```

Değişiklikleri uygulamada canlı görmek için uygulamada **Dosyaya bağla** düğmesiyle aynı `proje.json` dosyasını seçin
(Chrome veya Edge gerekir). Claude dosyayı değiştirdiğinde ekran yaklaşık 1,5 saniye içinde güncellenir. Sizin
ekranda yaptığınız değişiklikler de dosyaya yazılır ve Claude bir sonraki işlemde bunları görür.

Kendi denemeniz için Claude'a örneğin şunu yazabilirsiniz: "Projeye 'Elektrik tesisatı' adında, 8. satırdan sonra başlayan 6 günlük bir görev ekle ve kritik yolu göster."

Sunucuyu değiştirdikten sonra yeniden paketlemek için `npm run build:mcp` çalıştırın. Uçtan uca deneme için `npm run mcp:smoke` kullanın.
