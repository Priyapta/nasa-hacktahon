# Integrasi halaman input dengan backend

Halaman `/` memakai GET `/api/v1/crops` dan GET `/api/v1/geocode` melalui
proxy Next.js. Empat input disimpan di URL. Tombol Bandingkan strategi menuju
`/hasil`, yang mengirim POST `/api/v1/analyze` dengan polygon, rotasi, bulan mulai,
horizon, sumber air dan bahasa. Tidak ada request analisis saat pengguna baru
menggambar/mengisi form. Geocode nama tempat hanya dipanggil saat submit pencarian.

Halaman hasil menampilkan strategi sesuai respons BE, kalender sederhana,
kelayakan, lima dimensi, alasan/kompromi/risiko, tanah, catatan dan sumber/asumsi.
Jumlah kartu mengikuti BE. Tidak ada nilai rekomendasi yang dihitung ulang di FE.
Ada loading/retry; request dibatalkan saat konteks berubah atau halaman ditinggalkan,
dan respons lama tidak mengganti hasil baru. Polygon tidak valid tidak dikirim.
Desain form dan agent tidak dirombak.

## Menjalankan di WSL

Dari root repo, siapkan dependensi bila belum ada:

```bash
npm ci
backend/.venv/bin/python -m pip install -r backend/requirements-dev.lock.txt
```

Terminal pertama, dari root repo:

```bash
npm run dev:backend
```

Terminal kedua, dari root repo:

```bash
npm run dev:frontend -- --port 3100
```

Buka http://localhost:3100. Proxy memakai `API_URL`, default
`http://127.0.0.1:8000`. Untuk BE remote, set `API_URL` sebelum build/start Next.js
dan build ulang. Variabel ini URL server BE, bukan URL frontend.

## Cache lokal

Paket `soilgrids-indonesia-catalogs-grobogan-v1.zip` diekstrak ke
`backend/data/soilgrids/`. Pada mesin pemilik paket berasal dari folder
`C:/Users/naufa/OneDrive/Documents/UI/Matkul_UI/smt7/cg/tugas/tugas3/`.
SHA-256 cocok dengan `backend/cache-archives/manifest.json`.
Paket berisi katalog Indonesia dan 45 raster + metadata wilayah Grobogan.
Cache dan manifest hasil ekstraksi tidak masuk Git.

Data POWER lokal juga harus tersedia untuk demo offline. Lihat
[panduan paket cache](../backend/cache-archives/README.md).
Percobaan iklim pertama dapat mencapai batas waktu BE (HTTP 502); tombol Coba lagi
mengulang analisis. Tidak ada retry otomatis berulang atau perubahan timeout BE.

## Verifikasi

Dari root repo:

```bash
npm test
npm run build
npx playwright install chromium
# Dengan FE :3100 dan BE :8000 sedang berjalan:
npx playwright test --config frontend/playwright.config.ts frontend/tests/analysis-integration.spec.ts frontend/tests/input-flow.spec.ts frontend/tests/month-picker.spec.ts
```

Tes integrasi pertama menggunakan endpoint crops dan analyze asli melalui proxy;
hanya citra peta yang dimock. Tes kegagalan/retry, jumlah kandidat, bahasa/respons
lama dan polygon invalid memakai respons uji agar deterministik. Jangan membaca
fixture sebagai hasil agronomi nyata.

Verifikasi lokal 14 November 2026: build berhasil, 19 unit tests lulus
(17 frontend + 2 shared), 4 tes integrasi dan 14 tes regresi UI lulus.
Request nyata melalui proxy menghasilkan HTTP 200, tanah ok dan 3 strategi;
pengukuran satu request hangat sekitar 2,8 detik, bukan jaminan latensi.
Tiga sampel tanah juga berhasil dibaca dari cache baru tanpa jaringan.
