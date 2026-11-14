# Handover backend Field Shift

Tanggal pemeriksaan: 14 November 2026. Branch serah terima: **`crop-data`**.
Basis implementasi: **`13ea2d5`**. Dokumen ini dan pembaruan tasks ditambahkan
setelah commit implementasi itu. Jangan mulai dari `main` yang belum memuat
seluruh rantai perubahan backend. Pemilik repo yang melakukan push/merge.

## Ringkasan untuk penerus

Backend sudah dapat mengambil/membaca data lingkungan untuk polygon,
menggabungkan data harian per area, menghitung statistik bulanan dan jendela
historis, serta menyediakan katalog tanaman dan pencarian lokasi. **Belum ada
pengambilan keputusan, rekomendasi rotasi, endpoint analisis, atau agent aktif.**

Lanjutkan **BE-06** dari branch ini, misalnya branch `rotation-engine`.
Jangan mengulang unduhan Indonesia atau agregasi bulanan yang sudah tersedia.
Gunakan katalog bersumber dan fungsi/service yang ada sebagai masukan mesin.

## Batas perubahan yang disepakati

- PRD tetap acuan utama; jangan mengedit PRD atau mengubah rumus/ambang/cakupan
  tanpa arahan pemilik. Dokumen backend hanya mencatat keputusan implementasi.
- Pengecualian yang disetujui: lokasi analisis berupa **GeoJSON Polygon**, bukan
  titik tunggal. Semua grid/pixel yang beririsan dipakai dengan bobot luas irisan.
  Koordinat GeoJSON berurutan `[longitude, latitude]` dan ring ditutup.
- Pengerjaan backend berikutnya tetap di `backend/`. Pembaruan root `tasks.md`
  kali ini secara khusus diminta pemilik untuk serah terima.
- Jangan mengubah frontend, mengarang nilai tanah/air, memakai fixture sebagai
  hasil analisis nyata, atau menyimpan ZIP/raw cache/kunci API di Git.
- Rekomendasi nantinya tetap estimasi berbasis pola historis, bukan prakiraan
  cuaca masa depan. Jangan mengganti aturan PRD dengan penilaian buatan agent.

## Status pekerjaan

| Task | Status dan bukti |
| --- | --- |
| BE-01 | Selesai: FastAPI, Pydantic, validasi 400, router/health/OpenAPI |
| BE-02 | Kontrak, JSON Schema dan fixture tersedia; sinkronisasi integrasi tim tetap diperlukan |
| BE-03 | Selesai: POWER harian, arsip/cache, normalisasi/satuan, bobot grid polygon |
| BE-04 | Selesai: SoilGrids polygon/depth/satuan/tekstur/ketidakpastian/fallback + Nominatim |
| BE-05 | Selesai: profil bulanan, kualitas data, kelas bulan dan jendela historis |
| BE-06 | Belum: kalender, K1–K5, dimensi dan pemilihan alternatif; prioritas berikutnya |
| BE-07 | Belum: narasi agronomi lengkap dan respons analisis |
| BE-08 | Sebagian: route crops/geocode selesai; dua lokasi demo final/cache dan pembanding hujan belum |
| BE-09 | Belum: orkestrator bersama untuk endpoint analisis dan tool agent |
| BE-10 | Belum: tes mesin/end-to-end; tes service yang sudah ada tidak menggantikan ini |
| BE-11 | Belum lengkap: deployment, integrasi proxy/agent dan pemeriksaan produksi |
| BE-12 | Versi awal selesai: 6 entri, 8 kandidat bersumber, 2 draft nonaktif; batas bukti di bawah |
| BE-13 | Belum: validasi POWER terhadap CHIRPS/IMERG/BMKG dan pemilihan dua lokasi demo final |
| BE-14 | Sebagian: dua agregat bulan dicek raw; cek air satu tahap, review rekan dan narasi belum |
| BE-15 | Akun username/password, sesi dan lahan per pengguna tersedia; migrasi PostgreSQL/Neon siap. Project Neon dan DATABASE_URL produksi belum tersedia. Health tetap liveness tanpa database. |

