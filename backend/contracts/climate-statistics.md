# BE-05: profil iklim bulanan dan jendela historis

Branch `climate-statistics` berbasis `geocode`. Implementasi mengikuti PRD
bagian 9. PRD, frontend, kontrak respons utama, dan data sumber tidak diubah.
Semua perubahan berada di `backend/`.

## Alur data

`PowerService` menyediakan data harian berbobot area polygon dari arsip lokal.
`core/climate.py` menghitung statistik sebagai fungsi murni tanpa jaringan,
filesystem, atau clock. `services/climate.py` mengatur pemanggilan service
harian, validasi `ClimateContext`, provenance, serta cache hasil.

1. Baca enam variabel harian yang sudah dikonversi ke satuan internal BE-03.
2. Susun 12 bulan per tahun, termasuk hari kalender yang tidak ada di seri.
3. Periksa kelengkapan, lalu hitung agregat tiap bulan/tahun yang sah.
4. Susun profil musiman 12 bulan dari nilai tahunan yang sah.
5. Bentuk jendela bulan historis berurutan sesuai bulan mulai dan horizon.

Tidak memerlukan unduhan dataset bulanan terpisah. Data harian tidak dihapus
atau dimutasi; tetap tersedia untuk indikator jeda hujan pada tahap berikutnya.

## Kelengkapan bulanan

Aturan PRD dipakai apa adanya: lebih dari tiga hari hilang menyebabkan agregat
bulan tersebut tidak dipakai; kurang dari delapan tahun sah diberi catatan data
terbatas. Tepat tiga hari hilang masih diterima, tepat delapan tahun tidak
ditandai data terbatas. Tahun kabisat memakai kalender sebenarnya.

Pemeriksaan dilakukan per variabel. Tanggal yang tidak ada, null, nonfinite,
sentinel -999, serta nilai hujan/radiasi negatif atau kelembapan di luar 0-100
menjadi hari hilang. Nilai nol hujan yang sah tetap dihitung nol. Salah satuan,
parameter wajib hilang, tanggal di luar periode, atau nilai teks ditolak sebagai
input internal rusak. Tidak mengonversi unit kedua kali atau menebak data.

Agregat dengan 1-3 hari hilang memakai observasi yang tersedia tanpa imputasi,
tanpa menganggap hujan yang hilang bernilai nol, dan tanpa menaikkan total ke
estimasi sebulan penuh. Catatan keterbatasan ikut hasil.

### Satu angka `n_years` pada kontrak yang sudah ada

Kontrak memiliki satu `n_years` untuk setiap bulan kalender. Detail teknis yang
dipakai di BE-05 adalah **himpunan tahun sah bersama untuk keenam variabel**:
bila salah satu variabel mempunyai lebih dari tiga hari hilang, tahun-bulan itu
tidak ikut profil untuk semua variabel. Dengan demikian angka dan jumlah tahun
yang ditampilkan benar-benar memakai tahun yang sama.

Nilai dan jumlah hari hilang per variabel tetap disimpan dalam audit
`monthly_by_year`; tidak membuang data sumber yang masih tersedia.
`quality` mencatat tahun sah/dikeluarkan dan `data_limited`. Pendekatan ini
konservatif: hilangnya variabel konteks seperti radiasi juga dapat mengurangi
jumlah tahun profil. Detail ini dicatat eksplisit, bukan menambah ambang baru
atau mengubah bentuk kontrak FE.

Jika tidak ada tahun sah, nilai iklim dan kelas bulan menjadi null, `n_years=0`,
serta catatan data terbatas. Tidak mengganti data kosong dengan angka contoh.

## Agregasi dan profil

| Field/variabel | Agregasi dalam satu tahun-bulan | Profil antar-tahun sah |
| --- | --- | --- |
| Hujan PRECTOTCORR | Jumlah observasi harian, mm | Median, minimum, maksimum |
| T2M -> t_mean_c | Rata-rata harian, C | Median |
| T2M_MIN -> t_min_c | Rata-rata minimum harian, C | Minimum dari nilai bulanan-tahunan |
| T2M_MAX -> t_max_c | Rata-rata maksimum harian, C | Maksimum dari nilai bulanan-tahunan |
| Radiasi -> rad | Rata-rata harian, MJ/m2/day | Median |
| Kelembapan -> rh_pct | Rata-rata harian, persen | Median |

