# Pembagian tugas tim Field Shift

Acuan: [PRD](<PRD Field Shift Alat Bantu Rotasi Tanam Berbasis Data NASA.md>) dan [arsitektur](architecture.md), termasuk fitur agent AI.

Pembagian memakai label Orang 1–3 karena nama dan keahlian anggota belum ditentukan. Tempatkan anggota paling kuat di Python/perhitungan pada Orang 2. Setiap orang memegang pengujian dan perbaikan bagiannya sampai terintegrasi.

## 1. Pemilik pekerjaan

| Anggota | Tanggung jawab utama | Hasil yang diserahkan |
| --- | --- | --- |
| Orang 1 | Halaman, routing, dan UI Next.js selain chat, integrasi analisis, deploy frontend | Dua layar yang bisa digunakan di ponsel, empat input, hasil analisis, bahasa Indonesia/Inggris, dan tempat pemasangan panel agent |
| Orang 2 | FastAPI inti, data agronomi/lingkungan, mesin rule-based, deploy backend | Empat endpoint inti, dataset bersumber, validasi hujan, perhitungan deterministik, cache demo, dan pengujian mesin |
| Orang 3 | Agent AI dari backend sampai UI chat | Endpoint chat, integrasi LLM, dua tool, panel chat frontend, riwayat, sumber, skenario, dan pengujian agent |

Orang 2 memiliki seluruh aturan dan perhitungan agronomi. Orang 3 memakai hasilnya untuk penjelasan dan simulasi melalui tool; tidak membuat mesin rule-based sendiri. Orang 3 dapat mulai mengerjakan backend agent dan UI chat dengan fixture hasil analisis yang diberi label data uji, lalu menggantinya dengan pipeline nyata saat tersedia. Orang 1 menyediakan halaman tempat panel chat dipasang.

## 2. Orang 1: halaman dan routing frontend Next.js

- [ ] FE-01. Siapkan route `/` dan `/hasil`, tipe request/response, fungsi panggilan API, serta serialisasi empat input dan bahasa di URL sesuai kontrak.
- [ ] FE-02. Buat input lokasi di peta dan pencarian `/api/v1/geocode`. Pastikan urutan `[lon, lat]` hasil pencarian dipetakan ke `{ lat, lon }` dengan benar.
- [ ] FE-03. Buat penyusun rotasi maksimal enam tahap, durasi bera 1–6 bulan, pilihan "Belum punya pola", horizon, bulan mulai, dan sumber air. Daftar tanaman dibaca dari `/api/v1/crops`.
- [ ] FE-04. Buat hasil: ringkasan iklim/tanah, kalender, kartu strategi, lima dimensi, alasan, kompromi, risiko, dan panel asal data. Jumlah kartu mengikuti hasil backend, termasuk ketika alternatif tidak lengkap.
- [ ] FE-05. Hubungkan `/api/v1/analyze`; perubahan waktu/sumber air memperbarui URL dan menghitung ulang. Tangani memuat, galat, data tanah tidak tersedia, dan respons lama yang datang terlambat.
- [ ] FE-06. Tambahkan kamus Indonesia/Inggris dan tombol bahasa untuk halaman input/hasil. Kirim `lang` ke endpoint tanaman/analisis dan teruskan bahasa aktif ke komponen agent milik Orang 3.
- [ ] FE-07. Sepakati props panel chat dengan Orang 3 dan pasang komponennya pada kedua layar. Teruskan `lang` serta empat input aktif yang lengkap atau `null`. Logika, tampilan, dan panggilan API chat dikerjakan Orang 3.
- [ ] FE-08. Arahkan proxy Next.js ke FastAPI lewat `API_URL`, periksa alur pada layar 360 px dan navigasi keyboard, jalankan build serta tes frontend/proxy yang relevan, lalu deploy ke Vercel.
- [ ] FE-09. Ambil screenshot produk dan bantu menyusun tampilan tujuh slide dari naskah yang disepakati bersama tim. Uji alur dengan satu pengguna baru dan catat waktu penyelesaiannya.

