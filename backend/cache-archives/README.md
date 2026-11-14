# Arsip cache untuk dibagikan dan deployment

Folder ini menyimpan paket ZIP lokal yang dibagikan melalui penyimpanan file.
**ZIP tidak masuk Git.** README, manifest, dan checksum masuk Git agar tim
mengetahui paket apa yang harus diunggah/diunduh. Clone repo tidak membawa ZIP.
Semua perubahan pada langkah ini hanya berada di `backend/`.

## Daftar paket

| Paket | Isi | Ukuran | Status upload | Tujuan ekstrak |
| --- | --- | --- | --- | --- |
| `nasa-power-indonesia-2016-2025-cache.zip` | 600 file data harian NetCDF + 600 JSON metadata; 6 variabel, 2016-2025 | 116.641.078 byte (sekitar 117 MB) | Belum diunggah | `backend/data/power/` |

Belum ada cache SoilGrids. Data di atas mencakup kotak sekitar Indonesia,
termasuk laut dan sebagian negara tetangga; hujan belum divalidasi pembanding.
Rincian mesin ada di `../contracts/power-data.md`.

## Yang perlu diunggah

Unggah ke folder penyimpanan bersama atau object storage:

1. `nasa-power-indonesia-2016-2025-cache.zip`.
2. `checksums.sha256` untuk pemeriksaan integritas unduhan.

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