Ini memperinci arti field temperatur pada contoh PRD: t_min/t_max adalah
batas antar-tahun dari rata-rata temperatur minimum/maksimum harian dalam
bulan tersebut, bukan nilai ekstrem harian tunggal. Semua rata-rata tahunan
masih tersedia dalam audit untuk perhitungan berikutnya.

Tidak menghitung persentil halus. Median dengan jumlah tahun genap memakai
rata-rata dua nilai tengah. Presisi tidak dibulatkan sebelum perhitungan;
pembulatan tampilan dapat dilakukan frontend.

Kelas bulan dari median hujan bulanan, dengan batas persis PRD:

- `basah`: lebih dari 200 mm.
- `lembap`: 100 sampai 200 mm, termasuk kedua batas.
- `kering`: kurang dari 100 mm.

Ambang dan metode dicatat dalam provenance. Ini kelas bulan yang didefinisikan
PRD bagian 9; tidak menambah metode atau label agroklimat lain.

## Jendela historis berurutan

`start_month` tetap berformat YYYY-MM. Setelah input aplikasi divalidasi,
bulan kalendernya dipetakan ke masing-masing tahun arsip. Tahun rencana
pengguna tidak diekstrapolasi menjadi data cuaca masa depan.

Untuk arsip 2016-2025, bulan mulai November:

| Horizon | Jumlah jendela kalender lengkap |
| --- | --- |
| 6 bulan | 9 |
| 12 bulan | 9 |
| 18 bulan | 8 |
| 24 bulan | 8 |

Horizon 12 pertama: November 2016-Oktober 2017; terakhir: November 2024-Oktober
2025. Horizon 24 terakhir: November 2023-Oktober 2025. Untuk bulan mulai Januari,
horizon 12 memberi 10 dan horizon 24 memberi 9; jumlah tidak di-hardcode.

Setiap jendela menyimpan bulan/tahun sumber yang sebenarnya dan nilai
bulan-tahunnya. Tidak merangkai median/minimum bulanan dari tahun berbeda
menjadi satu tahun buatan. Jendela yang tidak muat dalam periode arsip tidak
dibentuk. Urutan kalender yang berlubang secara struktural ditolak.

Jendela dengan bulan tidak sah tetap ada dalam audit, diberi `valid=false` dan
`invalid_months`. Jumlah tahun pembanding harus memakai jendela sah; tidak
menghilangkan bulan lalu menyambung bulan berikutnya. `window_summary` memisahkan
jumlah tersedia, sah, dan tidak sah. Seleksi tahap tanam/K1-K5 belum dilakukan.

## Hasil service dan kontrak

Hasil internal memiliki:

- `climate`: objek period/monthly yang sesuai `ClimateContext` BE-02.
- `monthly_by_year`: audit agregat asli per tahun-bulan, validity dan hari hilang.
- `quality`: himpunan tahun per bulan dan penanda data terbatas.
- `historical_windows`: rangkaian bulan sumber beserta validitasnya.
- `window_summary`, `notes`, `provenance`, dan `assumptions`.

Field audit adalah data internal service, bukan field baru pada respons
`/analyze`. Endpoint `/analyze` belum dipasang. Profil ini belum menilai tanaman,
memilih strategi, atau menyatakan pola tertentu layak.

Teks catatan/asumsi tersedia dalam id/en. Data mentah dan provenance teknis
sumber dipertahankan. Status validasi hujan dari service sumber tetap dibawa;
`unvalidated` diberi catatan. Sukses menghitung profil bukan bukti hujan POWER
sudah cocok dengan CHIRPS/IMERG/BMKG. Validasi pembanding tetap BE-13.
Hasil berlabel estimasi historis, bukan prediksi, peluang tahun depan, atau
proyeksi tren. Tidak menambahkan skor gabungan.