**Area kerja:** `frontend/app/`, komponen input/hasil/peta, hook analisis, tipe dan API analisis, konfigurasi/env/frontend tests. `frontend/components/agent/`, `useAgentChat`, dan tipe/API chat dimiliki Orang 3. Paket shared TypeScript yang masih diperlukan tetap digunakan frontend.

**Selesai bila:** pengguna bisa mengisi empat input, membaca hasil nyata, mengganti waktu/sumber air, beralih bahasa, dan membuka panel agent buatan Orang 3 dari kedua layar. Penanggung jawab UI A-01–A-04, A-12, serta bagian halaman A-15; pemasangan panel pada A-16/A-19 diverifikasi bersama Orang 3. A-13 diuji bila waktu tersedia.

## 3. Orang 2: backend inti, data, dan mesin rule-based

Status diperiksa pada branch `crop-data`, implementasi sampai commit `13ea2d5`.
Handover teknis: [backend/HANDOVER.md](backend/HANDOVER.md). Checkbox penuh hanya
untuk lingkup task yang sudah tersedia; catatan membedakan hasil parsial dan batas bukti.
Status frontend/agent tidak diaudit pada pembaruan ini dan checkbox-nya tidak diubah.

- [x] BE-01. Migrasikan backend Node.js ke FastAPI. Siapkan schema Pydantic, router `/api/v1`, pemetaan galat validasi ke 400, konfigurasi, dependensi Python, dan `/api/v1/health`. **Status 14 November 2026:** Selesai di backend: FastAPI, schema, router, galat 400, konfigurasi/dependensi dan health. Integrasi deployment/runner lintas aplikasi tetap BE-11.
- [x] BE-02. Kunci kontrak analisis/tanaman/pencarian bersama Orang 1 dan kontrak pipeline/chat bersama Orang 3. Buat fixture JSON untuk frontend sebelum perhitungan selesai; fixture tidak dipakai sebagai data produksi. Implementasi kontrak BE-02: `backend/contracts/README.md`, schema Pydantic, ekspor JSON Schema, fixture sintetis FE/agent, dan tes kontrak.
- [x] BE-03. Implementasikan service NASA POWER: periode sepuluh tahun lengkap, normalisasi nilai hilang, satuan, metadata, cache, serta fallback cache saat layanan gagal. **Status 14 November 2026:** Selesai: arsip harian sepuluh tahun, normalisasi/satuan, metadata, semua sel beririsan polygon dengan bobot area, cache dan fallback. Arsip lokal 2016–2025 tersedia; validasi hujan pembanding tetap BE-13.
- [x] BE-04. Implementasikan service SoilGrids: konversi satuan, pembobotan kedalaman 0–30 cm, tekstur, ketidakpastian, cache, dan hasil parsial saat data gagal. Implementasikan Nominatim dengan validasi, cache, dan pembatas laju. **Status 14 November 2026:** Selesai: SoilGrids native WebDAV/VRT, agregasi pixel/depth, pH/SOC/tekstur/ketidakpastian, cache dan hasil unavailable; Nominatim dengan cache, validasi dan pembatas bersama. Tiga polygon tanah masih sampel sementara, bukan dua lokasi demo final.
- [x] BE-05. Implementasikan profil bulanan, kelas Oldeman, validitas bulan, dan jendela tahun historis berurutan sesuai horizon. Jangan membentuk tahun buatan dari statistik tiap bulan. **Status 14 November 2026:** Selesai: fungsi murni agregasi/profil bulanan, audit kelengkapan, kelas bulan, jendela historis nyata, service/cache. Belum menilai tanaman atau memilih strategi.
- [x] BE-06. Implementasikan kalender pembanding/kandidat, K1–K5, lima dimensi, pemilihan alternatif berbeda, serta penanganan pola biasa gagal dan kandidat kurang. Gunakan tabel bersumber yang dikurasi pada BE-12. **Status 14 November 2026:** Mesin murni di `backend/app/core/` (kalender, K1 sampai K5, lima dimensi, pemilihan alternatif) dengan tes hujan buatan. Keputusan implementasi tercatat di [rotation-engine.md](backend/contracts/rotation-engine.md). Belum dirakit menjadi `/analyze` (BE-07 dan BE-09).
- [x] BE-07. Rakit alasan/kompromi/risiko Indonesia dan Inggris dari templat serta angka hasil hitung. Sertakan provenance, validasi hujan, asumsi, dan data yang hilang pada `/api/v1/analyze`. **Status 14 November 2026:** Templat alasan, kompromi, risiko, dan catatan Indonesia/Inggris di `backend/app/core/explain.py`, semuanya diisi angka hasil hitung dan divalidasi terhadap schema `Strategy`. Provenance, validasi hujan, dan asumsi dirakit oleh pipeline BE-09.
- [ ] BE-08. Selesaikan `/api/v1/crops` dan `/api/v1/geocode`, siapkan cache dua titik demo, dan pasang data hujan pembanding bila aturan validasi mengharuskannya. **Status 14 November 2026:** Sebagian: `/crops` dan `/geocode` sudah aktif. Masih terbuka: pemilihan/cache dua lokasi demo final, validasi hujan dan pemasangan data pembanding jika diperlukan. Jangan menandai seluruh BE-08 selesai hanya karena route tersedia.
- [x] BE-09. Sediakan fungsi orkestrasi analisis yang dipakai endpoint dan tool agent. Orkestrasi memanggil service data; fungsi murni di `core/` tetap bebas jaringan. Bantu Orang 3 menghubungkan tool tanpa membuat HTTP request ke server sendiri. **Status 14 November 2026:** `AnalysisService` di `backend/app/services/analysis.py` dipakai `POST /api/v1/analyze` dan siap dipanggil tool agent tanpa HTTP. Iklim dan tanah diambil bersamaan dengan batas 15 dan 8 detik.
- [ ] BE-10. Uji mesin dengan hujan buatan, batas kelayakan, data hilang, baseline gagal, dan alternatif tidak lengkap. Uji pergantian sumber air/bulan mulai, SoilGrids mati, serta POWER mati dengan/tanpa cache.
- [ ] BE-11. Sesuaikan script root, runner, workspace/lockfile yang terkait migrasi, env, dan petunjuk menjalankan aplikasi. Deploy ke Render, daftarkan router agent dari Orang 3, lalu periksa proxy dan kinerja bersama Orang 1.
- [x] BE-12. Kurasi `crops.json` untuk lima tanaman dan bera serta `rotations.json` untuk 8–12 pola bersumber. Isi famili/peran, slot, suhu, pH, air, aturan urutan, sifat tanah, sumber, dan versi; jangan mengarang nilai yang belum terverifikasi. Kerjakan versi awal sebelum BE-06. **Status 14 November 2026:** Versi awal selesai untuk mulai BE-06: enam entri tanaman/bera, delapan kandidat bersumber (empat pemetaan pola lokal), dua draft nonaktif, sumber per field dan fingerprint versi. Aturan larangan urutan masih kosong karena belum ada larangan spesifik terverifikasi; bukan jaminan bebas risiko agronomi. Air orok-orok tetap null dan kacang hijau memakai proxy bean sesuai PRD. Tinjauan agronomi lanjutan tetap diperlukan.
- [ ] BE-13. Pilih dua titik demo bersama tim, lalu buat/jalankan `validate_rain.py`. Batasi usaha akses pembanding dua jam sesuai PRD; simpan ringkasan/data pembanding, tentukan sumber hujan, atau tandai belum divalidasi.
- [ ] BE-14. Cek manual agregasi dua bulan dan kecukupan hujan satu tahap. Catat hasil hitung dan minta Orang 1 mengecek ulang contoh angka sebelum demo. Siapkan templat agronomi Indonesia/Inggris untuk BE-07 dan referensi yang boleh dipakai agent. **Status 14 November 2026:** Sebagian: agregasi Januari/Februari 2016 sudah dicocokkan dengan raw NetCDF. Belum cek kecukupan air satu tahap, pemeriksaan ulang Orang 1, atau templat narasi agronomi lengkap.
- [ ] BE-15. Gunakan PostgreSQL dari `docker-compose.yml` untuk pengembangan database. Hubungkan FastAPI lewat `DATABASE_URL`, tentukan tabel dan migrasi saat kebutuhan persistensi diimplementasikan, dan siapkan koneksi database produksi. Docker/healthcheck/volume disediakan; integrasi aplikasi belum selesai. Riwayat chat tetap tidak disimpan permanen.

