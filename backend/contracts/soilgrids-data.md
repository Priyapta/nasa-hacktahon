# SoilGrids untuk polygon: service tanah BE-04

Branch `soilgrids` berbasis `nasa-power`. Perubahan dibatasi ke `backend/`.
PRD tidak diubah. Bentuk `soil` tetap mengikuti schema BE-02; input memakai
pengecualian polygon yang sudah disetujui pengguna.

## Cakupan

Service membaca seluruh pixel tanah yang beririsan dengan polygon, bukan
mengambil centroid. Properti: pH air (`phh2o`), karbon organik (`soc`), liat
(`clay`), pasir (`sand`), dan debu (`silt`). Kedalaman 0-5, 5-15, 15-30 cm;
statistik mean, Q0.05, Q0.95. Total 45 layer untuk satu subset spasial.

Hasil internal memiliki `soil`, `notes`, `provenance`, `skipped_rules`, dan
`details`. `soil` langsung divalidasi menggunakan `SoilAvailable` atau
`SoilUnavailable` yang sudah ada. `details` menyimpan audit coverage, fraksi
tekstur, metode, dan identitas file sumber; bukan field respons analisis baru.

`/analyze` belum dipasang. SoilGrids tidak menghasilkan rekomendasi tanaman.
Pencarian lokasi Nominatim pada BE-04 adalah pekerjaan terpisah dan tidak
diimplementasikan oleh perubahan service tanah ini.

## Akses penyedia dan alasan memilih raster asli

ISRIC masih memuat pemberitahuan penghentian sementara REST API. REST point
query juga bukan metode untuk mengagregasi seluruh pixel polygon.
WCS dan WebDAV adalah alternatif yang didokumentasikan ISRIC.

Probe WCS pada 14 November 2026 berhasil mengembalikan GeoTIFF, tetapi file
sampel tidak mempunyai nilai NoData dan menampilkan nol pada area yang di raster
asli diberi NoData. `DescribeCoverage` sampel juga memuat unit template yang
tidak sesuai pH. Karena itu implementasi tidak memakai WCS sebagai sumber
angka; implementasi membaca window raster asli dari VRT WebDAV resmi:

`https://files.isric.org/soilgrids/latest/data/{property}/{coverage_id}.vrt`

GDAL membaca subset data yang diperlukan dari tile melalui akses HTTP, tidak
mengunduh seluruh raster dunia. Catalog VRT dan blok tile di baliknya tetap
memerlukan transfer jaringan; ukuran file subset lokal bukan ukuran transfer
jaringan total. Tidak mengunduh seluruh Indonesia pada tahap ini.

Sumber resmi:

