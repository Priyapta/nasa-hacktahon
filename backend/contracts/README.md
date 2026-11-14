# Kontrak backend BE-02

PRD bagian 7, 7.1, 8.2, 9, 10, 11, dan 12.4 adalah acuan utama.
Dokumen ini melengkapi detail serialisasi. **Pengecualian yang disetujui pengguna:**
lokasi sekarang berupa Polygon, bukan titik PRD. Lihat
[location-polygon.md](location-polygon.md) untuk bentuk, validasi, dan batasannya.
Aturan PRD lainnya tetap berlaku.
`architecture.md` dipakai hanya untuk detail yang konsisten dengan PRD.
Schema Python ada di `app/schemas.py`; JSON Schema yang diekspor ada di `schemas/`.
Tidak ada perubahan dokumen PRD.

## Status dan pemakaian oleh frontend / agent

Kontrak sudah tersedia. Endpoint pencarian `/api/v1/geocode` kini sudah
diimplementasikan; lihat [geocode.md](geocode.md). Endpoint tanaman /api/v1/crops
juga tersedia; lihat [crop-data.md](crop-data.md). Mesin rotasi BE-06 dijelaskan di [rotation-engine.md](rotation-engine.md). `POST /api/v1/analyze` aktif sejak BE-09. Endpoint chat belum diimplementasikan. `/docs` hanya menampilkan route yang benar-benar aktif.
Fixture dibaca oleh pengembangan/test frontend, bukan oleh route aplikasi atau
pipeline produksi. Penyelesaian BE-02 tidak menyelesaikan BE-03 atau BE-08.

Dari folder backend:

```bash
.venv/bin/python scripts/export_contracts.py
.venv/bin/python -m pytest -q
```

Ekspor ulang schema ketika model berubah. Schema statis tidak dapat mengecek
seluruh aturan lintas-field atau batas bulan yang bergantung waktu. Contohnya,
`months` hanya boleh dikirim untuk bera; validasi server tetap menjadi acuan.
Validasi waktu server memakai bulan berjalan
WIB sampai 11 bulan ke depan. Fixture request memakai November 2026 dan clock
tes dibekukan; fixture bukan payload yang valid selamanya.

## Yang sudah ditentukan PRD dan tetap dipertahankan

- Lima endpoint dengan prefix `/api/v1` (bagian 12.4).
- Input `/analyze`, batas rotasi/waktu/sumber air, dan default `lang=id` (bagian 7).
  Bentuk lokasi menggunakan pengecualian polygon yang dijelaskan di atas.
- Respons `/analyze`: `context`, `strategies`, `notes`, `provenance`, termasuk
  nama field bersarang, empat role strategi, dan lima dimensi (bagian 7).
- `level` selalu `rendah`, `sedang`, atau `tinggi`; tidak diganti angka/skor/null.
- `notes`, `reasons`, `tradeoffs`, dan `risks` tetap daftar string.
- Pola biasa tetap tampil walau gagal. Alternatif harus lolos; jumlah boleh
  kurang dengan penjelasan. Tanpa pola, tidak ada pembanding (bagian 10-11).
- Respons tanah gagal tetap HTTP 200, `status=unavailable`, K3 dilewati,
  dan penilaian parsial dijelaskan dalam `notes` (bagian 7, 8.2, 11).
- Chat mengikuti bagian 7.1: JSON biasa, maksimal 10 pesan riwayat,
  pesan 1-2.000 karakter setelah trim, tanpa sesi server/streaming.
- `analysis_input` chat tidak memuat `lang`; bahasa ada di request chat.
  `scenario.input` berisi input analisis lengkap termasuk `lang`.

## Detail teknis pelengkap

| Bagian | Bentuk yang digunakan | Dasar |
| --- | --- | --- |
| `/crops` | `{ "crops": [{ "crop_id", "nama", "peran", "slot_bulan" }] }` | Empat isi wajib dari PRD 12.4; pembungkus/nama JSON dilengkapi di BE-02 |
| `peran` tanaman | Daftar string karena satu tanaman dapat punya beberapa peran; label mengikuti bahasa | PRD 8.3 mencantumkan produksi, pakan, pupuk hijau, penutup tanah; daftar bukan enum agronomi baru |
| Bera | `slot_bulan=null`; pemilihan durasinya tetap 1-6 bulan pada input | PRD 7; rincian bentuk dari architecture.md |
| `/geocode` | `{ "results": [{ "id", "name", "center": [lon, lat], "zoom" }] }`; kosong: `results=[]` | Mempertahankan bentuk komponen peta pada architecture.md |
| Query pencarian | `q` string, di-trim dan tidak boleh kosong | Detail validasi teknis; batas layanan tetap sesuai PRD |
| Waktu pengambilan | `fetched_at` string ISO 8601 dengan zona, contoh `2026-11-14T06:00:00Z` | Format field yang belum dirinci PRD |
| Kalender | `start`/`end` format `YYYY-MM`, keduanya inklusif; flag kelanjutan dari PRD | Memperjelas representasi slot bulanan |
| ID strategi | `baseline` untuk pola biasa pada fixture; alternatif memakai ID pola yang stabil dari kurasi | Contoh PRD memakai baseline; tidak menambah role |
| Galat | `{ "detail": [{ "loc": ["body", "time", "horizon_months"], "msg": "..." }] }` | architecture.md dan handler validasi yang sudah ada |
| Galat non-field | Bentuk sama, `loc=[]` | Pelengkap format; kode HTTP tetap dari PRD |

