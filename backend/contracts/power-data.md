# BE-03: data harian NASA POWER untuk polygon

Implementasi ada di branch `nasa-power`, berbasis `api-contracts`.
PRD tidak diedit. Semua perubahan implementasi ini berada di `backend/`.

## Cakupan implementasi

- Unduhan regional harian, satu variabel dan satu tahun kalender per permintaan.
- Arsip cakupan Indonesia 2016-2025: 10 petak x 10 tahun x 6 variabel = 600 file.
- File mentah NetCDF dan metadata sumber/versi, URL, waktu, satuan, grid,
  kelengkapan tanggal, ukuran, dan SHA-256.
- Resume, request berurutan, timeout, retry/backoff, penanganan Retry-After numerik,
  file sementara, validasi sebelum publikasi file, dan fallback cache valid.
- Penggabungan seluruh sel sumber yang memiliki luas irisan positif dengan polygon.
- Pengujian offline data buatan dan smoke check eksplisit memakai unduhan nyata.

Ini adalah service pengambil/pengolah data harian, belum endpoint `/analyze`,
profil bulanan/Oldeman, rekomendasi rotasi, SoilGrids, atau validasi hujan.
`/docs` tetap hanya menampilkan endpoint aplikasi yang benar-benar aktif.

## Sumber dan parameter

Endpoint: `https://power.larc.nasa.gov/api/temporal/daily/regional`.
Community `AG`, format `NETCDF`, standar waktu `LST` dikirim eksplisit.
LST adalah waktu matahari lokal dari POWER, bukan WIB. WIB tetap dipakai untuk
validasi bulan input dan pemilihan tahun kalender lengkap terakhir.

| Parameter | Satuan internal harian |
| --- | --- |
| T2M, T2M_MIN, T2M_MAX | C |
| PRECTOTCORR | mm/day |
| RH2M | % |
| ALLSKY_SFC_SW_DWN | MJ/m^2/day |

Satuan dibaca dari atribut file. Radiasi dalam kWh/m2/day dikonversi x3,6 jika
itu yang diberikan penyedia; satuan yang tidak dikenal ditolak. Sampel `AG`
nyata yang diuji sudah menggunakan MJ/m^2/day. Tidak menebak dari besarnya angka.
Area-mean T2M_MIN/MAX berarti rata-rata spasial minimum/maksimum harian tiap sel,
bukan suhu paling rendah/tinggi di seluruh polygon.

