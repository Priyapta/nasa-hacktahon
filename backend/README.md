# Backend Field Shift

**Status terkini dan panduan penerus:** [HANDOVER.md](HANDOVER.md).
FastAPI, service POWER/SoilGrids, statistik iklim, geocode, crops, mesin rotasi
dan `POST /api/v1/analyze` sudah tersedia. Chat umum OpenAI GPT-6 Luna sudah terpasang
di `/api/v1/agent/chat`; tool baca lahan tersimpan dan analisis lahan mengikuti sesi login pengguna.
Isi `AI_API_KEY` dan `AI_MODEL` di `backend/.env`, lalu jalankan `npm run dev:backend` dari root repo. Launcher memuat file ini otomatis; environment shell yang sudah ada tetap diprioritaskan. Restart backend setelah mengubah env. Jika menjalankan Uvicorn langsung, export variabel di shell terlebih dahulu.

`POST /api/v1/analyze` juga memakai konfigurasi AI ini untuk menyusun penjelasan tiap strategi dalam poin: penilaian, dasar data, dan catatan penting. Satu panggilan mencakup semua strategi; hanya hasil analisis yang dikirim, tanpa koordinat atau akun. Perhitungan dan pemilihan strategi tetap dilakukan mesin analisis. Respons menyertakan `strategies[].explanation` bila AI berhasil. Tanpa key, saat kuota lima panggilan per menit per proses tercapai, atau saat AI gagal/lebih dari 25 detik, field ini tidak disertakan dan frontend menampilkan penjelasan dasar. Format JSON mengikuti [dokumentasi OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat), lalu divalidasi oleh backend.
Bagian fondasi/rencana awal
di bawah adalah catatan historis; gunakan handover dan root tasks untuk progres kini.

Acuan: PRD bagian 7 dan 12.4, serta `architecture.md`. FastAPI berjalan sebagai satu aplikasi monolit. Kode backend Node/TypeScript lama telah dihapus; integrasi frontend ke endpoint baru belum lengkap.

## Menjalankan di WSL/Linux

Dari root repo, sekali untuk menyiapkan Python environment:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-dev.lock.txt
```

Lalu dari folder backend:

`requirements-dev.lock.txt` merekam versi dependensi; fondasi diuji pada Python 3.13 dan perubahan service POWER diuji di WSL Python 3.11. `requirements.txt` berisi dependensi runtime dan `requirements-dev.txt` menambahkan dependensi pengujian; perbarui lock secara sengaja saat mengganti dependensi.

```bash
cd backend
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Buka http://127.0.0.1:8000/docs untuk mencoba health check. `GET /api/v1/health` menghasilkan `{"status":"ok"}` tanpa memanggil layanan luar. Health hanya menyatakan proses hidup, bukan integrasi data siap.

Alternatif dari root repo: `npm run dev:backend` menjalankan Python dari `.venv` dengan reload; `npm run start:backend` tanpa reload. Keduanya menjalankan Uvicorn lokal, bukan Docker. `npm run dev` hanya menjalankan frontend dan watcher shared.

Docker Compose hanya untuk PostgreSQL: jalankan `docker compose up -d --wait db` dari root setelah mengatur password di root `.env`. Health check FastAPI saat ini tidak membutuhkan koneksi database.

Untuk menjalankan tes, dari folder backend:

```bash
.venv/bin/python -m pytest -q
```

Environment `ALLOWED_ORIGINS` bersifat opsional, daftar origin dipisahkan koma bila frontend mengakses FastAPI langsung. Contoh: `export ALLOWED_ORIGINS="http://localhost:3000"`. Melalui proxy Next.js tidak memerlukan CORS lintas origin.

## Catatan historis fondasi (tahap 1)