Checkbox FE/AI pada tasks tidak diperiksa ulang dalam handover ini.

## Mengambil kode dan menjalankan

Repo lokal pemilik di WSL: `/home/nau/lomba/nasa/nasa-hacktahon`.
Penerus menggunakan path clone miliknya sendiri. Setelah branch dipush pemilik:

```bash
git fetch origin
git switch --track origin/crop-data  # untuk clone yang belum punya branch lokal ini
# Jika branch lokal sudah ada: git switch crop-data, lalu periksa perbedaannya.
# Untuk mulai pekerjaan selanjutnya, dari crop-data yang sudah benar:
git switch -c rotation-engine
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-dev.lock.txt
cd backend
.venv/bin/python -m pytest -q
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

WSL terakhir memakai Python 3.11. Jangan menyalin `.venv` antar mesin.
Buka `http://localhost:8000/docs`. Startup tidak memerlukan unduhan data atau
API key. Backend `.env.example` adalah referensi; Uvicorn tidak otomatis memuat
file `.env`. Export variabel di shell bila diperlukan. Detail: [README](README.md).

| Route | Status |
| --- | --- |
| GET `/api/v1/health` | Aktif; liveness, bukan kesiapan seluruh data/database |
| GET `/api/v1/crops?lang=id` / `lang=en` | Aktif, 6 opsi lokal tanpa jaringan |
| GET `/api/v1/geocode?q=Purwodadi` | Aktif, cache + Nominatim bila perlu |
| POST `/api/v1/analyze` | Belum dipasang; 404 memang disengaja |
| POST `/api/v1/agent/chat` | Chat umum OpenAI GPT-6 Luna; konteks analisis/tool belum terhubung; perlu `AI_API_KEY` OpenAI |

Pencarian Nominatim dilakukan saat submit, bukan autocomplete. Cache 7 hari,
pembatas bersama 1 request/detik serta fallback stale sudah ada. Pembatas berbasis
file memerlukan penyimpanan bersama jika deployment memakai beberapa worker/instance.
Bounding box pencarian Grobogan adalah persegi cakupan, bukan uji batas administratif.
Konfigurasi dan kewajiban atribusi: [geocode.md](contracts/geocode.md).

## Cache yang harus ikut dipindahkan secara terpisah

**Clone Git tidak membawa dua ZIP ini.** Keduanya ada di mesin pemilik pada
`backend/cache-archives/`. Registry menyatakan belum diunggah dan belum ada URL
publik; minta salinan dari pemilik atau unggah ke penyimpanan bersama lalu isi
manifest dengan URL nyata yang tidak rahasia.

| ZIP | Ukuran | Cakupan | Ekstrak ke |
| --- | --- | --- | --- |
| `nasa-power-indonesia-2016-2025-cache.zip` | 116.641.078 byte (~117 MB) | 600 NetCDF + 600 metadata, 6 variabel, 2016–2025, bbox sekitar Indonesia | `backend/data/power/` |
| `soilgrids-grobogan-samples-v1.zip` | 80.605 byte (~81 KB) | 45 subset GeoTIFF + 45 metadata, 3 polygon uji kecil, 0–30 cm | `backend/data/soilgrids/` |

POWER mencakup kotak Indonesia termasuk laut/sebagian negara tetangga, bukan
mask batas negara. SoilGrids **bukan** seluruh Indonesia/Grobogan. Tiga sampel
sementara bukan lahan survei atau dua lokasi demo yang telah disetujui tim.

Dari root repo, setelah kedua ZIP diletakkan di `backend/cache-archives/`:

```bash
(cd backend/cache-archives && sha256sum -c checksums.sha256)
unzip backend/cache-archives/nasa-power-indonesia-2016-2025-cache.zip -d backend/data/power
unzip backend/cache-archives/soilgrids-grobogan-samples-v1.zip -d backend/data/soilgrids
cd backend
.venv/bin/python scripts/test_power_sample.py
.venv/bin/python scripts/test_soil_samples.py
.venv/bin/python scripts/test_climate_sample.py
.venv/bin/python scripts/check_catalog.py
```

