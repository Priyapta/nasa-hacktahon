# Arsip cache untuk dibagikan dan deployment

Folder ini menyimpan paket ZIP lokal yang dibagikan melalui penyimpanan file.
**ZIP tidak masuk Git.** README, manifest, dan checksum masuk Git agar tim
mengetahui paket apa yang harus diunggah/diunduh. Clone repo tidak membawa ZIP.
Semua perubahan pada langkah ini hanya berada di `backend/`.

## Daftar paket

| Paket | Isi | Ukuran | Status upload | Tujuan ekstrak |
| --- | --- | --- | --- | --- |
| `nasa-power-indonesia-2016-2025-cache.zip` | 600 file data harian NetCDF + 600 JSON metadata; 6 variabel, 2016-2025 | 116.641.078 byte (sekitar 117 MB) | Belum diunggah | `backend/data/power/` |
| `soilgrids-grobogan-samples-v1.zip` | 45 subset GeoTIFF native + 45 JSON metadata; tiga polygon sampel, kedalaman 0-30 cm | 80.605 byte (sekitar 81 KB) | Belum diunggah | `backend/data/soilgrids/` |
| `soilgrids-indonesia-catalogs-grobogan-v1.zip` | 45 katalog VRT yang dipangkas ke kotak Indonesia + 45 raster tanah seluruh kotak Grobogan dengan JSON metadata | 2.576.386 byte (sekitar 2.5 MB) | Belum diunggah | `backend/data/soilgrids/` |

Paket SoilGrids tersedia untuk tiga polygon uji kecil dekat Grobogan, bukan seluruh Indonesia. Paket NASA POWER mencakup kotak sekitar Indonesia,
termasuk laut dan sebagian negara tetangga; hujan belum divalidasi pembanding.
Rincian mesin ada di `../contracts/power-data.md`.

## Yang perlu diunggah

Unggah ke folder penyimpanan bersama atau object storage:

1. `nasa-power-indonesia-2016-2025-cache.zip`.
2. `soilgrids-grobogan-samples-v1.zip` untuk sampel tanah.
3. `soilgrids-indonesia-catalogs-grobogan-v1.zip` agar tanah lahan baru di Indonesia cepat dan Grobogan bisa tanpa internet.
4. `checksums.sha256` untuk pemeriksaan integritas unduhan.

README dan `manifest.json` boleh disertakan sebagai panduan. Setelah upload,
isi URL nyata pada `upload_url` dan ubah `upload_status` di `manifest.json`,
lalu perbarui status tabel ini. Jangan mengisi link sementara bertoken atau
rahasia ke repo. Saat ini belum ada upload yang dilakukan.

Tidak perlu upload `download.log`, `download-status.json`, lock, file sementara,
`.venv`, atau `data/power/results/`. Hasil berbobot polygon dapat dihitung ulang.

## Memakai paket dari root repo (WSL)

Setelah ZIP diletakkan di folder ini:

```bash
(cd backend/cache-archives && sha256sum -c checksums.sha256)
unzip backend/cache-archives/nasa-power-indonesia-2016-2025-cache.zip -d backend/data/power
cd backend
.venv/bin/python scripts/test_power_sample.py
```

Hasil yang benar adalah `backend/data/power/raw/*.nc` dan sidecar `*.json`.
ZIP juga membawa `archive-manifest.json` pada root ekstraksi. Tidak perlu
menjalankan script pengunduh jika arsip lokal yang dibutuhkan sudah valid.
Untuk deployment, ekstrak ke penyimpanan persisten yang dibaca backend.

## Menambah cache lain nanti

Tambahkan ZIP ke folder ini, satu entri pada `manifest.json`, dan checksum
pada `checksums.sha256`. Dokumentasikan isi, periode/versi, tujuan ekstrak,
serta status/link upload. Nama ZIP sebaiknya menyertakan jenis data dan
periode/versinya. Jangan menggunakan `git add -f` pada ZIP.


## Memakai paket sampel SoilGrids

Dari root repo:

```bash
unzip backend/cache-archives/soilgrids-grobogan-samples-v1.zip -d backend/data/soilgrids
cd backend
.venv/bin/python scripts/test_soil_samples.py
```

Paket ini hanya mencakup tiga polygon uji kecil yang didefinisikan di
`backend/data/soilgrids/samples.json`. Bukan data tanah seluruh Grobogan atau
Indonesia. Kode dapat mengambil window baru bila jaringan diizinkan.
Rebuild paket setelah persiapan sampel lengkap:

```bash
.venv/bin/python scripts/package_soil_samples.py
```

Script memverifikasi cache, membuat ZIP, dan memperbarui manifest serta checksum.
ZIP tetap tidak masuk Git. Tabel README diperbarui saat ukuran paket berubah.


Profil iklim bulanan BE-05 adalah cache turunan di `backend/data/power/results/`.
Tidak perlu paket ZIP atau upload tambahan: hasil dapat dihitung ulang dari
paket NASA POWER yang sudah ada memakai `scripts/test_climate_sample.py`.


## Memakai paket katalog Indonesia dan tanah Grobogan

Dari root repo:

```bash
unzip backend/cache-archives/soilgrids-indonesia-catalogs-grobogan-v1.zip -d backend/data/soilgrids
```

Hasilnya `backend/data/soilgrids/catalogs/*.vrt` dan raster Grobogan di
`backend/data/soilgrids/raw/`. Dengan katalog lokal, tanah untuk lahan baru di
dalam kotak Indonesia diambil dalam beberapa detik, terukur 5,8 detik untuk
satu lahan baru di Grobogan dan Lampung. Lahan di dalam kotak Grobogan
dipotong dari raster lokal tanpa request ke ISRIC, terukur 0,6 detik. Lahan di
luar kotak Indonesia tetap memakai katalog global seperti sebelumnya.

Membuat ulang paket dari folder backend:

```bash
.venv/bin/python scripts/prepare_soil_catalogs.py
.venv/bin/python scripts/prepare_soil_region.py
```

Script pertama mengunduh 45 katalog global sekali (3,5 sampai 6 MB per katalog)
dan hanya menyimpan tile di kotak Indonesia (146 sampai 238 KB per katalog,
total 9,6 MB).
Script kedua menyiapkan raster Grobogan, membuat ZIP, dan memperbarui manifest
serta checksum.