- Selesai: aplikasi FastAPI, router `/api/v1`, health check, dokumentasi OpenAPI, schema empat input, validasi dengan status HTTP 400, pengujian kontrak.
- Verifikasi tahap 1: 27 tes lulus; health dan dokumentasi juga diperiksa pada server Uvicorn nyata. Ada peringatan deprecation dari TestClient Starlette/httpx, tanpa kegagalan tes.
- Schema menerima GeoJSON Polygon dengan koordinat global. Peringatan wilayah Grobogan nanti dihasilkan pipeline, bukan penolakan input.
- Daftar crop ID pada schema mengikuti cakupan PRD; belum merupakan tabel agronomi yang terverifikasi.
- Belum dibuat: `/crops`, `/geocode`, `/analyze`, pengambilan data, cache, statistik, aturan rotasi, dan agent.
- `/analyze` sengaja belum terdaftar. Tidak ada data buatan yang dikembalikan sebagai hasil analisis nyata.
- Backend Node lama (`src/`, `package.json`, `tsconfig.json`) telah dihapus. `npm run dev` tidak menjalankan Python; gunakan perintah Uvicorn di atas untuk menjalankannya secara lokal. Pencarian lokasi lama di frontend belum memiliki endpoint pengganti di FastAPI.

## Rencana awal pengembangan (historis)

1. Fondasi: health, schema dan validasi (tahap ini). BE-01 sebagian.
2. Kontrak hasil/fixture yang jelas berlabel data uji; kurasi awal tabel tanaman, `/crops`, lalu pencarian lokasi. BE-02, BE-12 awal, BE-04 sebagian, BE-08 sebagian.
3. Pengambil NASA POWER dan cache; baru SoilGrids dengan hasil parsial. BE-03 dan BE-04.
4. Statistik bulanan dan jendela historis berurutan, diuji memakai data buatan. BE-05.
5. Kurasi pola lengkap, kalender, aturan K1–K5, dimensi, pemilihan strategi dan narasi. BE-06, BE-07, BE-12.
6. Rakit `/analyze`, validasi hujan/manual, fallback, integrasi frontend dan agent, migrasi runner, deployment. BE-08 sampai BE-11, BE-13, BE-14.

Kurasi agronomi dimulai sebelum mesin rotasi; nilai yang belum diverifikasi tidak boleh menjadi keputusan produksi. Tiap tahap harus punya contoh input/output atau pemeriksaan nyata sebelum dilanjutkan. Daftar ini tidak menyatakan semua BE-01 selesai: migrasi runner dan kontrak respons masih menyusul.


## Kontrak API (BE-02)

Schema request/response analisis, tanaman, pencarian, galat, dan chat tersedia.
Detail pemetaan ke PRD, keputusan serialisasi, JSON Schema, dan fixture FE ada
di [contracts/README.md](contracts/README.md). Fixture analisis adalah data uji sintetis; fixture tanaman mengikuti katalog bersumber. Endpoint yang belum diimplementasikan tetap tidak terdaftar.


## Perubahan lokasi menjadi Polygon

Sesuai instruksi pengguna, lokasi analisis sekarang berupa geometry GeoJSON
Polygon. Bentuk titik lama ditolak, termasuk pada konteks chat dan input skenario.
Lihat [contracts/location-polygon.md](contracts/location-polygon.md) untuk contoh
payload, dependensi baru, validasi, serta metode pengambilan data area yang belum
ditetapkan. Dokumen PRD tidak diedit; pengecualian dicatat hanya di backend.


## NASA POWER untuk polygon (BE-03)

Service pengambilan data harian dan penggabungan semua sel beririsan tersedia.
Pengunduh cakupan Indonesia berjalan terpisah dari aplikasi; raw cache dan
hasil data nyata tidak masuk Git. Metode, satuan, script resume, progres,
serta batas tahap ini dijelaskan di [contracts/power-data.md](contracts/power-data.md).


## Paket cache untuk tim dan deployment

Daftar paket lokal, checksum, tujuan ekstrak, serta status upload dilacak di
[cache-archives/README.md](cache-archives/README.md) dan manifest pendamping.
File ZIP dalam folder itu diabaikan Git dan dibagikan melalui penyimpanan file.


## SoilGrids untuk polygon

Service tanah menyediakan pH, SOC, tekstur USDA, dan ringkasan ketidakpastian
untuk kedalaman 0-30 cm, memakai seluruh pixel native yang beririsan dengan
polygon. Akses memakai WebDAV/VRT resmi agar NoData tetap terjaga. Cache kosong
atau data tidak lengkap menghasilkan penilaian parsial/K3 dilewati.
Metode dan script sampel: [contracts/soilgrids-data.md](contracts/soilgrids-data.md).
Ini bagian SoilGrids BE-04.