Demo POWER/tanah/iklim tersebut membaca cache lokal. Tes pytest dan API crops
tetap bisa dijalankan tanpa ZIP. Geocode live memerlukan jaringan bila cache kosong.
Hasil iklim turunan dalam `data/power/results/` dapat dibuat ulang; tidak perlu
ZIP tambahan. Jangan upload log, lock, `.venv` atau file sementara. Persiapan cache
deployment butuh penyimpanan persisten; belum ada pipeline upload/deploy otomatis.
`CACHE_DIR` pada konfigurasi saat ini mengatur geocode, jangan mengasumsikan ia
otomatis memindahkan seluruh raw POWER/SoilGrids.
Panduan/manifest/checksum: [cache-archives](cache-archives/README.md).

## Peta kode dan alur yang sudah tersedia

```text
GeoJSON Polygon
  -> services/power.py + power_archive.py + core/power_grid.py
  -> data harian berbobot luas irisan
  -> core/climate.py (murni) + services/climate.py (cache/orchestrasi data)
  -> profil bulanan + monthly_by_year + historical_windows + quality/provenance

GeoJSON Polygon
  -> services/soil.py + soil_archive.py + core/soil.py
  -> pH/SOC/tekstur/ketidakpastian 0–30 cm atau unavailable

data/catalog/*.json -> app/catalog.py -> opsi crops + kandidat bersumber

Tiga keluaran ini belum dirakit menjadi keputusan/rekomendasi.
```

- `app/schemas.py`, `contracts/schemas/`, `contracts/fixtures/`: kontrak publik.
  Fixture analisis sintetis; fixture crops mengikuti katalog. Ekspor ulang schema
  dengan `scripts/export_contracts.py` hanya bila model kontrak berubah.
- `app/core/`: perhitungan murni. Jaringan/filesystem ada di service/adaptor.
- `app/services/climate.py`: `ClimateService().for_polygon(location,
  start_month="2026-11", horizon_months=12, lang="id", allow_network=False)`.
  Untuk pemakaian nyata gunakan waktu yang lolos schema; contoh bulan di atas
  adalah contoh snapshot, bukan tanggal valid selamanya.
- `app/catalog.py`: `load_catalog()`, `.crop_options(lang)`, `.candidate_rotations()`.
  Kandidat bukan strategi yang sudah lolos aturan. Versi mencakup fingerprint isi.
- Referensi metode: [polygon](contracts/location-polygon.md),
  [POWER](contracts/power-data.md), [SoilGrids](contracts/soilgrids-data.md),
  [iklim](contracts/climate-statistics.md), [katalog](contracts/crop-data.md).

## Detail yang tidak boleh hilang saat melanjutkan

1. **Kelengkapan iklim:** lebih dari 3 hari hilang membuat bulan-variabel tidak
   sah. Hingga 3 hari hilang memakai observasi tersedia, tanpa imputasi/scaling.
   Profil publik memakai himpunan tahun sah bersama keenam variabel karena
   kontrak memiliki satu `n_years`. Kurang dari 8 tahun diberi tanda terbatas.
2. **Agregasi:** hujan dijumlahkan; suhu/radiasi/RH dirata-ratakan per bulan-tahun.
   Profil musiman memakai statistik antar-tahun sesuai dokumen iklim. Kelas bulan:
   basah >200 mm, lembap 100–200 inklusif, kering <100 mm.
3. **Jendela historis:** pakai urutan tahun-bulan nyata. Jangan merangkai median
   bulan dari tahun berbeda. November/12 bulan pada 2016–2025 memberi 9 jendela
   kalender lengkap; November/24 memberi 8. Jendela invalid tetap diaudit dan
   tidak boleh dihitung sebagai jendela sah untuk kecukupan air.