**Area kerja:** `backend/app/main.py`, `schemas.py`, `config.py`, `api/routes.py`, `services/{power,soil,geocode,cache}.py`, `core/`, `backend/data/`, `scripts/validate_rain.py`, `docker-compose.yml`, tabel/migrasi database yang dibutuhkan, tes terkait, konfigurasi backend, script root, dan README untuk cara menjalankan aplikasi.

**Selesai bila:** empat endpoint inti berjalan dengan data nyata, kurasi dan aturan bersumber, angka dapat dicek ulang, cache demo tetap dapat dipakai tanpa penyedia data, dan pipeline bisa dipanggil agent. Pemilik data/perhitungan A-05–A-11; A-04/A-12/A-15 diverifikasi bersama Orang 1. Sumber setiap baris tetap syarat mesin meskipun pemeriksaan A-14 tercantum sebagai Sebaiknya di PRD.

## 4. Orang 3: backend agent dan frontend chat

Progres awal: panel mengambang, hook percakapan, bahasa Indonesia/Inggris, serta service chat DeepSeek di FastAPI sudah dibuat. Provider awal DeepSeek dengan `AI_MODEL=deepseek-flash`; set API key di environment backend. Ini belum menyelesaikan seluruh AI-01–AI-10: konteks analisis, tool, sumber terkurasi, dan kuota harian masih menunggu integrasi. Detail konfigurasi dan batas penggunaan ada di README.

