# Backend Field Shift — tahap 1

Acuan: PRD bagian 7 dan 12.4, serta `architecture.md`. FastAPI berjalan sebagai satu aplikasi monolit. Kode backend Node/TypeScript lama telah dihapus; integrasi frontend ke endpoint baru belum lengkap.

## Menjalankan di PowerShell

Dari root repo, sekali untuk menyiapkan Python environment:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.lock.txt
```

Lalu dari folder backend:

`requirements-dev.lock.txt` merekam versi yang sudah diuji (Python 3.13). `requirements.txt` berisi dependensi runtime dan `requirements-dev.txt` menambahkan dependensi pengujian; perbarui lock secara sengaja saat mengganti dependensi.

```powershell
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

Buka http://127.0.0.1:8000/docs untuk mencoba health check. `GET /api/v1/health` menghasilkan `{"status":"ok"}` tanpa memanggil layanan luar. Health hanya menyatakan proses hidup, bukan integrasi data siap.

Alternatif dari root repo: `npm run dev:backend` menjalankan Python dari `.venv` dengan reload; `npm run start:backend` tanpa reload. Keduanya menjalankan Uvicorn lokal, bukan Docker. `npm run dev` hanya menjalankan frontend dan watcher shared.

Docker Compose hanya untuk PostgreSQL: jalankan `docker compose up -d --wait db` dari root setelah mengatur password di root `.env`. Health check FastAPI saat ini tidak membutuhkan koneksi database.

Untuk menjalankan tes, dari folder backend:

```powershell
.venv/Scripts/python.exe -m pytest -q
```

Environment `ALLOWED_ORIGINS` bersifat opsional, daftar origin dipisahkan koma bila frontend mengakses FastAPI langsung. Contoh: `$env:ALLOWED_ORIGINS="http://localhost:3000"`. Melalui proxy Next.js tidak memerlukan CORS lintas origin.

## Status tahap ini

- Selesai: aplikasi FastAPI, router `/api/v1`, health check, dokumentasi OpenAPI, schema empat input, validasi dengan status HTTP 400, pengujian kontrak.
- Verifikasi tahap 1: 27 tes lulus; health dan dokumentasi juga diperiksa pada server Uvicorn nyata. Ada peringatan deprecation dari TestClient Starlette/httpx, tanpa kegagalan tes.
- Schema menerima koordinat global. Peringatan wilayah Grobogan nanti dihasilkan pipeline, bukan penolakan input.
- Daftar crop ID pada schema mengikuti cakupan PRD; belum merupakan tabel agronomi yang terverifikasi.
- Belum dibuat: `/crops`, `/geocode`, `/analyze`, pengambilan data, cache, statistik, aturan rotasi, dan agent.
- `/analyze` sengaja belum terdaftar. Tidak ada data buatan yang dikembalikan sebagai hasil analisis nyata.
- Backend Node lama (`src/`, `package.json`, `tsconfig.json`) telah dihapus. `npm run dev` tidak menjalankan Python; gunakan perintah Uvicorn di atas untuk menjalankannya secara lokal. Pencarian lokasi lama di frontend belum memiliki endpoint pengganti di FastAPI.

## Urutan berikutnya, dari kecil ke besar

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
di [contracts/README.md](contracts/README.md). Fixture adalah data uji sintetis,
bukan data produksi. Endpoint yang belum diimplementasikan tetap tidak terdaftar.