Respons sukses tidak dibungkus ulang dengan field `data`, `success`, atau metadata
baru. Nilai enum/ID tidak diterjemahkan; label dan narasi mengikuti `lang`.
FE tidak menghitung ulang statistik, kalender, kelayakan, atau dimensi.

### Nilai tidak tersedia

Field respons tetap ada; angka yang tidak tersedia memakai `null`, bukan nol.
Untuk `soil.status=unavailable`: `texture_class`, `ph`, dan `soc_g_per_kg`
bernilai null; `depth` tetap `0-30cm`; `uncertainty={}`. `provenance.soil.fetched_at`
null jika tidak ada data tanah yang berhasil diperoleh. Ini memperinci kasus
gagal yang sudah diwajibkan PRD, bukan mengganti aturan kegagalannya.

Profil iklim tetap memuat masing-masing bulan 1-12. Statistik/class yang tidak
tersedia untuk suatu bulan memakai null; `n_years` berisi jumlah tahun sah,
termasuk nol. Kurang dari 8 tahun diberi catatan data terbatas sesuai PRD 9.
Status hujan belum divalidasi memakai `rain_validation.status="unvalidated"`
pada fixture, dengan `reference`, `annual_diff_pct`, dan `months_class_differs`
null. PRD belum memberi enum status validasi hujan, sehingga schema tidak
mengarang daftar status tertutup. Proses BE-03/BE-13 akan mengisinya dari hasil nyata.

### Ketidakpastian tanah

`uncertainty` adalah objek dengan key properti penyedia: `clay`, `sand`, `silt`,
`phh2o`, `soc`. Setiap properti yang tersedia memiliki `{ "q05": ..., "q95": ... }`,
sesuai kuantil Q0.05/Q0.95 yang diminta PRD 8.2. Properti yang tidak tersedia
tidak diberi angka buatan dan tidak dicantumkan. Field ini boleh kosong jika
kuantil tidak tersedia; keterbatasannya harus dijelaskan lewat `notes`.

Nilai sudah dalam satuan tampilan: clay/sand/silt persen, phh2o pH, soc g/kg.
Konversi dan agregasi kedalaman mengikuti PRD 8.2 dan akan diuji pada BE-04.
Rentang hasil pembobotan kuantil lapisan adalah ringkasan kuantil penyedia,
bukan klaim interval kepercayaan gabungan atau pengukuran langsung lahan.

### Satuan dan pekerjaan yang masih menunggu data nyata

Nama `rain_*_mm`, `t_*_c`, `rh_pct`, `soc_g_per_kg` tetap seperti PRD.
Tidak menambah field satuan. Nama dan satuan parameter `rad` tetap harus
diverifikasi saat menulis pengambil POWER, sesuai PRD 8.1 dan 16; angka rad
pada fixture hanyalah data uji, bukan keputusan satuan penyedia.
Durasi tanaman, ambang agronomi, dan sumber tidak ditetapkan BE-02; menunggu
kurasi BE-12. `slot_bulan` pada fixture tanaman bukan hasil kurasi.

## Fixture untuk FE

**Semua angka lingkungan, durasi tanaman, kalender, dan narasi adalah data
sintetis. Jangan dipakai untuk demonstrasi hasil ilmiah atau produksi.**
Peringatan ada di dokumen ini dan `notes` hasil analisis. Bentuk fixture tetap
sama dengan kontrak PRD, tanpa menambahkan flag fixture ke respons produksi.

| File (semua `.json` di `fixtures/`) | Pemakaian |
| --- | --- |
| `analyze_request`, `analyze_no_pattern_request` | Contoh input dengan/tanpa pola |
| `analyze_success` | Kartu pembanding dan dua alternatif |
| `analyze_no_pattern` | Tiga alternatif tanpa pembanding |
| `analyze_soil_unavailable` | Penilaian parsial; data tanah kosong |
| `analyze_baseline_failed` | Pembanding tetap muncul dengan K5 gagal |
| `analyze_fewer_candidates`, `analyze_no_candidates` | Kandidat kurang atau kosong |
| `analyze_limited_climate` | Satu bulan tanpa data sah |
| `analyze_invalid_request`, `error_validation` | Input salah dan bentuk galat 400 |
| `error_provider` | Contoh badan galat 502 |
| `crops` | Enam pilihan termasuk bera, slot sintetis |
| `geocode`, `geocode_empty` | Hasil pencarian dan hasil kosong |
| `chat_request`, `chat_general_request` | Input chat dengan/tanpa konteks |
| `chat_clarification`, `chat_answer`, `chat_scenario` | Klarifikasi, jawaban bersumber, skenario |
| `health` | Respons health yang sudah aktif |

Fixture hanya menguji bentuk data dan keadaan UI; bukan pembuktian perhitungan,
kurasi, maupun pemilihan strategi. Konten kalender contoh sengaja sederhana.

## Tanggung jawab implementasi berikutnya

Schema memeriksa bentuk dan konsistensi lokal (contoh jumlah tahun, enum,
role unik, alternatif tidak gagal, dan ID kutipan tersedia). Pipeline tetap
bertanggung jawab atas kebenaran angka, pemilihan alternatif berbeda, kecocokan
hasil dengan input, urutan kalender lengkap, penandaan horizon, templat dua
bahasa, dan kelengkapan provenance. Service agent harus memastikan sumber
benar-benar berasal dari backend; validasi schema saja tidak membuktikannya.
Tidak ada penyedia AI yang dihubungkan dalam BE-02.