- [ ] AI-01. Pilih provider/model AI bersama tim berdasarkan tool terstruktur, biaya, bahasa, latensi, retensi data, dan akses API key. Simpan rahasia di env backend dan uji koneksi sebelum integrasi.
- [ ] AI-02. Sepakati kontrak chat dan bentuk konteks hasil analisis dengan Orang 2. Sepakati props komponen dengan Orang 1: `lang` dan `analysisInput` lengkap atau `null`. Siapkan fixture agar pekerjaan agent tidak menunggu mesin selesai.
- [ ] AI-03. Implementasikan `/api/v1/agent/chat`, schema chat sesuai kontrak bersama, integrasi penyedia LLM, instruksi agent, dan pembangunan konteks tepercaya dari hasil backend.
- [ ] AI-04. Implementasikan `get_crop_facts(crop_id)` dari kurasi Orang 2 dan `analyze_scenario(changes)` melalui pipeline Orang 2. Tool hanya mengubah waktu/sumber air pada salinan input dan tidak mengubah aturan atau input aktif pengguna.
- [ ] AI-05. Pasang validasi tool/sumber, batas pesan/riwayat, batas panggilan/output, laju/kuota, deadline, dan penanganan kegagalan. Jangan menyimpan percakapan permanen atau mencatat isi pesan/kunci pada log.
- [ ] AI-06. Buat `AgentChat`: panel buka/tutup, daftar pesan, kolom pertanyaan, tombol kirim, status memuat, label AI, sumber yang dapat dibuka, hasil skenario, dan tampilan Indonesia/Inggris. Ikuti gaya serta komponen UI yang dipakai Orang 1.
- [ ] AI-07. Buat `useAgentChat`, tipe request/response, dan fungsi API chat: riwayat dalam memori tab, hapus percakapan, retry tanpa pesan ganda, reset saat konteks/bahasa berubah, serta abaikan respons lama.
- [ ] AI-08. Hubungkan panel langsung ke `/api/v1/agent/chat`. Tangani tanpa konteks, galat, timeout, kuota habis, dan data parsial; pastikan chat tidak menghalangi halaman hasil. Serahkan komponen siap dipasang ke Orang 1 tanpa menambah route chat.
- [ ] AI-09. Uji backend dengan penyedia AI palsu: argumen salah, sumber tidak dikenal, upaya mengabaikan instruksi, tanpa konteks, tanah tidak tersedia, serta batas penggunaan. Uji UI chat di ponsel dan keyboard, reset, retry, sumber, dan perubahan bahasa.
- [ ] AI-10. Ganti fixture dengan hasil/pipeline nyata Orang 2. Tinjau tiga contoh percakapan demo: penjelasan, perubahan skenario, dan pertanyaan tanpa bukti. Verifikasi angka sesuai hasil analisis serta kegagalan AI terpisah dari alur utama.