## Pencarian lokasi (geocode)

`GET /api/v1/geocode?q=Purwodadi` sudah tersedia di `/docs`. Respons mengikuti
kontrak FE, dengan cache, pembatas bersama 1 request/detik, dan galat 400/429/502.
[contracts/geocode.md](contracts/geocode.md) menjelaskan konfigurasi wilayah,
ketentuan Nominatim, dan integrasi FE yang masih perlu dilakukan: API_URL ke
port FastAPI serta atribusi OpenStreetMap yang terlihat. Frontend tidak diubah.


## Statistik iklim (BE-05)

Profil 12 bulan, kelengkapan data, kelas bulan Oldeman, dan jendela historis
berurutan tersedia melalui service internal. Memakai arsip harian yang sudah
ada, dengan cache hasil dan pemeriksaan checksum sumber. Demo tanpa jaringan:

```bash
.venv/bin/python scripts/test_climate_sample.py
```

Rincian aturan hitung dan batas tahap ini ada di
[contracts/climate-statistics.md](contracts/climate-statistics.md).


## Analisis rotasi (BE-06, BE-07, BE-09)

`POST /api/v1/analyze` menerima empat input dan `lang`, lalu mengembalikan
konteks iklim dan tanah, pola biasa serta alternatif, catatan, dan provenance
sesuai kontrak PRD 7. Iklim dan tanah diambil bersamaan dengan batas 15 detik
untuk POWER dan 8 detik untuk SoilGrids. Tanah yang gagal atau terlambat
menjadi penilaian parsial (HTTP 200). Iklim tanpa cache menghasilkan HTTP 502.

Mesin murni ada di `app/core/` (`rotation`, `feasibility`, `dimensions`,
`selector`, `explain`). Orkestrator `app/services/analysis.py` dipakai endpoint
dan nanti tool skenario agent, tanpa request HTTP ke server sendiri.
Keputusan implementasi dan ambang ada di
[contracts/rotation-engine.md](contracts/rotation-engine.md).

Coba dari folder backend setelah arsip POWER diekstrak dan server berjalan:

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/analyze \
  -H 'Content-Type: application/json' \
  -d @contracts/fixtures/analyze_request.json