## Cache hasil

File `data/power/results/climate-*.json` menyimpan envelope hasil dan checksum
hasilnya. Kunci mencakup polygon, tahun referensi terakhir lengkap menurut WIB,
bulan mulai, horizon, bahasa dan versi metode. Worker/query serentak untuk kunci
yang sama memakai file lock bersama.

Sebelum memakai cache, service memeriksa checksum hasil, kontrak climate,
periode referensi, versi metode, serta ukuran/checksum setiap file sumber.
Perubahan sumber, file yang hilang, atau hasil cache yang rusak memicu hitung
ulang. Cache tidak menyembunyikan pergantian tahun referensi. Naikkan versi
metode jika aturan hitung/adaptor sumber berubah pada pengembangan berikutnya.

Checksum sumber tetap memerlukan pembacaan file, tetapi cache menghindari
pembukaan ulang NetCDF, pembobotan harian, dan seluruh agregasi statistik.
`provenance.cache_hit` menyatakan penggunaan cache. Cache turunan dapat dibuat
ulang dan tidak perlu ZIP/upload tersendiri. Paket raw NASA yang sudah ada
cukup untuk menghasilkan profil ini. Raw/hasil tidak masuk Git.

## Menjalankan demo di WSL

Dari folder backend:

```bash
.venv/bin/python scripts/test_climate_sample.py
.venv/bin/python scripts/test_climate_sample.py --start-month 2026-11 --horizon-months 24
.venv/bin/python -m pytest -q
```

Script memakai polygon contoh dan sepuluh tahun kalender lengkap terakhir.
Default bulan mulai adalah bulan WIB saat script dijalankan. Tidak memakai
jaringan; file sumber yang belum tersedia menghasilkan galat cache yang jelas.
Hasil ringkas dicetak dan hasil lengkap disimpan di folder results di atas.

Pemanggilan internal:

```python
from app.services.climate import ClimateService
result = ClimateService().for_polygon(
    location, start_month="2026-11", horizon_months=12,
    lang="id", allow_network=False,
)
```

`allow_network=True` mengizinkan service POWER mengambil file yang belum ada.
Parameter horizon/bulan/bahasa diperiksa sebelum pembacaan atau pengambilan
sumber. Validasi bulan berjalan hingga 11 bulan ke depan tetap tanggung jawab
schema input aplikasi; core statistik sengaja bebas clock agar deterministik.


## Verifikasi implementasi

- 193 tes offline lulus. Tes memakai angka hujan/suhu yang jawabannya diketahui,
  batas 3/4 hari hilang, 7/8 tahun sah, tahun kabisat, batas 100/200 mm,
  perpindahan tahun, data kosong, serta perubahan sumber/cache.
- Clock tahun referensi pada tes dibekukan, sehingga tes tidak bergantung pada
  tahun mesin saat dijalankan. Core hitung tetap tanpa clock.
- Smoke check arsip nyata 2016-2025: 12 bulan profil, seluruhnya 10 tahun sah;
  November horizon 12 memberi 9 jendela sah dan horizon 24 memberi 8.
- Pembacaan/perhitungan pertama contoh sekitar 13,7 detik, permintaan ulang
  dari cache sekitar 0,04 detik pada mesin ini. Ini pengukuran satu polygon,
  bukan jaminan latensi untuk semua lokasi atau deployment.
- Pengecekan langsung dari NetCDF sel sumber yang sepenuhnya mencakup polygon
  contoh: Januari 2016 memiliki 31 hari dengan jumlah hujan 237,369998 mm;
  Februari 2016 memiliki 29 hari dan 369,970000 mm. Hasil service cocok dengan
  penjumlahan langsung nilai harian. Pemeriksaan ini bukan validasi terhadap
  alat ukur/stasiun atau dataset pembanding.
- Raw data/ZIP sumber tidak berubah; hasil turunan dapat dihitung ulang.