4. **Tanah:** seluruh pixel beririsan dan pembobotan kedalaman 0–30 cm; data tidak
   lengkap menghasilkan unavailable/parsial dan K3 dilewati. Ringkasan quantile
   berbobot bukan interval gabungan probabilistik 90%. SOC bukan stok karbon/NPK.
5. **Katalog:** 8 kandidat terdiri atas 4 urutan dilaporkan dan 4 pemetaan pola
   palawija/tumpangsari ke satu tanaman per tahap MVP. Jangan menyebut semuanya
   pola monokultur yang diobservasi langsung atau kalender tahunan terjamin.
   Dua draft orok-orok tidak boleh ikut mesin. Aturan larangan urutan belum ada;
   jangan membuat larangan umum satu famili yang akan membuang padi-padi.
6. **Air:** kacang hijau memakai proxy bean FAO (ditandai); air orok-orok null,
   dikecualikan K5 dan harus diberi risiko sesuai PRD. Null bukan nol kebutuhan.
   Bera nol karena tidak ada tanaman. Air musiman tidak disamakan hujan tahunan.
7. **Validasi hujan:** status masih unvalidated. Cek aritmetika raw bukan validasi
   CHIRPS/IMERG/stasiun. BE-13 harus dilaporkan tersendiri; data tidak dikarang.
8. **Periode/cache:** arsip snapshot 2016–2025; ketika tahun referensi lengkap
   berubah perlu melengkapi arsip. Jangan diam-diam memakai periode lama sebagai
   sepuluh tahun terakhir. SoilGrids bukan dataset yang harus diunduh harian.

## Rencana lanjut BE-06

1. Baca PRD bagian 9–11, kontrak analisis dan catatan katalog/iklim terlebih dulu.
2. Buat kalender pembanding dan kandidat dari slot PRD. Tangani pengulangan,
   horizon, pergantian tahun, bera dan tahap terakhir melewati horizon sesuai PRD.
3. Implementasikan K1–K5 sebagai fungsi deterministik. Input memakai data yang
   sudah ada; jangan membuat ulang pengambil data di core.
4. Hitung lima dimensi sesuai PRD dan pilih alternatif berbeda. Pola biasa
   pengguna tetap tampil meski gagal; kandidat alternatif harus lolos.
   Tangani kandidat kurang dengan penjelasan, tanpa memaksa tiga kartu palsu.
5. Uji batas suhu/pH/air, tadah hujan vs irigasi, tanah hilang, orok-orok/bera,
   jendela invalid, baseline gagal dan pilihan alternatif tidak lengkap.
6. Setelah core stabil, lanjut BE-07/09 untuk narasi dan orkestrasi `/analyze`.
   Orkestrator yang sama dipakai tool agent tanpa HTTP ke server sendiri.

BE-13 (lokasi demo + pembanding hujan) masih diperlukan sebelum klaim demo
tervalidasi. BE-14 perlu contoh kecukupan air satu tahap dan review rekan tim.
Frontend perlu memastikan `API_URL` proxy menuju FastAPI port 8000 dan atribusi
OpenStreetMap terlihat; jangan menganggap route aktif berarti integrasi FE selesai.

## Verifikasi serah terima

- Tes ulang pada branch ini: **210 passed**, 14 November 2026, sekitar 7 detik.
- Satu peringatan deprecation Starlette TestClient/httpx; tidak ada kegagalan tes.
- Lint file Python baru/diubah pada implementasi katalog sudah lulus.
- Dua ZIP ditemukan lokal dengan ukuran sesuai registry; belum diunggah menurut manifest.
- Angka smoke/manual sebelumnya: Januari 2016 237,369998 mm, Februari 2016
  369,970000 mm, cocok penjumlahan harian NetCDF polygon contoh. Belum direview
  Orang 1 dan bukan validasi dataset pembanding. Rincian ada di dokumen iklim.
- Dokumen handover ini tidak mengklaim deployment, integrasi FE/AI atau BE-06 selesai.