```

Bulan mulai pada fixture harus masih dalam jendela bulan berjalan WIB sampai
11 bulan ke depan. Ubah `time.start_month` bila fixture sudah lewat.


## Katalog tanaman (BE-12 versi awal dan bagian BE-08)

`GET /api/v1/crops?lang=id` atau `?lang=en` sudah tersedia di Swagger.
Katalog berisi lima tanaman dan bera, delapan kandidat bersumber (empat berupa
pemetaan pola lokal) dan dua draft nonaktif. Ini data untuk BE-06, belum
penilaian/rekomendasi. Periksa dengan `.venv/bin/python scripts/check_catalog.py`.
Sumber per field, proxy kebutuhan air, dan batas bukti dijelaskan di
[contracts/crop-data.md](contracts/crop-data.md).
# Akun dan lahan tersimpan (Neon)

1. Buat project di Neon, lalu salin **pooled connection string** dari menu **Connect** ke `DATABASE_URL` di `backend/.env`. Pertahankan `sslmode=require` dan parameter keamanan yang diberikan Neon. Connection string hanya untuk backend, jangan gunakan variabel `NEXT_PUBLIC_*`.
2. Install dependensi backend: `uv pip install --python backend/.venv/bin/python -r backend/requirements-dev.lock.txt`.
3. Dari root repository jalankan `npm run db:migrate`. Alternatif: jalankan isi `backend/migrations/001_accounts_fields.sql` lewat SQL Editor Neon. Migrasi awal ini dapat dijalankan ulang.
4. Gunakan `COOKIE_SECURE=false` untuk HTTP lokal; pada deployment HTTPS gunakan `COOKIE_SECURE=true` (default). Restart backend setelah mengubah environment.
5. Buka aplikasi: halaman awal mengarah ke `/login` untuk login/daftar. Setelah masuk, `/akun` (**Lahan saya**) menampilkan lahan tersimpan dan tombol **Buat lahan baru** untuk membuka peta. Pada halaman hasil, isi nama dan pilih **Simpan lahan**. Akun hanya dapat membaca dan menghapus lahannya sendiri. Tautan rencana yang sudah berisi parameter tetap membuka peta atau hasil secara langsung; halaman login awal bukan pembatas akses analisis tamu.

Top navbar bersifat global di semua halaman. Setelah login, sidebar **Lahan saya**, **Tambah lahan**, dan **Keluar** tetap tersedia pada dashboard `/akun`, detail/hasil lahan, serta formulir peta dan rencana; di ponsel gunakan tombol **Menu** di navbar. Logout dari halaman mana pun menghapus sesi dan kembali ke `/login`. Kartu dashboard menampilkan batas asli, luas, koordinat tengah, sumber air dan periode rencana. Setelah menyimpan dari halaman hasil, aplikasi kembali ke dashboard. Membuka lahan tersimpan membawa ID lahan melalui pengeditan batas/rencana/bahasa; **Simpan perubahan** memperbarui lahan tersebut tanpa membuat duplikat. Endpoint `GET /fields/{id}` dan `PUT /fields/{id}` memeriksa pemilik akun, sama seperti penghapusan.

Yang disimpan: batas polygon, nama lahan, pola tanam, sumber air, periode dan bahasa. Hasil analisis tidak disimpan. Membuka lahan memanggil `/analyze` lagi menggunakan layanan analisis dan cache data lingkungan yang sudah ada. Bulan tanam yang sudah lewat digeser ke bulan berjalan (WIB).

Sesi memakai cookie HttpOnly selama 30 hari dengan token acak yang hash-nya disimpan di database. Keluar menghapus sesi. Password memakai scrypt dengan salt acak; username disamakan menjadi huruf kecil, 3–32 huruf/angka/garis bawah; password 8–128 karakter. Belum ada pemulihan password. Endpoint akun dan perubahan lahan memerlukan header `X-Field-Request: 1` untuk mencegah permintaan lintas situs. Akses melalui proxy `/api` di frontend; header ini sengaja tidak diizinkan oleh CORS backend.

Tanpa `DATABASE_URL`, peta dan analisis tetap bekerja; fitur akun/lahan mengembalikan 503. Jika database belum dimigrasikan atau tidak terjangkau, pengguna mendapat pesan penyimpanan tidak tersedia.

Uji integrasi PostgreSQL: set `TEST_DATABASE_URL` ke database pengujian, lalu jalankan `cd backend && .venv/bin/python -m pytest tests/test_accounts.py`. Tes membuat schema terisolasi dan menghapus schema tersebut sesudah selesai. Jangan gunakan Neon production untuk pengujian.

Referensi: [koneksi Neon](https://neon.com/docs/connect/connect-from-any-app), [driver Psycopg](https://www.psycopg.org/psycopg3/docs/basic/install.html).


## Ask AI untuk lahan milik pengguna

Chat menyediakan `list_saved_fields` (pencarian nama, 20 lahan per halaman) dan `inspect_saved_field` (rencana tersimpan, tahap menurut kalender asli, luas, sumber air, serta analisis iklim/tanah). Setiap operasi memeriksa cookie sesi dan kepemilikan lahan di PostgreSQL. ID aktif dari `field_id` hanya petunjuk; ID lahan akun lain tetap tidak bisa dibaca. Tidak ada tool mengubah atau menghapus data.

Analisis memakai `AnalysisService` langsung, tanpa memanggil endpoint atau LLM penjelasan kedua. Bulan lama digeser hanya untuk evaluasi baru; kalender asli tetap dipakai menjawab perkembangan menurut rencana. Belum ada pengamatan pertumbuhan nyata, foto, sensor, atau cuaca langsung. Kegagalan iklim tetap menyisakan informasi rencana; kegagalan database dibedakan dari daftar lahan kosong. Maksimal tiga putaran tool dan total 55 detik; frontend menunggu sampai 60 detik. Nama lahan dan hasil tool tidak boleh mengubah aturan asisten.

Tes `tests/test_agent_fields.py` mencakup alur tool ke jawaban, akses antar-akun, sesi kedaluwarsa, pencarian/paginasi, rencana lama, dan kegagalan layanan. Set `TEST_DATABASE_URL` ke PostgreSQL lokal/pengujian untuk menjalankan tes kepemilikan dengan schema sementara terisolasi.
