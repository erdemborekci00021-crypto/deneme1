# Atölye — CNC üretim planlama

Tek CNC dik işleme makinesi için Türkçe, responsive üretim planlama MVP’si. React + Vite arayüzü, Express API ve kalıcı SQLite veritabanı. Node.js 24 kullanın (yerleşik `node:sqlite` gerekir).

## Bilgisayarınıza indirme

GitHub üzerinde **Code → Download ZIP** seçeneğini kullanın ve ZIP dosyasını çıkarın. Node.js 24 veya daha yeni bir sürümü kurun. Windows’ta `BASLAT-WINDOWS.cmd` dosyasını çalıştırın; macOS/Linux’ta klasör içinde `bash baslat.sh` komutunu çalıştırın. İlk açılışta bağımlılıklar indirilir ve arayüz derlenir. Sunucu hazır olduğunda tarayıcınızda `http://localhost:3000` adresini açın. Ayrıntılar `ONCE-OKUYUN.txt` dosyasında.

## Çalıştırma

```bash
cd deneme1
npm ci --cache /tmp/cnc-npm-cache
npm run build
npm test
npm run dev
```

Geliştirme sunucusu, arayüz ve API’yi aynı portta (3000) sunar; Vite ile canlı yenileme açıktır. Üretim için `npm run build` ardından `npm start`. Port `PORT`, veritabanı yolu `DB_PATH` ile değiştirilebilir. Sunucu tüm arayüzlere bağlanır. Harici servis veya API anahtarı gerekmez.

## MVP kapsamı

- Genel bakış: bugünkü işler, günlük/haftalık/aylık doluluk, yaklaşan terminler ve riskler.
- İş emirleri: oluşturma, düzenleme, silme, müşteri/öncelik/zaman/durum filtreleri, dört tür sıralama ve arama.
- İş detayı: adet, malzeme, teknik resim numarası, operasyon/takım notları, PDF/PNG/JPEG yükleme (10 MB), durum, gerçek süre ve değişiklik geçmişi.
- Takvim: günlük/haftalık saat çizelgesi ve aylık görünüm, saat/gün hücresine sürükle-bırak. Blok detayları fare üzerine geldiğinde ve tıklandığında gösterilir.
- Makine ayarları: haftanın her gününe vardiya, günlük molalar, tarih aralığıyla tatil/bakım/arıza/izin/duruş.
- Raporlar: haftalık kapasite grafiği, aylık doluluk, müşteri toplamları, termininde biten işler, ortalama gecikme, plan/gerçek karşılaştırması ve CSV.
- İlk açılışta istenen dört örnek iş yüklenir; örnekler yalnızca veritabanı ilk oluşturulduğunda eklenir.

## Planlama kuralları

Tüm tarihler atölyenin **Europe/Istanbul** saat dilimindeki duvar saatidir. Sunucunun saat dilimi sonucu değiştirmez. Ekranda GG.AA.YYYY ve 24 saat gösterilir.

1. Üretimdeki işler kayıtlı zamanlarını korur. Manuel başlangıç atanmış işler sonraki sıradadır. Diğer işler öncelik, termin tarihi/saati, toplam süre ve kimlik sırasıyla planlanır (eşit öncelikte EDD).
2. Toplam makine süresi = tüm adetler için girilen işleme + bağlama + takım hazırlık + kontrol. Molalar ve duruşlar çıkarılır; iş aralıkları çakışmaz.
3. Bölünebilir işler uygun aralıklara yayılır. Bölünemez işler için tek kesintisiz aralık aranır; böyle bir aralık yoksa planlanamaz olarak işaretlenir. Örneğin öğle molalı 9 saat kapasite, kesintisiz 9 saat kapasite değildir.
4. Geriye doğru modda iş, termin öncesindeki son uygun boş aralıklara yerleşir. Sığmıyorsa ileri planlama ile ilk uygun aralık bulunur ve termin riski gösterilir.
5. Manuel başlangıç **en erken başlama kısıtıdır**, kapalı saate zorla yerleştirme değildir. Sürüklenen bölünmüş işin tamamı yeniden planlanır; diğer aktif işler de tekrar hesaplanır. Manuel tarihi temizlemek işi otomatik sıraya döndürür.
6. Termin geçtiyse gecikmiş; bitiş termini aşıyorsa gecikme riski; termin öncesindeki kullanılabilir tampon ayarlanan eşiğin altındaysa riskli, aksi halde güvenli. Ek kapasite, işin termin sonrasına taşan iş dakikalarıdır; ticari termin garantisi veya optimal çözüm değildir.
7. Tamamlanan, iptal edilen ve beklemedeki işler yeni kapasite tüketmez. Tamamlanan işin son planlanan başlangıç/bitişi raporlama için korunur.
8. Arama ufku 366 gündür. Bu ufukta yer bulunamazsa neden açıkça gösterilir.

## Kalıcılık ve yedekleme

İşler, ayarlar, dosyalar ve geçmiş `data/workshop.sqlite` içinde saklanır; yeniden başlatmada korunur. `data/` Git’e eklenmez. Sunucuyu durdurup SQLite dosyasını güvenli bir konuma kopyalayın; çalışan sunucuda kopyalama için SQLite backup API kullanın (WAL dosyalarını göz ardı etmeyin). Tarayıcı depolaması veri kaynağı değildir.

## Doğrulama

`npm test`: 14 planlama testi ve gerçek sunucu üzerinde API entegrasyon testi. EDD, öncelik etkisi, setup süreleri, mola/hafta sonu/duruş, bölünebilirlik, geriye planlama, manuel taşıma, çakışmasızlık, gecikme ve üretimdeki rezervasyonlar doğrulanır. API testi kayıt, tekrar numara reddi, hatalı veri reddi, dosya yükleme/indirme, geçmiş, makine ayarları ve sunucu yeniden başlatması sonrası kalıcılığı kapsar; ayrı geçici veritabanı kullanır.

## İlk sürüm sınırları

Bu sürüm tek atölye ve tek makine içindir; kullanıcı girişi/rol yetkilendirmesi içermez. İnternete açık kullanım için kimlik doğrulama, HTTPS ve yedekleme ayrı bir dağıtım adımıdır. `machineId` alanı gelecekte çoklu makine modeli için ayrılmıştır, çoklu makine planlaması henüz uygulanmamıştır.

Setup benzerliğine göre optimizasyon ileri aşamaya bırakılmıştır; mevcut motor girilen setup süresini eksiksiz ayırır. Üretimdeki işin süresi aşılırsa otomatik sensör/PLC verisi yoktur; operatör süreleri ve durumu güncellemelidir. Durum geçişlerinden hesaplanan gerçek süre takvimde geçen süredir; mola ve makine dışı zamanları çıkararak gerçek makine dakikasını detay formunda düzeltin. Evrensel/resmî tatil listesi otomatik yüklenmez; makine ayarlarına eklenir. Geçmiş kayıtlarını ve yüklenen dosyaları içeren kimlik doğrulamalı çok kullanıcılı sistem bu MVP’nin kapsamında değildir.