Dokumentasi resmi: [Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/),
[resolusi sumber](https://power.larc.nasa.gov/docs/services/),
[akses massal AWS](https://power.larc.nasa.gov/docs/services/aws/).
Respons API yang diuji pada 14 November 2026 menolak permintaan wilayah lebih
lebar dari 10 derajat per sisi dan periode lebih panjang dari 366 hari.

## Arsip Indonesia

Batas arsip adalah kotak 94-142 BT dan 12 LS-7 LU. Ini termasuk laut dan bagian
negara tetangga, bukan data yang sudah dipotong batas administratif Indonesia.
Ada penyangga agar grid di tepi wilayah Indonesia tetap tersedia.

Grid meteorologi dari koordinat file nyata: latitude 0,5 derajat, longitude
0,625 derajat. Radiasi: 1 x 1 derajat. Service memeriksa spacing ini pada setiap
file; jika sumber berubah, ingest gagal agar metode ditinjau ulang.
Titik koordinat dalam file adalah pusat sel. Batas sel dibentuk pada setengah
spacing di setiap sisi. Grid meteorologi dan radiasi diproses terpisah.

Nama file mencakup parameter/tahun/batas petak, agar variabel tidak tertukar.
Tanggal harus lengkap dan berurutan, termasuk 29 Februari pada tahun kabisat.
Nilai hilang tetap boleh ada: daftar tanggal lengkap tidak berarti datanya lengkap.
Sel pada tepi petak yang muncul dua kali dihitung sekali. Jika nilai duplikat
berbeda, service menolak konflik, bukan memilih salah satunya diam-diam.

## Metode polygon

1. Validasi GeoJSON Polygon, termasuk holes, memakai kontrak yang sudah ada.
2. Pilih petak dengan penyangga untuk memperoleh pusat sel yang cakupannya
   beririsan dengan polygon, bukan sekadar pusat yang terletak di polygon.
3. Bentuk batas sel dari koordinat dan spacing grid sumber.
4. Potong sel terhadap polygon, pertahankan holes, abaikan sentuhan tanpa luas.
5. Ukur luas irisan memakai ellipsoid WGS84 (pyproj.Geod), normalkan menjadi bobot.
6. Gabungkan nilai per tanggal dengan bobot yang sama; tidak ada titik perwakilan.

Luas geodesik diukur dari vertex hasil irisan di koordinat geografis. Ini
pendekatan geodesik berbasis segmen vertex; bukan pengukuran luas survei.
Orientasi ring diperbaiki hanya untuk perhitungan tanda luas, bukan mengubah
input pengguna. Lihat [pyproj.Geod](https://pyproj4.github.io/pyproj/stable/api/geod.html).
Geometri yang melintasi antimeridian atau mendekati/melebihi setengah bumi
memerlukan metode geodesik khusus dan belum divalidasi oleh implementasi ini;
arsip Indonesia tidak melintasi antimeridian. Dukungan on-demand di luar
Indonesia belum diuji dengan data nyata dan bukan klaim dukungan global penuh.

Service menolak arsip yang tidak menutup seluruh polygon. Bobot bukan hitungan
jumlah titik sampel. Area kosong tidak diam-diam dihilangkan.

## Data hilang dan cache

- NaN, infinity, sentinel -999, fill/missing_value dari atribut/encoding,
  serta nilai di luar valid_min/valid_max penyedia menjadi nilai hilang.
- Nol hujan tetap nol, tidak dianggap nilai hilang.
- Jika satu sel berbobot kehilangan nilai pada suatu hari, hasil hari tersebut
  null. Tidak membobot ulang hanya dari sel yang tersisa.
- Fraksi area dengan data sah disimpan sebagai `spatial_coverage` setiap hari,
  bersama `missing_days`. Aturan bulan >3 hari hilang dan minimal 8 tahun sah
  tetap pekerjaan statistik BE-05, tidak diganti di service ini.
- File terputus atau respons galat tidak menggantikan cache valid. Pembaca hanya
  membaca file final. Writer service baru menggunakan lock per file.
- `refresh=True` mencoba sumber lagi dan memakai cache valid bila gagal.
  Tanpa refresh, cache valid langsung dipakai dan tidak memanggil penyedia.
- Cache kosong + penyedia gagal memunculkan `ProviderUnavailable`. Router
  analisis kelak memetakannya ke HTTP 502 sesuai PRD; endpoint belum dipasang.
- File impor tanpa sidecar tidak diberi waktu fetch buatan (`fetched_at=null`).

Raw cache bersifat arsip: tidak punya TTL otomatis. Untuk memperbarui nilai
historis yang direvisi NASA, refresh harus dijalankan secara sengaja, dengan
metadata baru. Hasil berbobot menyimpan versi algoritme dan identitas file sumber.
Tidak ada database atau endpoint cache baru.

## Menjalankan di WSL

Dari root repo:

```bash
cd /home/nau/lomba/nasa/nasa-hacktahon/backend
.venv/bin/python -m pip install -r requirements-dev.lock.txt
```

Unduh seluruh cakupan Indonesia (resume otomatis bila dijalankan lagi):

```bash
.venv/bin/python -u scripts/download_power_indonesia.py
```

Untuk enam file sampel saja pada environment yang belum punya arsip:

```bash
.venv/bin/python scripts/download_power_indonesia.py --sample
```

Script menolak downloader kedua untuk direktori arsip yang sama. Pengunduh
Indonesia sudah dijalankan di background pada sesi pengerjaan ini; jangan
menjalankan proses kedua. Lihat progres dan log tanpa mengganggu proses:

```bash
cat data/power/download-status.json
tail -n 5 data/power/download.log
```

Proses background dijalankan memakai subprocess dengan session terpisah di WSL;
tidak mengandalkan terminal foreground. Shutdown WSL/komputer akan menghentikannya.
Jalankan perintah yang sama untuk melanjutkan; file valid dilewati. Status `partial`
berarti ada file gagal dan daftar sebab tersedia di `failures`. Retry berikutnya
mengisi file yang belum selesai. PID dan progres adalah state lokal, tidak di Git.

Uji seluruh tes (tanpa jaringan):

```bash
.venv/bin/python -m pytest -q
```

Uji data nyata lokal satu tahun, tanpa jaringan:

```bash
.venv/bin/python scripts/test_power_sample.py
.venv/bin/python scripts/test_power_sample.py --cross-grid
```

Sampel kecil: enam variabel tahun 2025, petak 104-114 BT / 12-2 LS.
Polygon fixture kecil menggunakan satu sel per kelompok variabel. Polygon
`--cross-grid` menggunakan dua sel meteorologi dan empat sel radiasi; seluruhnya
berdasarkan data nyata, bukan fixture hasil sintetis. Hasil disimpan di
`data/power/results/` (diabaikan Git). Periode sampel satu tahun hanya untuk smoke
check; default service tetap sepuluh tahun kalender lengkap terakhir.

## Pemanggilan internal

```python
from app.services.power import PowerService

result = PowerService().for_polygon(location, allow_network=False)
```

`location` adalah geometry Polygon kontrak backend. `allow_network=False`
memerlukan semua file lokal. Default `True` dapat mengambil file yang belum ada
untuk polygon tersebut. Di luar kotak Indonesia, service merencanakan petak
regional lain tanpa menolak lokasi hanya karena di luar wilayah demo.

Bentuk hasil di sini adalah data harian internal, bukan `AnalysisResponse`.
`rain_validation.status` tetap `unvalidated`; hujan belum dibandingkan ke CHIRPS,
IMERG, atau BMKG. Tidak boleh dilabeli tervalidasi hanya karena unduhan sukses.

## Batas penerimaan tahap ini

Tes memeriksa bobot yang jawabannya diketahui, sentuhan batas, holes, data
hilang, satuan, coverage tidak lengkap, konflik/duplikasi sel, retry 429,
cache fallback, respons rusak, dan tahun/parameter yang tidak cocok.
Unduhan nasional adalah proses terpisah yang belum tentu selesai saat kode
dinyatakan siap. Jangan mengklaim 600 file lengkap sebelum status `complete`.


## Hasil verifikasi implementasi

- 107 tes offline lulus di WSL Python 3.11; `pip check` tidak menemukan konflik.
- Smoke check data nyata lokal 2025: keenam variabel memuat 365 hari.
- Polygon lintas grid nyata: dua sel meteorologi dan empat sel radiasi.
- Smoke check 2024-2025: 731 hari per variabel, termasuk 29 Februari 2024,
  tanpa hari hilang untuk polygon contoh; proses membaca dan menggabungkan
  cache lokal sekitar 0,9 detik pada mesin ini. Ini pengukuran satu contoh,
  bukan jaminan latensi semua polygon/periode.
- Status unduhan nasional tetap diperiksa pada `download-status.json`, bukan
  ditentukan dari hasil tes atau catatan ini.


## Pengolahan bulanan BE-05

Pengolahan profil bulanan dan jendela historis kini tersedia terpisah melalui
`services/climate.py`. Lihat [climate-statistics.md](climate-statistics.md).
Service POWER pada dokumen ini tetap mengembalikan data harian.