**Area kerja:** `backend/app/api/agent.py`, `backend/app/services/{agent,llm}.py`, tes agent, `frontend/components/agent/`, `frontend/hooks/useAgentChat.ts`, tipe/API chat, teks terjemahan dan tes khusus chat. Perubahan schema/config bersama dikoordinasikan dengan pemiliknya; `frontend/app/` dan mesin rule-based tetap dimiliki Orang 1 dan Orang 2.

**Selesai bila:** panel chat dari kedua layar memakai endpoint nyata, menjelaskan hasil dengan sumber, menjalankan tool skenario, menangani kegagalan, dan berfungsi dalam kedua bahasa. Pemilik agent A-16–A-20 serta bagian chat A-15; Orang 1 membantu pemasangan dan Orang 2 memastikan hasil tool benar. Orang 3 tidak menangani kurasi agronomi, rumus, pengambilan data lingkungan, halaman utama, atau routing aplikasi.

## 5. Kepemilikan endpoint dan file bersama

| Endpoint | Pemilik backend | Pemakai/integrator frontend |
| --- | --- | --- |
| `POST /api/v1/analyze` | Orang 2 | Orang 1 |
| `GET /api/v1/crops` | Orang 2, termasuk isi data | Orang 1 |
| `GET /api/v1/geocode` | Orang 2 | Orang 1 |
| `GET /api/v1/health` | Orang 2 | Orang 1 untuk verifikasi koneksi |
| `POST /api/v1/agent/chat` | Orang 3; pipeline dari Orang 2 | Orang 3; panel dipasang Orang 1 |

Orang 2 memegang penggabungan perubahan `main.py`, `schemas.py`, `config.py`, dependensi Python, dan script root. Orang 3 menyerahkan kebutuhan schema/config/router agent agar tidak mengedit file bersama bersamaan. Orang 1 memegang halaman, layout, tipe analisis, bahasa global, dan konfigurasi proxy. Orang 3 memegang tipe/API/teks chat dan menyerahkan komponen panel siap pakai. Perubahan dependensi frontend atau kamus bersama digabungkan oleh Orang 1. Jika kontrak berubah, pemilik backend dan frontend menyelaraskannya dalam perubahan yang sama.

Batas pemasangan panel: halaman meneruskan `lang` dan `analysisInput`; komponen milik Orang 3 mengurus seluruh state serta request chat. Jika input belum lengkap, kirim `null`. Perubahan konteks yang diterima komponen memicu reset sesuai PRD. Ini memungkinkan Orang 1 mengerjakan routing/halaman dan Orang 3 mengerjakan UI agent tanpa saling menimpa file.

## 6. Urutan integrasi

| Tahap | Orang 1 | Orang 2 | Orang 3 | Syarat lanjut |
| --- | --- | --- | --- | --- |
| 0. Sepakati kontrak | Tipe, URL, dan props pemasangan chat | Schema analisis, fungsi pipeline, data kurasi, route inti | Schema chat, komponen panel, pilihan provider | Ketiganya memakai nama field, enum, galat, dan fixture yang sama |
| 1. Kerjakan fondasi bersamaan | Halaman, input, dan kerangka hasil | Kurasi awal, FastAPI, service data/cache, endpoint tanaman/pencarian | UI chat, hook, service LLM, fixture, uji koneksi AI | Input dapat dikirim; komponen chat dapat dipasang; kurasi awal terbaca |
| 2. Hidupkan analisis nyata | Ganti fixture halaman dengan API nyata | Profil, kalender, aturan, dimensi, selector, validasi hujan/provenance | Endpoint chat, tool fakta, batas penggunaan, tes agent | Satu titik demo menghasilkan strategi nyata; ganti air/waktu mengubah perhitungan |
| 3. Hubungkan agent | Pasang panel, teruskan input/bahasa, cek integrasi | Sediakan hasil dan pipeline nyata, bantu verifikasi angka | Hubungkan konteks/tool skenario, sumber, reset/retry dan UI chat nyata | Penjelasan dan skenario berasal dari data/pipeline nyata |
| 4. Verifikasi dan kirim | Mobile, bahasa halaman, deploy FE, screenshot | Tes akhir, cek data, deploy BE, cache, ukur respons | Uji agent dan UI chat, bahasa chat, angka/sumber jawaban | A-01–A-12 dan A-15–A-20 lulus; tautan publik dapat diakses |