- [Status dan akses SoilGrids](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html)
- [Akses WebDAV](https://docs.isric.org/globaldata/soilgrids/WebDav.html)
- [WCS](https://docs.isric.org/globaldata/soilgrids/wcs.html)
- [Layer, satuan, kedalaman, dan ketidakpastian](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html)

## Grid dan bobot area

Raster asli memakai Interrupted Goode Homolosine pada WGS84, pixel 250 x 250 m.
Polygon WGS84 dipadatkan vertex-nya pada segmen maksimal 0,001 derajat lalu
ditransformasikan ke proyeksi sumber. Irisan polygon/pixel dihitung pada grid
asli tersebut. Proyeksi ini bersifat equal-area; bobot adalah luas irisan
proyeksi dibagi jumlah luas seluruh irisan. Batas lubang polygon dipertahankan.
Sel yang hanya menyentuh batas tanpa luas tidak ikut dihitung.

Referensi proyeksi: [PROJ IGH](https://proj.org/en/stable/operations/projections/igh.html).
Ini pendekatan luas proyeksi untuk ringkasan raster, bukan pengukuran survei.
Geometri yang melintasi sela/interupsi proyeksi atau antimeridian belum
tervalidasi; sampel Indonesia di sini berada dalam satu bagian proyeksi.
Tidak boleh menggunakan hasil ini sebagai klaim dukungan global tanpa validasi.

Batas subset dibulatkan ke grid 250 m, dengan satu pixel penyangga. Semua layer
lokal harus cocok CRS, resolusi, orientasi, bounds, identitas properti/depth/
statistic, dan NoData. Representasi proyeksi VRT dapat menghilangkan parameter
nol yang ditambahkan saat menjadi GeoTIFF; parameter PROJ lengkap yang sudah
dinormalisasi dibandingkan, bukan nama tampilan atau kode EPSG palsu 152160.

Cache subset yang lebih besar dapat dipakai untuk polygon yang lebih kecil.
Saat dibaca, semua layer dipotong ke window native yang sama. Tidak ada
resampling, interpolasi, atau penggantian grid menjadi titik.
Ada batas pemrosesan lokal 100.000 pixel per window untuk mencegah unduhan
raksasa yang tidak disengaja; melampaui batas menghasilkan tanah unavailable
beserta alasan internal, bukan mengecilkan polygon. Pengolahan area yang lebih
besar memerlukan cache bertile dan pengujian terpisah.

## Konversi dan kedalaman

Tabel konversi mengacu pada dokumentasi layer ISRIC, bukan unit template WCS:

| Properti | Nilai peta | Nilai internal |
| --- | --- | --- |
| phh2o | pH x 10 | bagi 10 -> pH |
| soc | dg/kg | bagi 10 -> g/kg |
| clay/sand/silt | g/kg | bagi 10 -> persen |

Untuk setiap properti/statistik, hitung rerata spasial dengan bobot luas, lalu:

`nilai_0_30 = (nilai_0_5 * 5 + nilai_5_15 * 10 + nilai_15_30 * 15) / 30`

Bukan rata-rata sederhana tiga layer. pH diperlakukan sebagai rata-rata
aritmetika sebagaimana ringkasan berbobot dalam PRD, bukan simulasi aktivitas ion.
Tidak memakai bulk density atau mengubah konsentrasi SOC menjadi stok karbon.

## Tekstur USDA

Kelas tekstur berasal dari rerata area/kedalaman pasir, debu, dan liat.
Karena hasil model independen dan pembulatan dapat menghasilkan jumlah yang
sedikit berbeda dari 100, fraksi dinormalisasi hanya untuk koordinat klasifikasi.
Fraksi asli dan jumlahnya tetap dicatat di `details`; tidak menimpa raw data.

Dua belas kelas menggunakan ID Inggris standar: sand, loamy sand, sandy loam,
loam, silt loam, silt, sandy clay loam, clay loam, silty clay loam, sandy clay,
silty clay, clay. Ini kelas dari komposisi rata-rata, bukan mayoritas kelas
pixel dan bukan pernyataan seluruh lahan memiliki tekstur seragam.

Referensi: [USDA NRCS Soil Texture Calculator](https://www.nrcs.usda.gov/resources/education-and-teaching-materials/soil-texture-calculator).
Pengujian mencakup contoh 12 kelas dan seluruh kombinasi persen bilangan bulat
pada segitiga. Label dapat diterjemahkan pada lapisan presentasi; ID tidak berubah.

## Ketidakpastian

Q0.05 dan Q0.95 sumber dikonversi serta dibobot dengan bobot area/kedalaman yang
sama. Output `uncertainty[property].q05/q95` adalah **ringkasan kuantil sumber
berbobot**, bukan kuantil distribusi gabungan, bukan interval prediksi lahan 90%,
dan bukan propagasi ketidakpastian berdasarkan korelasi antar-layer/pixel.
Catatan ini ikut hasil service, tidak hanya berada dalam dokumentasi.

Jika suatu batas kuantil hilang atau urutannya tidak valid, rentang properti itu
tidak dikirim dan ada catatan. Mean yang lengkap tetap boleh dipakai. Mean tidak
harus dipaksa berada di antara dua kuantil; keduanya berasal dari statistik model.

## Data hilang dan penilaian parsial

- Mask asli NoData -32768 dipertahankan dalam GeoTIFF; mask dibaca sebagai NaN.
- Nilai nonfinite atau di luar batas fisik properti menjadi tidak tersedia;
  nilai nol SOC/fraksi tanah yang sah tidak dianggap hilang.
- Mean setiap properti harus tersedia untuk seluruh luas berbobot dan ketiga
  kedalaman. Tidak membobot ulang area/layer tersisa untuk menutup kekosongan.
- Jika mean wajib tidak lengkap, `soil.status=unavailable`, angka null,
  `uncertainty={}`, dan `skipped_rules=["K3"]`. Catatan menyatakan penilaian
  parsial. Router analisis kelak tetap memberi HTTP 200 sesuai PRD.
- Kegagalan penyedia dapat memakai cache valid. Tanpa cache, hasil unavailable;
  tidak mengisi angka demo atau angka perkiraan sebagai hasil nyata.
- Kesalahan input polygon tetap ditolak validasi sebelum service mengambil data.
- Data unavailable tidak disimpan sebagai cache angka lingkungan.

## Cache, refresh, dan sample

`data/soilgrids/raw/` berisi subset GeoTIFF dan JSON metadata/hash. Kedalaman dan
statistik ada pada nama file. Ada lock per file, validasi integritas, temporary
file sebelum publikasi, retry, dan fallback saat refresh gagal. Versi sumber,
URL, waktu fetch, CRS, bounds, faktor konversi, dan checksum dicatat.

Ini data model tanah, bukan deret harian. Tidak perlu update harian. Cache tidak
punya TTL otomatis; `refresh=True` dipakai sengaja untuk mengambil revisi sumber
rolling release. Waktu fetch tiap layer dicatat agar perbedaan waktu terlihat.
File ZIP/raw tidak masuk Git; definisi polygon sampel dan kode masuk Git.

Tiga polygon dalam `data/soilgrids/samples.json` adalah area uji kecil dekat
Grobogan yang dipilih dari pixel sumber valid, bukan batas lahan hasil survei
atau lokasi demo yang sudah disepakati tim. Satu subset bersama mencakup ketiga
polygon sehingga 45 raster dapat dipakai bersama.

## Katalog lokal Indonesia dan wilayah Grobogan

Setiap katalog VRT global berukuran 3,5 sampai 6 MB dan mendaftar 7.692 tile
dunia. Membaca katalog lewat HTTP untuk setiap lahan memakan sekitar 12 detik
per lapisan, atau 9 sampai 13 menit untuk 45 lapisan satu lahan. Katalog
terakhir diubah Juni 2020, sehingga backend menyimpan salinan lokalnya.

`download_catalog` mengunduh katalog sekali, membuang tile di luar kotak
Indonesia (94 sampai 142 BT, 12 LS sampai 7 LU, sama dengan arsip NASA POWER),
dan menulis ulang path tile menjadi URL absolut ISRIC. Ukuran raster dan
geotransform global tidak diubah, sehingga perhitungan window piksel tetap
sama. Pada katalog pH 0-5 cm tersisa 285 dari 7.692 tile, dari 3.442 KB menjadi
146 KB. Ke-45 katalog berukuran 146 sampai 238 KB, total 9,6 MB. Empat puluh lima lapisan sebuah lahan diambil bersamaan dengan delapan
thread.

Lahan di luar kotak Indonesia tetap memakai katalog global jarak jauh. Bila
katalog lokal gagal diunduh, kode kembali ke katalog global. Raster wilayah
Grobogan (55.420 piksel per lapisan) disiapkan sekali dan dipakai ulang oleh
`find_cached` untuk setiap lahan di dalamnya.

| Kasus | Sebelum | Sesudah |
| --- | --- | --- |
| Lahan baru di Indonesia | 9 sampai 13 menit | 5,8 detik (Grobogan dan Lampung) |
| Lahan baru di dalam kotak Grobogan, tanpa internet | Tidak tersedia | 0,6 detik |

## Perintah WSL

Dari root repo:

```bash
cd /home/nau/lomba/nasa/nasa-hacktahon/backend
.venv/bin/python -m pip install -r requirements-dev.lock.txt
.venv/bin/python scripts/prepare_soil_samples.py
.venv/bin/python scripts/test_soil_samples.py
.venv/bin/python -m pytest -q
```

Persiapan dapat diulang; file valid dilewati. Maksimal dua pembaca raster
berjalan bersamaan; gunakan `--workers 1` untuk serial. Progres di
`data/soilgrids/prepare-status.json`. Raw data, hasil, probe, dan status tidak
masuk Git. Script smoke check tidak memakai jaringan dan gagal jika salah satu
sampel tidak tersedia. Tidak menganggap status script unduhan sebagai bukti
kebenaran perhitungan; tes offline dan smoke check dilakukan terpisah.

Pemanggilan internal:

```python
from app.services.soil import SoilService
result = SoilService().for_polygon(location, allow_network=False, lang="id")
```

Tidak ada endpoint baru, perubahan kontrak respons utama, atau perubahan PRD.


## Verifikasi dan paket hasil

- 133 tes offline lulus, mencakup regresi CRS asli VRT, mask NoData, kegagalan
  penyedia, cache rusak, pembobotan kedalaman, luas irisan, dan klasifikasi.
- Ketiga polygon sampel berhasil diproses dari 45 layer nyata tanpa jaringan;
  semua memiliki mean lima properti dan ringkasan lima pasang kuantil.
- ZIP sampel berhasil diekstrak ke direktori sementara dan ketiga polygon
  kembali menghasilkan status ok dengan jaringan dimatikan.
- Paket `cache-archives/soilgrids-grobogan-samples-v1.zip` sekitar 81 KB;
  raw subset sekitar 88 KB sebelum metadata. Ini hanya subset sangat kecil,
  bukan ukuran data tanah seluruh Indonesia atau ukuran transfer sumber.
- Paket dan raw diabaikan Git. Manifest/checksum/petunjuk upload dilacak.