Jadwal kalender mengacu bagian 14 PRD. Tabel ini menjelaskan ketergantungan, bukan janji estimasi jam. Jangan menunggu seluruh frontend atau seluruh backend selesai untuk integrasi pertama.

Submisi dikerjakan bersama setelah bagian utama terintegrasi: Orang 1 merakit slide dan tautan dari screenshot, Orang 2 menyediakan metode/sumber/validasi, Orang 3 menyediakan penjelasan penggunaan AI dan contoh chat. Tim menunjuk satu anggota untuk mengonfirmasi tenggat dengan Local Lead pada tahap 0 dan menekan Submit for Judging sebelum tenggat; pekerjaan ini bukan tanggung jawab khusus Orang 3.

## 7. Checklist bersama sebelum demo

- [ ] Alur empat input ke hasil dapat digunakan pada ponsel; tidak memakai data hasil tiruan.
- [ ] Satu kasus ganti sumber air dan satu kasus ganti bulan mulai mengubah hasil yang dihitung.
- [ ] Sumber, periode, nilai area, data hilang, dan hasil parsial terbaca.
- [ ] Seluruh hasil dan chat tersedia dalam Indonesia/Inggris.
- [ ] Chat menjelaskan hasil, menjalankan satu skenario, dan mengakui pertanyaan tanpa bukti.
- [ ] Chat gagal tidak merusak analisis; cache titik demo dapat digunakan ketika penyedia data mati.
- [ ] Tes tiap area dan pemeriksaan manual lulus; versi aplikasi untuk presentasi dibekukan.
- [ ] Aplikasi, repositori, dan slide tujuh halaman dapat dibuka tanpa login; daftar submisi PRD sudah diperiksa.

Beban Orang 2 paling besar karena memegang data dan mesin rule-based; selesaikan dataset minimum bersumber dan satu titik analisis nyata lebih dahulu. Orang 3 fokus agent dari backend sampai UI chat. Bila terlambat, potong F-19–F-21 lebih dahulu dan ikuti aturan potong PRD. Agent tetap termasuk cakupan wajib: jika belum lulus, laporkan sebagai belum selesai dan sepakati penyesuaian jadwal/cakupan. Pemilihan library peta yang belum selaras antara kode dan PRD harus diputuskan pada tahap 0 sebelum Orang 1 membuat ulang komponen.


Progres keamanan Orang 3: pemeriksa konteks/keamanan DeepSeek ditambahkan sebelum jawaban; keputusan divalidasi backend, kegagalan menghentikan alur, dan penolakan tidak ikut riwayat request berikutnya. Tes provider palsu dan UI mencakup keputusan/galat. Migrasi FastAPI selesai; evaluasi kualitas classifier dengan model asli dan pipeline analisis tetap belum selesai.

Orang 3: panduan gaya agronomi dan cakupan guardrail terbaru sudah dipasang di prompt classifier/jawaban; penolakan memakai kalimat persis permintaan pengguna. Bubble dirapatkan dan renderer aman mendukung bold/daftar. Evaluasi gaya serta ketepatan klasifikasi model nyata tetap diperlukan.

Orang 3: panduan format tambahan sudah diterapkan pada prompt jawaban. Bold/bullet opsional, tanpa dash pemisah/heading dekoratif, saran berbasis data, dan pertanyaan lanjut hanya untuk informasi esensial. Tidak ada perubahan kontrak API atau renderer.

Orang 3: panduan data tidak tersedia sudah dipasang pada prompt jawaban. Rujukan cuaca BMKG tersedia, tanpa mengarang cuaca atau meminta pengguna menyalin isi situs. Pengambilan data real-time tetap belum diimplementasikan.
