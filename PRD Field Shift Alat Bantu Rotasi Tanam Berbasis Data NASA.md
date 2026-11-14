# PRD Field Shift: Alat Bantu Rotasi Tanam Berbasis Data NASA

Nov 14, 2026 · @z

## 1. Ringkasan dan keputusan utama

Field Shift adalah alat bantu keputusan berbasis web yang menerima empat input petani (lokasi, pola rotasi saat ini, waktu, sumber air) lalu membandingkan tiga strategi urutan tanam beserta alasan, kompromi, dan keterbatasannya. Lingkungan dinilai dari statistik riwayat sepuluh tahun NASA POWER dengan mesin aturan deterministik. Petani juga dapat bertanya kepada agent AI tentang hasil analisis, istilah pertanian, dan perubahan skenario. Agent memakai hasil mesin analisis serta referensi terkurasi sebagai dasar jawaban. Sasaran tim: lolos sebagai Global Nominee dari penjurian lokal, lalu membidik Local Impact Award dengan Best Use of Data sebagai sasaran kedua.

"Disepakati" berarti berasal dari handover tim, "Keputusan" berarti ditetapkan di PRD ini. Penambahan agent AI merupakan perubahan cakupan atas permintaan pemilik produk. Pilihan penyedia/model AI, biaya, dan kebijakan datanya perlu ditetapkan sebelum implementasi; pengecekan lain ada di bagian 16.

| No | Keputusan | Alasan | Bagian |
| --- | --- | --- | --- |
| 1 | Sasaran penghargaan: Global Nominee lewat penjurian lokal. Kategori global yang dibidik: Local Impact Award, lalu Best Use of Data. | Produk dilokalkan untuk petani Grobogan dan membuat sepuluh tahun data NASA terbaca oleh petani. Dua kategori itu paling dekat dengan kekuatan ini. | 15 |
| 2 | Wilayah demo: Kabupaten Grobogan, dua titik demo (satu sawah irigasi, satu tadah hujan). | Pola padi-padi-palawija dan padi-palawija-bera terdokumentasi di sana, jadi pembanding terasa nyata. | 4 |
| 3 | Tanaman: padi sawah, jagung, kedelai, kacang hijau, orok-orok, plus bera. Sorgum, kacang tanah, dan cabai dicoret. | Empat tanaman pangan itu adalah komoditas utama Grobogan. Daftar pendek berarti kurasi selesai dan setiap aturan punya sumber. | 4 |
| 4 | Iklim: NASA POWER sebagai tulang punggung. Hujan divalidasi sekali dengan CHIRPS dan IMERG lewat ClimateSERV. Stasiun BMKG opsional. | Satu layanan memberi dua pembanding, dan IMERG menambah dataset NASA kedua. Data stasiun tidak boleh menghambat jadwal. | 8.1 |
| 5 | Tanah: SoilGrids, dengan cache dua titik demo di repositori. | Layanannya masih beta dan pernah dihentikan sementara. | 8.2 |
| 6 | Metode: klimatologi sepuluh tahun, uji per jendela tahun, kelas bulan Oldeman, ambang kelayakan air 60%. | Bisa dihitung ulang dengan tangan, memakai klasifikasi yang dikenal penyuluh Indonesia, dan tidak mengklaim prediksi. | 9, 10 |
| 7 | Hasil: pola biasa ditambah "Hemat air" dan "Jaga tanah", tanpa skor gabungan. | Dua kompromi yang paling dekat dengan brief: kebutuhan air dan kesehatan tanah. | 10 |
| 8 | Input: horizon 6, 12, 18, atau 24 bulan (default 12). Lama tahap diambil dari tabel tanaman, hanya bera yang bisa diubah. | Mengurangi isian dan kesalahan pengguna. | 5 |
| 9 | Teknologi: Next.js di Vercel, FastAPI di Render, PostgreSQL sebagai database aplikasi. Pengembangan database memakai Docker Compose. | PostgreSQL ditambahkan atas keputusan pemilik produk; data kurasi dan cache demo tetap tersedia sebagai JSON. | 12 |
| 10 | Bahasa: antarmuka dwibahasa, Indonesia sebagai default dan Inggris lewat tombol. Halaman proyek dan slide berbahasa Inggris. | Global Judging mensyaratkan bahasa Inggris pada halaman proyek dan materi yang ditautkan. Petani sasaran berbahasa Indonesia. | 6, 15 |
| 11 | Demo submisi: slide tujuh halaman berbahasa Inggris, bukan video 30 detik. | Tujuh slide memuat bukti data dan validasi yang tidak muat dalam 30 detik. | 15 |
| 12 | Tidak ada pelatihan ML atau model prediksi agronomi, tidak ada angka ekonomi, dan semua hasil analisis berlabel estimasi berbasis pola historis. LLM hanya digunakan untuk agent percakapan. | Mempertahankan perhitungan yang bisa ditelusuri sambil memberi ruang tanya jawab. | 3, 9, 12.9 |
| 13 | Agent AI tersedia lewat panel "Tanya AI" di layar input dan hasil, dwibahasa, dengan tool baca data tanaman dan analisis skenario. | Petani bisa memahami hasil dan bertanya lanjutan tanpa menambah input wajib. | 5, 6, 7.1, 12.9 |

## 2. Masalah, pengguna, dan tujuan

**Masalah.** Petani memilih urutan tanam di tengah hujan yang makin sulit ditebak, air yang terbatas, dan tanah yang menurun kualitasnya. Tanaman yang cocok secara individual belum tentu cocok sebagai urutan, dan data lingkungan jangka panjang jarang tersaji dalam bentuk yang bisa langsung dipakai untuk membandingkan pilihan.

**Pengguna utama.** Petani lahan kecil di wilayah demo, dengan pengalaman teknis dan geospasial terbatas, yang mengakses lewat ponsel. Dua situasi yang dilayani:

- Petani yang sudah punya pola tanam dan ingin melihat alternatifnya.
- Petani baru atau yang belum punya pola dan butuh titik awal.

**Pengguna sekunder.** Penyuluh pertanian yang mendampingi petani dan menilai kelayakan saran secara lokal. Juri hackathon adalah pembaca demo, bukan pengguna sasaran.

**Tujuan produk**

1. Petani menyelesaikan empat input dan melihat perbandingan tiga strategi tanpa bantuan.
2. Setiap strategi punya alasan yang bisa ditelusuri ke data, aturan agronomi, dan input pengguna.
3. Mengubah waktu atau sumber air mengubah hasil lewat perhitungan, bukan lewat narasi.
4. Setiap angka dan klaim menampilkan sumber, periode acuan, dan batasnya.
5. Petani dapat bertanya dengan bahasa sehari-hari dan menerima penjelasan yang merujuk hasil analisis atau sumber tanaman terkurasi. Pertanyaan yang datanya belum tersedia dijawab dengan keterbatasannya.

**Bukan tujuan**

- Menggantikan keputusan petani atau keahlian agronomi lokal.
- Memprakirakan cuaca, hasil panen, atau keuntungan.
- Menyatakan satu strategi sebagai "terbaik" lewat skor gabungan.

**Ukuran keberhasilan demo**

| Ukuran | Target |
| --- | --- |
| Waktu dari membuka aplikasi sampai hasil tampil | Di bawah 2 menit untuk pengguna baru |
| Jumlah input wajib | Tepat 4 |
| Waktu respons analisis dengan data ter-cache | Di bawah 5 detik |
| Skenario demo yang hasilnya berubah secara masuk akal | Minimal 2 (ganti sumber air, ganti bulan mulai) |
| Skenario tanya AI | Minimal 3: penjelasan hasil, simulasi perubahan sumber air, dan pertanyaan tanpa data pendukung |
| Waktu respons chat dengan konteks ter-cache | Target di bawah 15 detik; batas total request 30 detik |

## 3. Cakupan MVP dua hari

MVP mencakup satu alur lengkap untuk satu wilayah demo. Semua yang tidak diperlukan alur itu ditunda. (Disepakati)

| Masuk cakupan | Ditunda |
| --- | --- |
| Empat input: lokasi, pola rotasi, waktu, sumber air | Input tujuan atau prioritas terpisah |
| Satu wilayah demo dengan daftar tanaman terkurasi | Cakupan global dan semua tanaman |
| NASA POWER sebagai tulang punggung iklim: suhu, radiasi, kelembapan, dan hujan sebagai pelengkap | SMAP, Landsat/MODIS, ECOSTRESS, SRTM |
| SoilGrids sebagai satu sumber tanah | Unggah hasil uji tanah, peta tanah lokal |
| Statistik historis sepuluh tahun | Pelatihan ML agronomi, prakiraan cuaca harian, model tren |
| Perbandingan pola biasa + 2 alternatif dengan penjelasan | Prediksi hasil panen, profit, label "keuntungan tertinggi" |
| Titik lokasi di peta | Gambar poligon lahan, deteksi tanaman dari citra |
| Tadah hujan atau irigasi sebagai kategori | Debit, jadwal, dan optimasi irigasi |
| Kontribusi kesehatan tanah secara kualitatif | Simulasi karbon organik, nitrogen, atau erosi |
| Validasi hujan sekali jalan terhadap IMERG atau CHIRPS dan stasiun BMKG untuk titik demo | Validasi otomatis untuk sembarang titik, IMERG atau CHIRPS sebagai sumber saat aplikasi berjalan |
| Antarmuka dwibahasa: Indonesia dan Inggris | Bahasa daerah |
| Chat teks agent AI: penjelasan hasil, istilah tanaman, dan simulasi lewat mesin analisis yang sama | Suara, foto/diagnosis penyakit, pencarian web bebas, riwayat lintas perangkat, dan tindakan otomatis |

Agent AI menjadi bagian cakupan yang diminta. Implementasinya dikerjakan setelah alur analisis inti berjalan; kelulusannya mengikuti A-16 sampai A-20. Add-on lain hanya dikerjakan setelah seluruh kriteria penerimaan Wajib di bagian 13 lulus. Urutannya ada di bagian 14.

## 4. Wilayah demo dan daftar tanaman

Wilayah demo adalah Kabupaten Grobogan, Jawa Tengah, dengan lima pilihan tanaman plus bera. (Keputusan)

**Alasan memilih Grobogan**

- Punya sawah irigasi dan tadah hujan sekaligus, sehingga input sumber air benar-benar mengubah hasil.
- Pola tanam nyatanya terdokumentasi: padi-padi-palawija dengan jagung dan kacang hijau, serta padi-palawija-bera saat kekeringan tinggi ([studi tiga desa di Grobogan](https://ppjp.ulm.ac.id/journal/index.php/es/article/download/11349/7292)).
- Petani setempat sudah biasa menanam kacang hijau dan kedelai sesudah panen padi ([Dinas Pertanian Grobogan, 2020](https://www.corteva.com/id/berita/Petani-Grobongan-Rotasi-Tanaman-Usai-Panen-Padi.html)).
- Jagung, kedelai, dan kacang hijau tercatat sebagai komoditas pangan unggulan kabupaten ini ([UGM](https://etd.repository.ugm.ac.id/penelitian/detail/82586)).

Ini juga dasar cerita Local Impact: alat ini menguji pola yang benar-benar dipakai petani setempat, bukan pola generik.

**Titik demo.** Dua titik: satu sawah irigasi di sekitar Purwodadi (kira-kira 7,09° LS, 110,91° BT, dicek di peta) dan satu sawah tadah hujan yang dipilih tim pada jam pertama. Karena sel grid POWER sekitar 50 km, kedua titik bisa jatuh di sel iklim yang sama. Perbedaan hasil lalu datang dari sumber air dan tanah, dan itu disebut terbuka saat demo.

Titik di luar Grobogan tetap dianalisis iklim dan tanahnya, dengan peringatan bahwa daftar tanaman dan aturan rotasi disusun untuk Grobogan.

**Daftar tanaman**

| Tanaman | Famili | Peran | Slot kalender (bulan) | Kebutuhan air per musim (mm) | Status nilai |
| --- | --- | --- | --- | --- | --- |
| Padi sawah | Poaceae | Produksi | 4 | 450 sampai 700 | Air sesuai tabel FAO. Slot dicek ke ECOCROP. |
| Jagung | Poaceae | Produksi | 4 | 500 sampai 800 | Air sesuai tabel FAO. Slot dicek ke ECOCROP. |
| Kedelai | Fabaceae | Produksi, penambat N | 3 | 450 sampai 700 | Air sesuai tabel FAO. Slot 3 bulan mengandaikan varietas genjah lokal, dicek ke panduan setempat. |
| Kacang hijau | Fabaceae | Produksi, penambat N | 2 | 300 sampai 500 | Memakai nilai "bean" FAO sebagai pendekatan, ditandai di antarmuka. |
| Orok-orok (Crotalaria juncea) | Fabaceae | Pupuk hijau, penutup tanah | 2 | Tidak dinilai | Belum ada rujukan kebutuhan air. Dikecualikan dari aturan K5 dan selalu diberi tanda risiko. |
| Bera | Tidak ada | Lahan terbuka | 1 sampai 6 | 0 | Diisi pengguna. |

Slot kalender adalah lama tanaman menempati lahan dalam bulan bulat, sudah termasuk olah tanah dan panen. Angka kebutuhan air berasal dari tabel kebutuhan air musiman FAO dan dipakai sebagai penyaring kasar, bukan neraca air. Kisaran suhu dan pH tiap tanaman diisi dari ECOCROP oleh jalur kurasi.

**Yang dicoret.** Kacang tanah, karena produksinya di Grobogan sangat kecil dibanding padi dan jagung. Sorgum, karena tidak ada pola lokal bersumber yang memuatnya. Cabai, karena menempati lahan sekitar 6 bulan dan berada di luar kelompok tanaman pangan yang dikurasi.

## 5. Alur pengguna dan layar

Aplikasi terdiri dari dua layar: satu layar input dan satu layar hasil. Tidak ada login, onboarding, atau halaman pengaturan. (Keputusan)

Kedua layar menyediakan panel "Tanya AI" tanpa route halaman tambahan. Chat bersifat opsional bagi pengguna dan tidak menjadi input kelima untuk membandingkan strategi.

**Alur utama**

1. Pengguna membuka aplikasi dan melihat peta wilayah demo dengan kolom pencarian.
2. Pengguna mengetuk titik di peta atau mencari nama desa atau kecamatan.
3. Pengguna menyusun pola rotasi: menambah tahap satu per satu dari daftar tanaman, termasuk "Bera", atau memilih "Belum punya pola".
4. Pengguna memilih horizon rencana dalam bulan. Bulan mulai terisi otomatis dengan bulan berjalan dan bisa diubah pada kontrol yang sama.
5. Pengguna memilih sumber air: tadah hujan atau irigasi.
6. Pengguna menekan "Bandingkan strategi".
7. Layar hasil menampilkan ringkasan kondisi lokasi, lalu tiga strategi berdampingan.
8. Pengguna mengubah waktu atau sumber air langsung dari layar hasil dan melihat hasil dihitung ulang.
9. Pengguna dapat membuka "Tanya AI", mengetik pertanyaan, dan membaca jawaban beserta sumber. Contoh: "Kenapa padi saya ditandai berisiko?" atau "Kalau pakai irigasi, apa yang berubah?"

**Alur tanya AI**

- Pada layar input, agent menjawab istilah dan fakta tanaman dari sumber terkurasi. Penilaian khusus lahan membutuhkan empat input lengkap; agent meminta pengguna melengkapinya bila belum tersedia.
- Pada layar hasil, frontend mengirim input analisis yang aktif. Backend menghitung atau membaca ulang konteks tepercaya; hasil analisis dari browser dan ucapan sebelumnya tidak dianggap bukti.
- Pertanyaan perubahan skenario dijalankan lewat mesin analisis yang sama. Jawaban menyebut asumsi skenario dan perubahan yang benar-benar dihitung. Agent tidak mengubah input atau kartu strategi aktif; pengguna mengubahnya melalui kontrol yang tersedia.
- Saat input analisis atau bahasa berubah, percakapan direset agar jawaban lama tidak tercampur dengan konteks baru. Chat baru juga bisa dimulai dengan tombol "Hapus percakapan".
- Riwayat hanya berada dalam memori tab dan hilang saat reload atau tab ditutup. Ada penanda jawaban AI, sumber yang dapat dibuka, status memuat, dan pesan gagal dengan opsi mencoba lagi.

**Layar input**

| Kontrol | Perilaku | Status |
| --- | --- | --- |
| Lokasi | Peta dengan satu penanda. Pencarian teks. Tanpa poligon. | Disepakati |
| Pola rotasi | Daftar tahap berurutan, maksimal 6 tahap. Tiap tahap: pilih tanaman dari daftar. Lama tahap terisi dari tabel tanaman; hanya lama bera yang bisa diubah (1 sampai 6 bulan). | Keputusan |
| Belum punya pola | Tombol terpisah dari "Bera". Mengosongkan daftar tahap. | Disepakati |
| Waktu | Pilihan horizon 6, 12, 18, atau 24 bulan, default 12. Bulan mulai default bulan berjalan, bisa digeser sampai 11 bulan ke depan. | Keputusan |
| Sumber air | Dua pilihan: tadah hujan, irigasi. Teks bantu: "Irigasi dianggap tersedia, jumlah airnya tidak dihitung." | Disepakati |

Konvensi yang ditampilkan di bawah kontrol pola rotasi: "Rencana dihitung mulai saat lahan siap ditanami pada bulan mulai. Pola biasa Anda diulang dari tahap pertama." (Disepakati)

**Layar hasil**

- **Ringkasan lokasi.** Kalender 12 bulan dengan kelas basah, lembap, atau kering per bulan, suhu, dan ringkasan tanah. Mencantumkan periode data, resolusinya, dan kalimat bahwa angka iklim adalah nilai area sekitar 50 km, bukan pengukuran tepat di lahan.
- **Tiga kartu strategi.** Tiap kartu berisi kalender urutan tanam sepanjang horizon, lima dimensi perbandingan, alasan, kompromi, dan risiko.
- **Panel "Dari mana angka ini".** Sumber data, periode acuan, asumsi, dan hal yang belum diketahui.
- **Pengingat tetap.** "Alat ini membantu membandingkan pilihan. Keputusan tetap di tangan Anda dan penyuluh setempat."

Bila pola rotasi lebih panjang dari horizon, kartu menampilkan bagian yang tercakup dan menandai tahap yang berlanjut setelah horizon. (Disepakati)

## 6. Kebutuhan fungsional

Ada 28 kebutuhan: 25 Wajib (20 analisis inti dan 5 agent AI) serta 3 Sebaiknya yang dikerjakan bila waktu tersisa.

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| F-01 | Pengguna memilih lokasi lewat ketukan peta atau pencarian teks. Sistem menyimpan lintang dan bujur. | Wajib |
| F-02 | Sistem memberi peringatan bila titik berada di luar wilayah demo. | Wajib |
| F-03 | Pengguna menyusun pola rotasi sebagai daftar tahap berurutan dari daftar tanaman terkurasi, termasuk bera. | Wajib |
| F-04 | Pengguna dapat menyatakan "Belum punya pola". Sistem lalu menampilkan tiga alternatif dan menjelaskan bahwa pembanding tidak tersedia. | Wajib |
| F-05 | Pengguna memilih horizon dalam bulan dan dapat mengubah bulan mulai. | Wajib |
| F-06 | Pengguna memilih sumber air tadah hujan atau irigasi. | Wajib |
| F-07 | Sistem mengambil data harian NASA POWER (suhu, radiasi, kelembapan, hujan) untuk titik itu selama sepuluh tahun kalender lengkap terakhir dan menyimpan metadata pengambilan. | Wajib |
| F-08 | Sistem mengambil tekstur, pH, dan karbon organik dari SoilGrids beserta ketidakpastiannya. | Wajib |
| F-09 | Sistem menghitung profil bulanan: median, minimum, dan maksimum hujan, statistik suhu, radiasi, dan kelembapan, serta kelas basah, lembap, atau kering. | Wajib |
| F-10 | Sistem menyusun kandidat urutan dari pustaka pola terkurasi, digeser ke bulan mulai dan dipotong ke horizon. | Wajib |
| F-11 | Sistem memeriksa kelayakan setiap kandidat dengan aturan K1 sampai K5 dan membuang yang gagal. | Wajib |
| F-12 | Sistem mengevaluasi tiap strategi pada setiap jendela tahun historis, bukan pada satu tahun rata-rata. | Wajib |
| F-13 | Sistem memilih dua alternatif yang berbeda dari pola biasa dan berbeda satu sama lain. | Wajib |
| F-14 | Sistem menampilkan tiap strategi dengan kalender, lima dimensi, alasan, kompromi, dan risiko. | Wajib |
| F-15 | Pola biasa selalu ditampilkan sebagai pembanding walaupun gagal aturan kelayakan, dengan tanda pada aturan yang gagal. | Wajib |
| F-16 | Mengubah waktu atau sumber air di layar hasil memicu perhitungan ulang. | Wajib |
| F-17 | Sistem menampilkan sumber, periode acuan, resolusi, asumsi, dan data yang hilang untuk setiap hasil. | Wajib |
| F-18 | Bila strategi layak kurang dari yang dibutuhkan, sistem menampilkan yang ada dan menjelaskan mengapa. | Wajib |
| F-19 | Sistem menghitung jeda hujan terpanjang (hari berturut-turut di bawah 1 mm) per tahap dari data harian. | Sebaiknya |
| F-20 | Kartu strategi menampilkan penjelasan singkat istilah: tadah hujan, pupuk hijau, penambat nitrogen. | Sebaiknya |
| F-21 | Pengguna dapat membuka rincian per tahun acuan untuk satu strategi. | Sebaiknya |
| F-22 | Antarmuka tersedia dalam bahasa Indonesia dan Inggris. | Wajib |
| F-23 | Panel asal data menampilkan hasil validasi hujan POWER terhadap pembanding untuk titik demo, dan menulis "belum divalidasi" untuk titik lain. | Wajib |
| F-24 | Petani dapat bertanya melalui chat teks dwibahasa di layar input dan hasil, dengan percakapan lanjutan selama tab aktif. | Wajib |
| F-25 | Agent menjelaskan hasil dengan konteks yang dibangun backend dan fakta tanaman bersumber. Jawaban menampilkan sumber yang relevan dan periode data bila memakai analisis historis. | Wajib |
| F-26 | Agent dapat memanggil tool baca fakta tanaman dan simulasi skenario melalui pipeline analisis yang sama. Angka dan kelayakan tidak dihitung oleh LLM; input aktif tidak diubah otomatis. | Wajib |
| F-27 | Agent menyebut keterbatasan atau meminta informasi saat bukti kurang; tidak mengarang kondisi lahan, sumber, hasil panen, keuntungan, dosis pestisida, atau prakiraan cuaca. | Wajib |
| F-28 | Kunci AI hanya di backend; chat dibatasi ukuran, laju, jumlah tool call, dan waktu. Gangguan AI tidak menghalangi alur analisis. Riwayat tidak disimpan permanen oleh aplikasi. | Wajib |

Catatan F-22: antarmuka dwibahasa berstatus Wajib. Global Judging mensyaratkan bahasa Inggris pada halaman proyek dan materi yang ditautkan, sedangkan petani sasaran berbahasa Indonesia. Bahasa Indonesia menjadi default dan bahasa Inggris dipilih lewat tombol. Teks alasan dari backend mengikuti parameter `lang`.

## 7. Kontrak input dan output

Satu endpoint analisis menerima empat input dan mengembalikan konteks lokasi, daftar strategi, dan asal data. Tiga endpoint pendukung (daftar tanaman, pencarian lokasi, pemeriksaan hidup) serta satu endpoint chat ada di bagian 12.4. Semua endpoint aplikasi memakai prefix `/api/v1`. Kontrak chat ada di bagian 7.1.

**Permintaan: `POST /api/v1/analyze`**

```json
{
  "location": { "lat": -7.09, "lon": 110.91 },
  "rotation": {
    "has_pattern": true,
    "stages": [
      { "crop_id": "padi_sawah" },
      { "crop_id": "padi_sawah" },
      { "crop_id": "bera", "months": 4 }
    ]
  },
  "time": { "start_month": "2026-11", "horizon_months": 12 },
  "water_source": "tadah_hujan", "lang": "id"
}
```

| Field | Aturan validasi |
| --- | --- |
| `location.lat`, `location.lon` | Angka desimal. Di luar kotak wilayah demo tetap diterima dengan peringatan. |
| `rotation.has_pattern` | `false` berarti `stages` kosong. |
| `rotation.stages` | 1 sampai 6 tahap. `crop_id` harus ada di tabel tanaman. `months` hanya untuk bera, 1 sampai 6. |
| `time.start_month` | Format `YYYY-MM`, bulan berjalan sampai 11 bulan ke depan. |
| `time.horizon_months` | Salah satu dari 6, 12, 18, 24. |
| `water_source` | `tadah_hujan` atau `irigasi`. |
| lang | id atau en, default id. Menentukan bahasa teks alasan, kompromi, risiko, dan catatan. |

**Respons**

```json
{
  "context": {
    "climate": {
      "period": "2016-01-01/2025-12-31",
      "monthly": [
        { "month": 1, "rain_median_mm": 0, "rain_min_mm": 0, "rain_max_mm": 0,
          "class": "basah", "t_mean_c": 0, "t_min_c": 0, "t_max_c": 0, "rad": 0, "rh_pct": 0, "n_years": 10 }
      ]
    },
    "soil": { "status": "ok", "depth": "0-30cm", "texture_class": "", "ph": 0,
              "soc_g_per_kg": 0, "uncertainty": {} }
  },
  "strategies": [
    {
      "id": "baseline",
      "role": "pola_biasa",
      "label": "Pola biasa Anda",
      "calendar": [
        { "crop_id": "padi_sawah", "start": "2026-11", "end": "2027-02", "continues_after_horizon": false }
      ],
      "feasibility": { "passed": false, "failed_rules": ["K5"] },
      "dimensions": {
        "climate_fit": { "level": "sedang", "evidence": "" },
        "water_pressure": { "level": "tinggi", "years_met": 4, "years_total": 9 },
        "bare_months": 4,
        "soil_contribution": { "legume": false, "cover_crop": false, "families": 1 },
        "risks": [""]
      },
      "reasons": [""],
      "tradeoffs": [""]
    }
  ],
  "notes": [""],
  "provenance": {
    "climate": { "source": "NASA POWER", "fetched_at": "", "resolution": "", "missing_days": 0, "rain_source": "POWER", "rain_validation": { "reference": "", "annual_diff_pct": 0, "months_class_differs": 0, "status": "" } },
    "soil": { "source": "SoilGrids 2.0", "fetched_at": "", "resolution": "250 m" },
    "crop_table_version": "",
    "assumptions": [""]
  }
}
```

Nilai angka pada contoh adalah placeholder bentuk, bukan data. `role` bernilai `pola_biasa`, `hemat_air`, `jaga_tanah`, atau `seimbang` (hanya tanpa pola pengguna). `level` selalu salah satu dari `rendah`, `sedang`, `tinggi`. Teks `reasons`, `tradeoffs`, dan `risks` pada respons analisis dirakit backend dari templat yang diisi angka hasil perhitungan. Jawaban chat disusun LLM dengan konteks dan batas di bagian 12.9.

**Kode galat**

| Kode | Kondisi |
| --- | --- |
| 400 | Input gagal validasi. Badan respons menyebut field yang salah. |
| 502 | NASA POWER tidak dapat dihubungi dan tidak ada cache untuk titik itu. |
| 200 dengan `soil.status = "unavailable"` | SoilGrids gagal. Analisis tetap jalan sebagai penilaian parsial. |

### 7.1 Kontrak agent AI

**Permintaan: `POST /api/v1/agent/chat`**

```json
{
  "message": "Kalau sumber air saya menjadi irigasi, apa yang berubah?",
  "history": [],
  "analysis_input": {
    "location": { "lat": -7.09, "lon": 110.91 },
    "rotation": {
      "has_pattern": true,
      "stages": [{ "crop_id": "padi_sawah" }, { "crop_id": "bera", "months": 2 }]
    },
    "time": { "start_month": "2026-11", "horizon_months": 12 },
    "water_source": "tadah_hujan"
  },
  "lang": "id"
}
```

- `message`: teks 1–2.000 karakter setelah trim.
- `history`: maksimal 10 pesan terakhir, setiap entri hanya `role=user|assistant` dan `content` sepanjang 1–2.000 karakter. Pesan `system`, `tool`, dan instruksi internal dari client ditolak.
- `analysis_input`: empat input dengan aturan validasi yang sama seperti `/analyze`, atau `null` untuk pertanyaan umum tentang tanaman. `lang` ditentukan di tingkat request chat dan diterapkan ke analisis/tool.
- Backend membangun ulang konteks dari input tervalidasi. Client tidak mengirim hasil analisis sebagai sumber kebenaran.

**Respons 200**

```json
{
  "answer": "Jawaban AI dalam bahasa yang dipilih, dengan rujukan [S1].",
  "sources": [
    {
      "id": "S1",
      "title": "Judul sumber dari data backend",
      "url": "https://example.org/sumber-placeholder",
      "period": null
    }
  ],
  "scenario": null
}
```

Contoh hanya menunjukkan bentuk respons. `sources` berasal dari provenance atau referensi kurasi yang benar-benar digunakan; ID rujukan dalam jawaban harus ada di daftar itu. `period` berisi periode data ketika relevan, selain itu `null`. Untuk permintaan klarifikasi tanpa klaim faktual, `sources` boleh kosong.

Jika agent berhasil menjalankan satu simulasi, `scenario` berisi `{ "input": ..., "result": ... }`: input lengkap skenario termasuk `lang`, dan hasil dengan kontrak yang sama seperti `/analyze`. Jika tidak ada simulasi yang berhasil, nilainya `null`. Satu balasan memuat maksimal satu skenario. Nilai ini tidak mengganti input aktif pengguna.

Chat memakai respons JSON biasa, tanpa streaming atau penyimpanan sesi di server. Kode 400 untuk input salah, 429 untuk batas laju/kuota, 502 untuk kegagalan penyedia AI atau data wajib, 503 bila AI belum dikonfigurasi, dan 504 bila batas total 30 detik tercapai. Bentuk galat mengikuti field `detail` yang menyebut sebab atau field terkait. Frontend tetap menampilkan hasil analisis yang sudah tersedia.

## 8. Data dan sumber

MVP memakai tiga sumber data: NASA POWER untuk lingkungan, SoilGrids untuk tanah, dan satu tabel tanaman yang dikurasi tim.

### 8.1 NASA POWER (Disepakati sebagai sumber utama)

POWER adalah tulang punggung iklim dan klimatologi: suhu, radiasi, dan kelembapan diambil darinya sebagai sumber utama, sedangkan hujan POWER berstatus pelengkap yang harus divalidasi. (Disepakati)

| Butir | Ketentuan |
| --- | --- |
| Endpoint | `https://power.larc.nasa.gov/api/temporal/daily/point` |
| Parameter kueri | `community=AG`, `format=JSON`, `longitude`, `latitude`, `start=20160101`, `end=20251231` |
| Variabel utama | `T2M`, `T2M_MAX`, `T2M_MIN` (°C), `ALLSKY_SFC_SW_DWN` (radiasi surya), `RH2M` (kelembapan relatif, %) |
| Variabel pelengkap | `PRECTOTCORR` (hujan, mm/hari), dipakai setelah divalidasi |
| Periode | Sepuluh tahun kalender lengkap terakhir, yaitu 2016 sampai 2025 per November 2026. Batas akhir dikonfirmasi dari respons, bukan diasumsikan. |
| Resolusi | Meteorologi sekitar 0,5° x 0,625° (kira-kira 50 km), radiasi surya 1° x 1°. Nilai area, bukan pengukuran petak. |
| Nilai hilang | Kode nilai hilang (umumnya -999) diubah menjadi kosong dan dihitung jumlahnya. |
| Disimpan | Rentang tanggal, satuan, jumlah hari hilang, sumber, dan waktu pengambilan. |

Nama parameter radiasi dan satuannya dicek ke dokumentasi POWER saat implementasi. Radiasi dan kelembapan tampil di ringkasan lokasi sebagai konteks iklim. Keduanya belum dipakai aturan kelayakan mana pun, dan baru masuk perhitungan bila add-on evapotranspirasi referensi dikerjakan (bagian 14).

**Nilai area, bukan titik lahan.** Satu sel grid POWER mencakup wilayah sekitar 50 km, sehingga dua lahan berdekatan mendapat profil iklim yang sama. Kalimat berikut wajib tampil di ringkasan lokasi, panel asal data, dan dokumentasi: "Angka iklim adalah nilai rata-rata area sekitar 50 km, bukan pengukuran tepat di lahan Anda."

**Validasi hujan** (Keputusan)

Validasi dilakukan sekali di luar aplikasi untuk titik demo, lalu hasilnya disimpan dan ditampilkan. Aplikasi yang berjalan tetap hanya memanggil POWER.

| Pembanding | Sifat | Resolusi | Peran |
| --- | --- | --- | --- |
| IMERG (NASA GPM) | Estimasi satelit | Sekitar 0,1° | Pembanding utama bila akses datanya lancar. Menambah satu dataset NASA. |
| CHIRPS | Satelit digabung data stasiun | Sekitar 0,05° | Pembanding utama bila IMERG sulit diakses. Bukan data NASA. |
| Stasiun BMKG terdekat | Pengukuran lapangan | Titik | Pembanding lapangan bila datanya bisa diperoleh |

Keputusan: CHIRPS dan IMERG diambil sekaligus lewat ClimateSERV, layanan yang menyediakan deret waktu titik untuk keduanya. Pekerjaan ini dibatasi dua jam. Bila IMERG gagal diambil, validasi berjalan dengan CHIRPS saja. Stasiun BMKG bersifat opsional: bila datanya tidak didapat, itu ditulis sebagai celah informasi dan tidak menghambat submisi.

Langkah validasi untuk tiap titik demo:

1. Ambil hujan bulanan 2016 sampai 2025 dari pembanding.
2. Hitung selisih rata-rata hujan tahunan POWER terhadap pembanding, dalam persen.
3. Hitung korelasi hujan bulanan antara keduanya.
4. Bandingkan kelas basah, lembap, kering untuk 12 bulan kalender dan hitung berapa bulan yang berbeda kelas.
5. Simpan hasilnya di `data/validation/{titik}.json` dan tampilkan ringkasannya di panel asal data.

Aturan keputusan (ambangnya ditetapkan tim, bukan diambil dari literatur): bila kelas berbeda pada lebih dari 3 dari 12 bulan atau selisih tahunan melebihi 25%, hujan untuk wilayah demo diambil dari pembanding yang sudah diunduh, dan POWER tetap dipakai untuk suhu, radiasi, dan kelembapan. Bila di bawah ambang, hujan POWER dipakai dan hasil validasinya ditampilkan apa adanya.

Untuk titik di luar titik demo, validasi tidak tersedia dan panel asal data menulis "hujan belum divalidasi untuk lokasi ini".

### 8.2 SoilGrids (sumber tanah)

| Butir | Ketentuan |
| --- | --- |
| Endpoint | `https://rest.isric.org/soilgrids/v2.0/properties/query` |
| Properti | `clay`, `sand`, `silt`, `phh2o`, `soc` |
| Kedalaman | 0-5, 5-15, dan 15-30 cm, dirata-rata berbobot ketebalan menjadi 0-30 cm |
| Nilai | `mean`, `Q0.05`, `Q0.95` |
| Resolusi | 250 m, estimasi spasial, bukan uji tanah lahan pengguna |
| Konversi | Nilai dikirim sebagai bilangan bulat. Faktor konversi tiap properti dibaca dari respons atau dokumentasi sebelum ditampilkan. |

Layanan REST SoilGrids masih beta, dibatasi 5 panggilan per menit, dan pernah dihentikan sementara oleh ISRIC. Karena itu:

- Data tanah untuk 3 sampai 5 titik demo diambil lebih dulu dan disimpan sebagai berkas JSON di repositori.
- Setiap respons di-cache per koordinat yang dibulatkan.
- Bila layanan gagal dan cache kosong, hasil ditandai penilaian parsial dan aturan K3 dilewati. Nilai tidak pernah dikarang.

Kelas tekstur diturunkan dari persen liat, debu, dan pasir dengan segitiga tekstur USDA.

### 8.3 Tabel tanaman dan pustaka pola

Satu berkas `crops.json` dan satu berkas `rotations.json`, keduanya ditinjau manual.

| Kolom `crops.json` | Isi |
| --- | --- |
| `crop_id`, `nama`, `famili`, `peran` | Identitas dan peran: produksi, pakan, pupuk hijau, penutup tanah |
| `slot_bulan` | Lama menempati lahan dalam bulan bulat |
| `t_abs_min`, `t_abs_max`, `t_opt_min`, `t_opt_max` | Kisaran suhu absolut dan optimal dari ECOCROP |
| `ph_abs_min`, `ph_abs_max` | Kisaran pH absolut dari ECOCROP |
| `air_min_mm`, `air_max_mm` | Kebutuhan air per musim |
| `butuh_bulan_basah` | `true` untuk padi sawah |
| `penambat_n`, `penutup_tanah` | Sifat untuk dimensi kesehatan tanah |
| `aturan_urutan` | Aturan dengan referensi, misalnya "tidak setelah famili yang sama" |
| `sumber` | URL atau judul dokumen untuk setiap nilai |

`rotations.json` berisi 8 sampai 12 pola urutan yang lazim atau dianjurkan untuk wilayah demo, masing-masing dengan sumbernya. Contoh bentuk: padi lalu padi lalu kacang hijau; padi lalu kedelai lalu orok-orok; padi lalu jagung lalu kacang hijau. Baris tanpa sumber tidak boleh dipakai mesin rekomendasi.

### 8.4 Data ekonomi

Ditunda. Tidak ada label keuntungan, angka profit, atau proyeksi hasil di MVP. (Disepakati)

## 9. Metode statistik lingkungan

Metodenya adalah klimatologi sepuluh tahun ditambah pengujian tiap strategi pada setiap rangkaian tahun historis yang utuh. Hasilnya berlabel "estimasi berbasis pola historis", tidak pernah "prakiraan" atau "prediksi". (Keputusan)

**Langkah 1. Periksa kualitas data**

- Hitung hari hilang per bulan. Bulan dengan lebih dari 3 hari hilang dikeluarkan dari statistik bulan itu.
- Bila sebuah bulan kalender punya kurang dari 8 nilai tahunan yang sah, bulan itu ditandai "data terbatas" di antarmuka.

Di luar pemeriksaan kelengkapan, hujan POWER dibandingkan sekali dengan IMERG atau CHIRPS dan stasiun BMKG untuk titik demo (bagian 8.1). Hasil validasi menentukan sumber hujan yang dipakai langkah 2 sampai 5 untuk wilayah demo.

**Langkah 2. Agregasi bulanan**

- Hujan: jumlah `PRECTOTCORR` per bulan per tahun, dalam mm.
- Suhu: rata-rata bulanan `T2M`, `T2M_MAX`, dan `T2M_MIN` per tahun.
- Data harian tetap disimpan untuk indikator jeda hujan (F-19).

**Langkah 3. Profil musiman**

Untuk tiap bulan kalender dihitung median, minimum, dan maksimum dari sekitar sepuluh nilai tahunan. Antarmuka menampilkan jumlah tahun yang dipakai. Persentil halus tidak dihitung karena sepuluh nilai terlalu sedikit untuk itu.

**Langkah 4. Kelas bulan**

| Kelas | Definisi (median hujan bulanan) | Dasar |
| --- | --- | --- |
| Basah | Di atas 200 mm | Ambang bulan basah Oldeman, dikaitkan dengan kebutuhan padi sawah |
| Lembap | 100 sampai 200 mm | Di antara dua ambang |
| Kering | Di bawah 100 mm | Ambang bulan kering Oldeman, dikaitkan dengan kebutuhan palawija |

Ambang ini mengikuti klasifikasi agroklimat Oldeman, yang disusun untuk padi dan palawija dan lazim dipakai di Indonesia ([contoh rujukan](https://journal.fateta.unipa.ac.id/index.php/agritechnology/article/download/82/43)). Sebagian rujukan menulis bulan basah sebagai 200 mm atau lebih. Selisih itu tidak mengubah hasil secara berarti dan definisi yang dipakai ditulis di panel asal data.

**Langkah 5. Evaluasi per jendela tahun**

Satu jendela adalah rentang bulan berurutan yang benar-benar terjadi: dimulai pada bulan mulai di tahun Y dan berjalan sepanjang horizon. Contoh untuk bulan mulai November dan horizon 12 bulan: November 2016 sampai Oktober 2017, lalu November 2017 sampai Oktober 2018, dan seterusnya sampai November 2024 sampai Oktober 2025. Itu memberi 9 jendela. Horizon 24 bulan memberi 8 jendela.

Setiap strategi diuji pada setiap jendela. Untuk tiap tahap tanam dihitung jumlah hujan selama tahap itu pada jendela tersebut, lalu dibandingkan dengan batas bawah kebutuhan air tanamannya. Hasil dilaporkan sebagai hitungan, misalnya "hujan mencukupi di 7 dari 9 tahun acuan".

Cara ini menjaga urutan musim tetap koheren. Kuantil tiap bulan tidak pernah digabung menjadi satu "tahun kering" buatan.

**Batas yang wajib ditulis di antarmuka**

- Hitungan "7 dari 9" adalah frekuensi historis, bukan peluang untuk tahun depan.
- Perbandingan hujan dengan kebutuhan air mengabaikan penguapan, limpasan, dan simpanan air tanah. Ini penyaring kasar, bukan neraca air.
- Sepuluh tahun tidak cukup untuk menggambarkan kejadian ekstrem yang jarang.
- Tidak ada tren yang diekstrapolasi.

**Bila tim tetap ingin memakai kata "prediksi".** Itu baru boleh setelah evaluasi berurutan waktu: estimasi dari tahun awal, uji pada tahun sesudahnya, dan dibandingkan dengan dua pembanding, yaitu klimatologi dan pengulangan tahun sebelumnya. Ini berstatus add-on, di luar MVP.

## 10. Mesin rekomendasi

Mesin bekerja dalam empat tahap: susun kandidat, saring dengan aturan kelayakan, ukur lima dimensi, lalu pilih dua alternatif. Kelayakan dan preferensi dipisah: kandidat yang gagal aturan kelayakan dibuang sebelum dimensi dibandingkan. (Keputusan)

**Alur perhitungan**

1. Ambil atau baca cache data iklim dan tanah untuk titik.
2. Bangun profil bulanan dan daftar jendela tahun (bagian 9).
3. Bentuk strategi pembanding: ulangi pola pengguna dari tahap pertama mulai bulan mulai, potong di akhir horizon.
4. Bentuk kandidat: tiap pola di `rotations.json` diletakkan mulai bulan mulai dan dipotong di akhir horizon.
5. Periksa K1 sampai K5 untuk tiap kandidat.
6. Hitung lima dimensi untuk pembanding dan semua kandidat yang lolos.
7. Pilih alternatif "Hemat air" dan "Jaga tanah".
8. Rakit alasan, kompromi, dan risiko dari templat teks.

**Aturan kelayakan**

| Kode | Aturan | Berlaku bila |
| --- | --- | --- |
| K1 | Semua tahap muat berurutan tanpa tumpang tindih. Tahap terakhir boleh berlanjut setelah horizon dan diberi tanda. | Selalu |
| K2 | Median suhu rata-rata tiap bulan dalam tahap berada di kisaran suhu absolut tanaman. | Selalu |
| K3 | pH tanah berada di kisaran pH absolut tanaman. | Data tanah tersedia |
| K4 | Tidak melanggar `aturan_urutan` yang punya referensi di tabel tanaman. | Selalu |
| K5 | Hujan selama tahap mencapai batas bawah kebutuhan air pada minimal 60% jendela tahun. Padi sawah juga wajib berada pada bulan kelas basah. | Sumber air tadah hujan |

Untuk sumber air irigasi, K5 tidak membuang kandidat. Hitungannya tetap dilakukan dan ditampilkan sebagai ketergantungan pada irigasi, dengan asumsi tertulis bahwa air irigasi tersedia dan volumenya tidak diketahui. Ambang 60% adalah parameter yang bisa diatur dan didokumentasikan.

Pola biasa pengguna tidak pernah dibuang. Aturan yang gagal ditampilkan sebagai tanda pada kartunya (F-15).

**Lima dimensi perbandingan**

| Dimensi | Cara hitung | Tampilan |
| --- | --- | --- |
| Kesesuaian iklim dan waktu | Persen bulan-tahap dengan median suhu di kisaran optimal dan, untuk padi sawah, berada pada bulan basah | Tinggi (80% ke atas), sedang (50 sampai 79%), rendah (di bawah 50%) |
| Tekanan air | Tahap terlemah: bagian jendela tahun yang hujannya mencukupi | Rendah (80% ke atas), sedang (60 sampai 79%), tinggi (di bawah 60%), plus teks "X dari N tahun acuan" |
| Lahan terbuka | Jumlah bulan bera dalam horizon | Angka bulan |
| Kontribusi kesehatan tanah | Daftar periksa: ada tanaman penambat nitrogen, ada pupuk hijau atau penutup tanah, jumlah famili berbeda | Daftar periksa, tanpa angka kg atau persen |
| Risiko dan keterbatasan | Tanda dari aturan yang nyaris gagal, data hilang, dan catatan kurasi tiap tanaman | Daftar butir |

Tidak ada skor gabungan. Tiga strategi ditampilkan berdampingan pada lima dimensi yang sama. Tingkat rendah, sedang, tinggi adalah indeks perbandingan, bukan peluang berhasil.

**Pemilihan alternatif**

| Alternatif | Dipilih dari kandidat layak dengan urutan prioritas | Syarat tambahan |
| --- | --- | --- |
| Hemat air | Tekanan air terendah, lalu total batas bawah kebutuhan air terkecil, lalu bulan terbuka paling sedikit | Minimal satu tanaman produksi. Bulan terbuka tidak melebihi pola biasa. |
| Jaga tanah | Bulan terbuka paling sedikit, lalu daftar periksa tanah terbanyak, lalu famili paling beragam | Minimal satu penambat nitrogen atau pupuk hijau |
| Seimbang (hanya bila belum punya pola) | Kesesuaian iklim tertinggi di antara kandidat yang belum terpilih | Tidak ada |

Dua alternatif harus berbeda minimal satu tahap dari pola biasa dan dari satu sama lain. Bila hanya satu kandidat yang layak, sistem menampilkan satu alternatif dan menjelaskan aturan mana yang paling banyak menggugurkan kandidat lain. Label "Hemat air" dan "Jaga tanah" sudah diputuskan. Versi Inggrisnya "Water-saving" dan "Soil-care".

**Templat alasan**

Setiap kalimat alasan diisi dari hasil hitung. Contoh bentuk: "\[Tanaman\] ditempatkan pada \[bulan\] karena hujan pada bulan itu mencukupi di \[X\] dari \[N\] tahun acuan." dan "Strategi ini mengurangi lahan terbuka dari \[A\] menjadi \[B\] bulan dibanding pola biasa Anda." Kalimat tanpa angka sumber tidak boleh muncul.

**Klaim yang dilarang**

- Kecukupan air secara kuantitatif untuk lahan irigasi.
- Kenaikan karbon organik atau nitrogen dalam angka.
- Risiko erosi, karena baseline tidak memakai data lereng.
- Hasil panen, pendapatan, atau peluang berhasil.

## 11. Kondisi gagal dan penanganannya

Setiap kegagalan berujung pada salah satu dari tiga hal: hasil parsial yang ditandai, pesan yang menjelaskan sebabnya, atau data cache. Sistem tidak pernah mengisi kekosongan dengan nilai karangan. (Keputusan)

| Kondisi | Perilaku sistem | Pesan ke pengguna |
| --- | --- | --- |
| NASA POWER gagal atau lambat | Pakai cache untuk sel grid itu. Tanpa cache: hentikan analisis. | "Data iklim belum bisa diambil. Coba lagi sebentar." |
| Banyak hari hilang di data iklim | Bulan terkait dikeluarkan dari statistik dan ditandai data terbatas. | "Data bulan \[X\] tidak lengkap, hasil untuk bulan itu kurang kuat." |
| SoilGrids gagal atau tidak punya nilai | Aturan K3 dilewati. Hasil ditandai penilaian parsial. | "Data tanah tidak tersedia untuk titik ini. Kesesuaian tanah belum dinilai." |
| Titik di luar wilayah demo | Analisis tetap jalan dengan peringatan. | "Daftar tanaman disusun untuk Grobogan dan mungkin tidak cocok di sini." |
| Titik di laut atau bukan lahan | Analisis iklim jalan, tanah kemungkinan kosong. | Sama dengan data tanah tidak tersedia. |
| Pengguna belum punya pola | Tiga alternatif tanpa pembanding. | "Belum ada pola untuk dibandingkan, jadi kami menampilkan tiga pilihan." |
| Pola pengguna lebih panjang dari horizon | Tampilkan bagian yang tercakup dan tandai kelanjutannya. | "Tahap \[X\] berlanjut setelah \[bulan\]." |
| Pola pengguna gagal aturan kelayakan | Tetap tampil dengan tanda aturan yang gagal. | "Pada data 10 tahun, hujan untuk \[tanaman\] mencukupi hanya di \[X\] dari \[N\] tahun." |
| Kandidat layak kurang dari dua | Tampilkan yang ada. | "Dengan waktu dan sumber air ini, hanya \[n\] pilihan lain yang memenuhi syarat." |
| Tidak ada kandidat layak | Tampilkan pola biasa saja dan aturan yang paling sering gagal. | "Coba ubah bulan mulai atau horizon." |
| Dua alternatif ternyata sama | Alternatif kedua diganti kandidat peringkat berikutnya. | Tidak ada |
| Pencarian lokasi tidak menemukan hasil | Minta pengguna mengetuk peta. | "Lokasi tidak ditemukan. Ketuk titik di peta." |
| Penyedia AI gagal, belum dikonfigurasi, atau timeout | Chat menampilkan galat; analisis inti tetap berjalan. | "Tanya AI belum bisa digunakan. Hasil perbandingan tetap bisa dibuka." |
| Kuota atau batas laju chat tercapai | Tolak request AI berikutnya tanpa memanggil penyedia. | "Batas tanya AI tercapai. Coba lagi nanti." |
| Pertanyaan tidak memiliki bukti yang cukup | Minta informasi atau jelaskan batas; jangan mengarang jawaban. | "Data yang tersedia belum cukup untuk menjawab pertanyaan ini." |

## 12. Arsitektur dan kebutuhan non-fungsional

Frontend Next.js mengumpulkan input dan menampilkan hasil. Semua perhitungan ada di backend FastAPI. PostgreSQL menjadi database aplikasi sesuai keputusan pemilik produk; pengembangan lokal memakai Docker Compose. Penyediaan database belum berarti tabel dan integrasi persistensi aplikasi selesai. Seluruh bagian ini berstatus keputusan.

### 12.1 Diagram arsitektur

Diagram alur frontend, backend, sumber data, dan agent AI tersedia di [architecture.md](architecture.md).

Browser tidak pernah memanggil NASA POWER, SoilGrids, Nominatim, atau penyedia AI secara langsung. Semua lewat backend, sehingga cache, batas laju, kunci AI, dan pencatatan asal data berada di satu tempat. Agent memanggil pipeline yang sama untuk simulasi tanpa mengganti aturan kelayakan.

### 12.2 Tumpukan teknologi

| Lapisan | Pilihan | Catatan |
| --- | --- | --- |
| Frontend | Next.js (App Router) dengan TypeScript dan Tailwind CSS | Mobile-first, dua rute |
| Peta | Leaflet lewat react-leaflet, ubin OpenStreetMap | Dimuat dengan `next/dynamic` dan `ssr: false` karena Leaflet butuh `window` |
| Backend | FastAPI, Pydantic, pandas, httpx | Lima endpoint `/api/v1`, tanpa akun pengguna |
| Agent | LLM eksternal dengan pemanggilan tool terstruktur | Penyedia/model dipilih sebelum implementasi; tanpa training model atau database vektor |
| Penyimpanan | PostgreSQL 17, lokal lewat Docker Compose | Tabel/migrasi dan koneksi FastAPI dikerjakan bersama kebutuhan persistensi; JSON kurasi/cache tetap tersedia |
| Data kurasi | `crops.json` dan `rotations.json` di repositori | Ditinjau manual, punya nomor versi |
| Pengujian | pytest untuk mesin analisis | Minimal uji data hujan buatan (A-08) |

### 12.3 Frontend Next.js

Dua rute, dan seluruh input disimpan di query string URL. Dengan begitu layar hasil bisa dimuat ulang, dibagikan, dan dihitung ulang hanya dengan mengubah URL.

| Rute | Isi | Jenis komponen |
| --- | --- | --- |
| `/` | Layar input: empat kontrol dan tombol "Bandingkan strategi" | Client component |
| `/hasil?lat=..&lon=..&pola=..&mulai=..&horizon=..&air=..` | Layar hasil: ringkasan lokasi, tiga kartu strategi, panel asal data | Client component yang memanggil `/api/v1/analyze` |

Contoh nilai `pola`: `padi_sawah,padi_sawah,bera:4`. Nilai `kosong` berarti belum punya pola.

| Komponen | Tanggung jawab |
| --- | --- |
| `MapPicker` | Peta Leaflet dengan satu penanda. Mengeluarkan lintang dan bujur. |
| `LocationSearch` | Kolom cari yang memanggil `/api/v1/geocode`, dengan debounce 500 ms |
| `RotationBuilder` | Daftar tahap: tambah, hapus, urutkan. Pilihan tanaman dari `/api/v1/crops`. Tombol "Belum punya pola". |
| `TimeControl` | Pilihan horizon dan bulan mulai dalam satu kontrol |
| `WaterSourceToggle` | Tadah hujan atau irigasi, dengan teks bantu |
| `ClimateCalendar` | 12 bulan dengan kelas basah, lembap, kering, dan suhu |
| `SoilSummary` | Tekstur, pH, karbon organik, atau tanda penilaian parsial |
| `StrategyCard` | Satu strategi: `RotationTimeline`, `DimensionList`, alasan, kompromi, risiko |
| `ProvenancePanel` | Sumber, periode, resolusi, asumsi, data hilang |
| `useAnalysis` (hook) | Memanggil API, menyimpan status muat, galat, dan hasil terakhir |
| LanguageToggle | Tombol Indonesia atau Inggris. Mengganti kamus teks antarmuka dan mengirim parameter lang ke API. |
| `AgentChat` | Panel chat, sumber, hasil skenario, status memuat/galat, pemberitahuan data AI, dan hapus percakapan |
| `useAgentChat` (hook) | Menyimpan riwayat dalam memori tab, mengirim pesan serta input aktif, mereset saat konteks/bahasa berubah |

Aturan frontend:

- Frontend tidak menghitung apa pun yang memengaruhi hasil. Ia hanya memformat angka dan tanggal.
- `lib/types.ts` mencerminkan kontrak bagian 7. Perubahan kontrak diubah di backend dan frontend dalam commit yang sama.
- Mengubah waktu atau sumber air di layar hasil memperbarui query string, lalu `useAnalysis` memanggil ulang API dengan debounce 300 ms. Hasil lama tetap tampil redup sampai hasil baru datang.
- `next.config.js` memakai `rewrites` agar `/api/v1/*` diteruskan ke FastAPI. Browser hanya mengenal satu asal, sehingga tidak perlu pengaturan CORS di produksi.
- Pesan dan jawaban chat dirender sebagai teks atau Markdown yang disanitasi; HTML mentah tidak dijalankan. Riwayat tidak masuk URL atau LocalStorage, dan respons chat lama diabaikan setelah reset konteks.

```text
frontend/
  app/
    layout.tsx
    page.tsx              # layar input
    hasil/page.tsx        # layar hasil
  components/
    input/   MapPicker.tsx  LocationSearch.tsx  RotationBuilder.tsx
             TimeControl.tsx  WaterSourceToggle.tsx
    hasil/   ClimateCalendar.tsx  SoilSummary.tsx  StrategyCard.tsx
             RotationTimeline.tsx  DimensionList.tsx  ProvenancePanel.tsx
    agent/   AgentChat.tsx
  lib/
    api.ts  types.ts  query.ts  format.ts
  hooks/
    useAnalysis.ts  useAgentChat.ts
  next.config.js
```

### 12.4 Backend FastAPI

| Endpoint | Fungsi |
| --- | --- |
| `POST /api/v1/analyze` | Endpoint utama sesuai kontrak bagian 7 |
| `GET /api/v1/crops` | Daftar tanaman untuk `RotationBuilder`: id, nama, peran, slot bulan |
| `GET /api/v1/geocode?q=` | Meneruskan pencarian ke Nominatim, dibatasi ke kotak wilayah demo dan 1 permintaan per detik |
| `GET /api/v1/health` | Pemeriksaan hidup, dipakai untuk membangunkan server sebelum demo |
| `POST /api/v1/agent/chat` | Tanya jawab dan simulasi sesuai kontrak bagian 7.1 |

Mesin analisis ditulis sebagai fungsi murni: masukannya data yang sudah diambil, keluarannya hasil. Tidak ada panggilan jaringan di dalam `core/`, sehingga bisa diuji dengan data buatan.

| Modul | Tanggung jawab | Bagian PRD |
| --- | --- | --- |
| `main.py` | Membuat aplikasi, memasang router, CORS untuk pengembangan lokal | 12 |
| `api/routes.py` | Empat endpoint inti, memetakan galat analisis dan pencarian | 7 |
| `api/agent.py` | Endpoint chat, validasi, batas laju dan kuota | 7.1 |
| `services/agent.py` | Konteks, tool yang diizinkan, dan pemeriksaan sumber jawaban | 12.9 |
| `services/llm.py` | Panggilan penyedia AI, batas output dan timeout | 12.9 |
| `schemas.py` | Model Pydantic untuk permintaan dan respons | 7 |
| `services/power.py` | Mengambil data harian NASA POWER, membersihkan nilai hilang, cache | 8.1 |
| `services/soil.py` | Mengambil SoilGrids, konversi satuan, rata-rata 0-30 cm, cache | 8.2 |
| `services/geocode.py` | Klien Nominatim dengan pembatas laju | 12 |
| `services/cache.py` | Baca dan tulis berkas JSON berdasarkan kunci | 12.6 |
| `core/climate.py` | Agregasi bulanan, profil musiman, kelas bulan, daftar jendela tahun | 9 |
| `core/rotation.py` | Membentuk kalender pembanding dan kandidat dari pustaka pola | 10 |
| `core/feasibility.py` | Aturan K1 sampai K5 | 10 |
| `core/dimensions.py` | Lima dimensi perbandingan | 10 |
| `core/selector.py` | Memilih "Hemat air", "Jaga tanah", dan "Seimbang" | 10 |
| `core/explain.py` | Mengisi templat alasan, kompromi, dan risiko | 10 |
| `core/pipeline.py` | Merangkai semua langkah untuk satu permintaan | 12.5 |
| scripts/validate\_rain.py | Skrip sekali jalan: ambil CHIRPS dan IMERG lewat ClimateSERV untuk titik demo, bandingkan dengan hujan POWER, simpan hasil ke data/validation/ | 8.1 |

```text
backend/
  app/
    main.py  schemas.py  config.py
    api/routes.py  api/agent.py
    services/  power.py  soil.py  geocode.py  cache.py  agent.py  llm.py
    core/      climate.py  rotation.py  feasibility.py
               dimensions.py  selector.py  explain.py  pipeline.py
  data/
    crops.json  rotations.json
    cache/power/  cache/soil/
  tests/
    test_climate.py  test_feasibility.py  test_pipeline.py  test_agent.py
  requirements.txt
```

### 12.5 Alur satu permintaan analisis

1. Layar hasil membaca query string dan `useAnalysis` mengirim `POST /api/v1/analyze`.
2. Next.js meneruskan permintaan ke FastAPI lewat `rewrites`.
3. `schemas.py` memvalidasi badan permintaan. Gagal berarti 400 dengan nama field.
4. `services/power.py` mencari cache untuk sel grid titik itu. Bila tidak ada, ia memanggil NASA POWER lalu menyimpan hasilnya.
5. `services/soil.py` melakukan hal yang sama untuk SoilGrids. Bila gagal, ia mengembalikan status tidak tersedia, bukan galat.
6. `core/climate.py` membangun profil bulanan dan daftar jendela tahun.
7. `core/rotation.py` membentuk kalender pembanding dan semua kandidat.
8. `core/feasibility.py` menyaring kandidat, lalu `core/dimensions.py` menghitung lima dimensi.
9. `core/selector.py` memilih alternatif dan `core/explain.py` merakit teksnya.
10. Respons JSON kembali ke frontend dan tiga kartu strategi digambar.

Langkah 4 dan 5 dijalankan bersamaan dengan `asyncio.gather`. Batas waktu panggilan luar: 15 detik untuk POWER, 8 detik untuk SoilGrids.

### 12.6 Cache dan berkas data

| Berkas | Kunci | Masa berlaku | Catatan |
| --- | --- | --- | --- |
| `cache/power/{lat}_{lon}.json` | Titik tengah sel grid POWER, bukan koordinat mentah | Selama hackathon | Dua titik dalam satu sel memakai berkas yang sama |
| `cache/soil/{lat}_{lon}.json` | Koordinat dibulatkan 3 desimal (sekitar 100 m) | Selama hackathon | Menyimpan juga respons gagal agar tidak dipanggil berulang |
| `data/crops.json`, `data/rotations.json` | Tidak ada | Dibaca sekali saat server mulai | Nomor versinya dikirim di `provenance` |

Cache titik demo ikut di-commit ke repositori. Banyak hosting gratis menghapus disk saat server dimulai ulang, jadi cache dari repositori menjadi bekal awal setiap kali server hidup.

### 12.7 Deployment dan konfigurasi

| Bagian | Pilihan | Variabel lingkungan |
| --- | --- | --- |
| Frontend | Vercel | `API_URL` untuk tujuan `rewrites`, mengikuti nama yang sudah dipakai repositori |
| Backend | Render | `CACHE_DIR`, `DEMO_BBOX`, `NOMINATIM_USER_AGENT`, `ALLOWED_ORIGINS` |
| Database | Lokal: Docker Compose; produksi: PostgreSQL terpisah yang dapat dijangkau backend | Root `.env`: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`; backend: `DATABASE_URL` |
| Agent AI | Melalui FastAPI | `AI_API_KEY`, `AI_MODEL`, `AI_DAILY_REQUEST_LIMIT` (default demo 100 request per proses per hari WIB) |
| Lokal | Next.js di port 3000 dan `uvicorn app.main:app --reload` di port 8000 | `API_URL=http://localhost:8000`; script root disesuaikan saat migrasi FastAPI |

Server gratis sering tertidur saat tidak dipakai. Panggil `/api/v1/health` beberapa menit sebelum presentasi, dan siapkan rekaman video sebagai cadangan. Kunci AI tidak masuk bundle browser atau repositori.

Jalankan database lokal dengan `docker compose up -d --wait db`. Port hanya dibuka di localhost dan data disimpan di named volume; kredensial tidak dikirim ke frontend. PostgreSQL tidak menambah akun, penyimpanan percakapan, atau endpoint CRUD secara otomatis. Migrasi data field dari LocalStorage dan pemindahan cache JSON bukan bagian penyediaan Docker ini.

### 12.8 Kebutuhan non-fungsional

| Aspek | Ketentuan |
| --- | --- |
| Kinerja | Di bawah 5 detik dengan cache, di bawah 20 detik untuk titik baru |
| Ketahanan demo | Titik demo sudah di-cache sebelum presentasi. Aplikasi tetap berjalan bila kedua API luar mati. |
| Kemudahan pakai | Semua kontrol bisa dipakai dengan satu tangan di layar 360 px. Tanpa istilah teknis tanpa penjelasan. |
| Bahasa | Kalimat pendek, kata sehari-hari, satuan mm dan °C |
| Keterbacaan | Kelas basah, lembap, kering dibedakan dengan warna dan teks, bukan warna saja |
| Ketertelusuran | Setiap angka di layar bisa dilacak ke sumber dan periode lewat panel asal data |
| Reproduksibilitas | Hasil numerik dan pemilihan strategi deterministik untuk input/cache yang sama. Susunan kalimat chat LLM dapat berbeda; angka harus berasal dari tool. |
| Privasi | Tanpa akun dan tanpa penyimpanan permanen percakapan oleh aplikasi. Sebelum pesan pertama, jelaskan bahwa pesan, riwayat terbatas, dan ringkasan konteks dikirim ke penyedia AI. Koordinat mentah tidak dikirim ke LLM; log tidak menyimpan isi pesan atau kunci. Kebijakan retensi penyedia dicek sebelum implementasi. |
| Ketahanan AI | Chat gagal secara terpisah; endpoint analisis tidak memanggil LLM. Target chat di bawah 15 detik untuk konteks ter-cache, deadline total 30 detik. |

Satu pengujian otomatis wajib ada: fungsi evaluasi diberi data hujan buatan yang jawabannya diketahui, lalu hasilnya dicek. Ini bukti paling murah untuk kriteria validity.

### 12.9 Agent AI untuk petani

Agent menerima pertanyaan teks dalam bahasa Indonesia atau Inggris dan memilih tool dari daftar terbatas:

| Tool internal | Fungsi | Batas |
| --- | --- | --- |
| `get_crop_facts(crop_id)` | Membaca fakta dan sumber dari tabel tanaman | ID harus ada di kurasi; tidak mengambil URL dari pengguna |
| `analyze_scenario(changes)` | Menerima perubahan sumber air dan/atau waktu, menggabungkannya dengan input aktif di backend, lalu memanggil pipeline dengan input lengkap tervalidasi | Perlu konteks lahan; satu simulasi per balasan; lokasi, pola, dan aturan K1–K5 tidak dapat diubah tool |

Backend menghitung konteks aktif sebelum memanggil LLM jika `analysis_input` tersedia. Model hanya mengirim perubahan `water_source` dan/atau `time` pada tool skenario; koordinat diambil backend dari konteks aktif tanpa dikirim ke model. Tanpa konteks, tool skenario ditolak dan agent meminta empat input. Tool memanggil fungsi service/pipeline langsung, tanpa HTTP ke endpoint aplikasi sendiri. Tidak diperlukan framework agent, vector database, atau web search untuk cakupan ini.

Maksimal tiga tool call dan empat panggilan LLM per request, dengan batas output 800 token per panggilan dan deadline total 30 detik, termasuk pengambilan konteks dan semua tool. Jika batas tercapai sebelum jawaban dapat didukung, tampilkan keterbatasan atau galat, bukan hasil parsial yang dikarang. Pembatas chat awal: lima request per menit per client dan kuota bersama 100 request per proses per hari WIB, dapat disesuaikan melalui `AI_DAILY_REQUEST_LIMIT`. Kuota dihitung sebelum memanggil penyedia. Batas per proses dapat ter-reset saat restart; anggaran pada akun penyedia tetap harus dipasang bila tersedia.

Pesan pengguna, riwayat, dan teks referensi diperlakukan sebagai data, bukan instruksi sistem. Server hanya menerima nama tool yang diizinkan, memvalidasi argumen, dan menolak akses file, URL bebas, eksekusi kode, atau tindakan tulis. Model hanya boleh merujuk ID sumber yang disediakan backend; daftar sumber dan URL dibangun backend dari hasil tool/kurasi. Jawaban dengan ID sumber tidak dikenal ditolak. Tautan klik berasal dari daftar sumber backend. Pemeriksaan ini tidak menjamin semua kalimat benar; contoh uji jawaban dan batas agronomi tetap wajib ditinjau.

Agent tidak mendiagnosis penyakit dari gejala/foto atau memberikan dosis pestisida. Untuk pertanyaan di luar referensi dan cakupan, jelaskan data yang belum ada dan arahkan ke penyuluh setempat. Provider/model dipilih saat implementasi berdasarkan dukungan tool terstruktur, bahasa, biaya, latensi, dan kebijakan data. Tidak ada training model agronomi.

## 13. Kriteria penerimaan

MVP dengan agent AI dinyatakan selesai bila 18 kriteria Wajib berikut lulus: 13 untuk alur inti dan 5 untuk agent. Tiap kriteria ditulis agar bisa dicek dalam beberapa menit.

**Alur dan input**

- [ ] A-01. Dari halaman awal, pengguna mencapai layar hasil hanya dengan empat input, tanpa field wajib lain.
- [ ] A-02. Pola dengan tahap bera tersimpan dan tampil sebagai bulan terbuka di kalender pembanding.
- [ ] A-03. Memilih "Belum punya pola" menghasilkan tiga alternatif dan kalimat bahwa pembanding tidak tersedia.
- [ ] A-04. Ketiga strategi memakai bulan mulai dan horizon yang sama.

**Data dan metode**

- [ ] A-05. Panel asal data menampilkan periode NASA POWER yang benar-benar diambil, jumlah hari hilang, waktu pengambilan, kalimat nilai area, dan ringkasan validasi hujan.
- [ ] A-06. Profil bulanan di layar sama dengan hasil hitung manual dari data mentah untuk minimal dua bulan yang dicek acak.
- [ ] A-07. Hitungan "X dari N tahun acuan" untuk satu tahap sama dengan hasil hitung manual.
- [ ] A-08. Pengujian otomatis dengan data hujan buatan lulus.

**Perilaku hasil**

- [ ] A-09. Mengganti tadah hujan ke irigasi pada titik dan pola yang sama mengubah minimal satu hal yang dihitung: kandidat yang lolos, alternatif yang terpilih, atau tingkat tekanan air.
- [ ] A-10. Menggeser bulan mulai dari awal musim hujan ke awal kemarau mengubah minimal satu alternatif atau satu dimensi.
- [ ] A-11. Mematikan akses SoilGrids menghasilkan penilaian parsial yang ditandai, bukan galat dan bukan nilai tanah karangan.
- [ ] A-12. Tidak ada kata "prediksi", "prakiraan", "keuntungan", atau angka hasil panen di antarmuka. Label "estimasi berbasis pola historis" tampil di layar hasil.

* [ ] A-15. Tombol bahasa mengubah seluruh antarmuka dan teks alasan ke bahasa Inggris, tanpa teks Indonesia yang tertinggal di layar hasil.

**Agent AI**

- [ ] A-16. Chat di kedua layar menjawab dalam bahasa yang dipilih, mendukung pertanyaan lanjutan, serta dapat dihapus. Perubahan konteks/bahasa mereset percakapan dan respons lama tidak muncul kembali.
- [ ] A-17. Jawaban tentang hasil analisis mengutip sumber yang tersedia dan periode yang tepat; angka untuk satu pertanyaan demo sama dengan hasil pipeline. Pertanyaan tanpa bukti menghasilkan keterbatasan atau permintaan informasi.
- [ ] A-18. Pertanyaan perubahan tadah hujan ke irigasi memanggil pipeline dengan input tervalidasi, menampilkan skenario dan perubahan hasil nyata, serta tidak mengubah input aktif.
- [ ] A-19. AI mati, timeout, atau kuota habis menghasilkan pesan yang jelas sementara analisis inti tetap berfungsi; percobaan ulang tidak menggandakan pesan pengguna.
- [ ] A-20. Tes otomatis dengan penyedia AI palsu memeriksa argumen tool tidak sah, prompt yang meminta mengabaikan batas, sumber tidak dikenal, batas tool/request, dan konteks data tanah tidak tersedia. Kunci tidak tampil di browser dan log tidak menyimpan percakapan.

**Sebaiknya**

- [ ] A-13. Seorang yang belum pernah melihat aplikasi menyelesaikan alur dalam 2 menit tanpa bertanya.
- [ ] A-14. Setiap baris di `crops.json` dan `rotations.json` punya kolom sumber yang terisi.

## 14. Urutan implementasi dua hari

Hackathon berlangsung 14 dan 15 November 2026, dan jadwal di bawah dihitung dari Sabtu pukul 12.00 WIB. Target tim adalah menekan Submit for Judging pada Minggu pukul 20.00, empat jam sebelum tenggat yang berlaku tahun lalu (Minggu 23.59 waktu Local Event). Tenggat 2026 dan jadwal penjurian lokal dikonfirmasi ke Local Lead pada jam pertama.

| Waktu (WIB) | Backend dan data | Frontend | Kurasi dan submisi | Selesai bila |
| --- | --- | --- | --- | --- |
| Sab 12.00 sampai 13.00 | Semua: baca keputusan bagian 1, bagi peran, kunci kontrak API bagian 7, cek tenggat dan format penjurian lokal | Sama | Sama | Setiap orang tahu jalurnya dan tujuh butir bagian 16 punya pemilik |
| Sab 13.00 sampai 17.00 | Pengambil NASA POWER dengan cache. Endpoint mengembalikan respons tiruan sesuai kontrak. | Layar input dengan empat kontrol, terhubung ke endpoint tiruan | `crops.json` untuk lima tanaman dari ECOCROP. Mulai `rotations.json`. | Empat input terkirim dan respons tiruan tampil |
| Sab 17.00 sampai 21.00 | Agregasi bulanan, profil musiman, kelas bulan. SoilGrids dan cache dua titik demo. | Ringkasan lokasi: kalender 12 bulan dan ringkasan tanah | `rotations.json` 8 sampai 12 pola bersumber. Skrip validasi hujan lewat ClimateSERV. | A-05 dan A-06 lulus |
| Sab 21.00 sampai 24.00 | Jendela tahun, aturan K1 sampai K5, lima dimensi, pemilihan alternatif | Kartu strategi dan kalender urutan tanam | Templat alasan, kompromi, risiko dalam dua bahasa | Satu titik demo memberi tiga strategi dari perhitungan nyata. A-09 dan A-10 dicek. |
| Min 08.00 sampai 12.00 | Kondisi gagal, pengujian otomatis, `lang`, endpoint agent dan dua tool internal | Hitung ulang, panel asal data, tombol bahasa, panel Tanya AI | Cek manual A-06/A-07 dan tiga contoh chat. Draf halaman proyek Inggris. | Kriteria inti dan A-16 sampai A-20 lulus; penambahan agent dapat menambah waktu kerja |
| Min 12.00 sampai 15.00 | Deploy ke Render, isi cache demo | Deploy ke Vercel, rapikan tampilan ponsel | Slide tujuh halaman. Uji dengan satu orang luar tim. | Fitur beku pukul 15.00 |
| Min 15.00 sampai 18.00 | Perbaikan bug saja | Perbaikan bug saja | Isi semua field halaman proyek, uji setiap tautan di jendela privat | Semua tautan terbuka tanpa login |
| Min 18.00 sampai 20.00 | Semua: cek akhir daftar submisi bagian 15, lalu Submit for Judging | Sama | Sama | Terkirim paling lambat 20.00 |

Bila Local Lead menetapkan presentasi atau tenggat lokal yang lebih awal, seluruh blok hari Minggu dimajukan dan aturan potong di bawah langsung dipakai.

**Aturan potong bila terlambat**

1. Buang F-19 sampai F-21 lebih dulu.
2. Ganti pencarian lokasi dengan dua titik demo siap pakai.
3. Lepas IMERG dan validasi hujan dengan CHIRPS saja.
4. Kurangi pustaka pola menjadi enam.
5. Jangan pernah memotong panel asal data, label estimasi historis, pengujian otomatis, atau versi bahasa Inggris.

Agent adalah perubahan cakupan wajib. Jika tidak selesai pada jadwal di atas, laporkan bahwa MVP dengan agent belum lengkap dan sesuaikan jadwal atau cakupan bersama pemilik produk; jangan menggantinya dengan chat tiruan. Pilihan penyedia/model dan uji koneksi dilakukan sebelum blok implementasi agent dimulai.

**Urutan add-on bila semua Wajib lulus lebih awal**

1. Jeda hujan terpanjang per tahap (F-19).
2. Rincian per tahun acuan (F-21).
3. Evapotranspirasi referensi dari suhu, radiasi, dan kelembapan POWER sebagai dasar neraca air sederhana.
4. Prakiraan musiman BMKG sebagai konteks, ditampilkan terpisah dari estimasi historis.

## 15. Strategi penghargaan dan submisi

Jalurnya dua tahap: juri lokal memilih proyek yang maju sebagai Global Nominee, lalu juri NASA dan mitra menilai para nominee untuk sepuluh Global Awards. Hadiah lokal bersifat opsional dan tidak harus jatuh ke tim yang sama dengan yang maju, jadi keduanya dikejar dengan satu produk yang sama. Rincian di bawah diambil dari [Judging and Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide) edisi 2024 dan [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) edisi 2025. Edisi 2026 terbit 13 November dan wajib dicek (bagian 16).

**Kategori global yang dibidik**

| Kategori | Yang dinilai | Kenapa cocok | Yang harus terlihat di submisi |
| --- | --- | --- | --- |
| Local Impact Award (utama) | Potensi terbesar membuat perbedaan di komunitas lokal | Dibuat untuk petani Grobogan: pola tanam setempat, kelas bulan Oldeman, bahasa Indonesia, peran penyuluh | Satu petani contoh dengan pola padi-padi-bera, validasi hujan lokal, kalimat peran penyuluh |
| Best Use of Data (kedua) | Membuat data antariksa lebih mudah diakses atau memakainya dengan cara yang unik | Sepuluh tahun NASA POWER menjadi kalender basah dan kering serta kalimat "mencukupi di X dari N tahun" | Panel asal data, slide validasi dengan IMERG, penjelasan nilai area |

Kategori lain tidak dikejar. Best Use of Science menuntut kedalaman metode yang tidak realistis dalam dua hari, dan sisanya menilai hal di luar kekuatan produk ini.

**Lima kriteria penjurian dan buktinya**

| Kriteria | Yang ditunjukkan | Bukti di produk |
| --- | --- | --- |
| Impact | Petani melihat kapan lahannya terbuka dan pilihan urutan yang menutupnya atau menurunkan tekanan air | Dimensi lahan terbuka dan tekanan air, berdampingan dengan pola biasa |
| Creativity | Pola milik petani sendiri diuji pada tiap tahun historis yang utuh, dengan aturan yang sama dengan alternatifnya | "X dari N tahun acuan" pada kartu pembanding |
| Validity | Metode yang bisa dihitung ulang, hujan divalidasi dengan dua sumber, batas ditulis, tanpa klaim prediksi | Panel asal data, pengujian otomatis, cek manual A-06 dan A-07 |
| Relevance | Menjawab brief: data NASA, tanah lokal, sifat tanaman, konteks petani. Lengkap, bisa dipakai, hanya empat input. | Aplikasi yang berjalan di ponsel, alur dua menit |
| Presentation | Satu cerita yang sama di slide, halaman proyek, dan demo langsung | Slide tujuh halaman dan naskah demo |

**Daftar submisi**

- [ ] Proyek dikirim pada challenge resmi Field Shift, bukan "Create Your Own Challenge".
- [ ] Semua anggota (maksimal enam) terdaftar di Local Event yang sama dan tampil di tab Members sebelum submisi ditutup.
- [ ] Semua field wajib terisi dalam bahasa Inggris: Project Name, High-Level Project Summary, Link to Project Demo, Link to Final Project, Detailed Project Description, NASA Data, Space Agency Partner and Other Data, Use of Artificial Intelligence.
- [ ] Field NASA Data menyebut NASA POWER sebagai sumber utama dan IMERG sebagai pembanding hujan, beserta cara pakainya. Field ini syarat kelayakan Global Award.
- [ ] Field Other Data menyebut SoilGrids, FAO ECOCROP, tabel kebutuhan air FAO, CHIRPS, OpenStreetMap, dan Nominatim.
- [ ] Field Use of AI menyebut alat AI yang dipakai tim dan untuk apa, termasuk penyusunan PRD, bantuan kode, serta provider/model agent di produk. Jelaskan bahwa LLM menjelaskan dan memanggil tool, sedangkan perhitungan strategi dilakukan mesin deterministik. Gambar buatan AI diberi watermark.
- [ ] Demo berupa slide maksimal tujuh halaman termasuk judul, berbahasa Inggris, di tautan publik. Melewati batas membuat proyek tidak layak Global Judging.
- [ ] Link to Final Project menuju aplikasi yang berjalan, dengan tombol bahasa Inggris, dan repositori publik.
- [ ] Setiap tautan diuji di jendela privat tanpa login.
- [ ] Tombol Submit for Judging ditekan sebelum tenggat. Submisi bersifat final.

**Isi tujuh slide**

1. Judul: nama tim, anggota, challenge Field Shift.
2. Masalah: satu petani Grobogan, pola padi-padi-bera, dan musim kering yang tidak menentu.
3. Solusi: empat input menjadi tiga strategi berdampingan, dengan tangkapan layar.
4. Peran data NASA: sepuluh tahun POWER menjadi kalender basah dan kering dan hitungan "X dari N tahun".
5. Validitas: perbandingan hujan POWER dengan IMERG dan CHIRPS, nilai area, tanpa klaim prediksi.
6. Dampak lokal: bahasa Indonesia, klasifikasi Oldeman, peran penyuluh, apa yang berubah bagi petani.
7. Langkah berikutnya dan tautan: aplikasi, repositori, sumber data.

**Alur demo langsung untuk juri lokal (tiga menit)**

1. Masalah dalam satu kalimat dan satu petani contoh.
2. Empat input diisi langsung.
3. Ringkasan lokasi: kalender basah dan kering dari sepuluh tahun data NASA.
4. Tiga strategi berdampingan, baca satu alasan yang memuat angka.
5. Ganti tadah hujan ke irigasi, tunjukkan apa yang berubah dan mengapa.
6. Buka panel asal data, sebut batas metode, tutup dengan peran penyuluh.

**Aturan bahasa di produk dan presentasi**

| Pakai | Hindari |
| --- | --- |
| Estimasi berbasis pola historis | Prediksi, prakiraan, ramalan |
| Mencukupi di 7 dari 9 tahun acuan | Peluang berhasil 78% |
| Berpotensi mendukung kesehatan tanah | Meningkatkan karbon organik sebesar X |
| Kebutuhan air lebih rendah | Hemat air X liter |
| Pilihan untuk dibandingkan | Rekomendasi terbaik |

Brief menulis bahwa tim "may" membandingkan minimal tiga strategi. Presentasi menyebutnya sebagai saran brief yang diikuti, bukan kewajiban.

## 16. Pengecekan yang tersisa dan risiko

Cakupan produk sudah ditetapkan. Ada enam pengecekan fakta awal serta satu penetapan teknis penyedia/model agent sebelum implementasi.

**Pengecekan**

| No | Yang dicek | Kapan | Bila berbeda dari asumsi |
| --- | --- | --- | --- |
| 1 | Judging and Awards Guide dan Project Submission Guide edisi 2026. PRD ini memakai edisi 2024 dan 2025. | Sabtu 12.00 | Perbarui daftar submisi dan isi slide di bagian 15 |
| 2 | Tenggat submisi 2026 serta jadwal dan format penjurian lokal, ditanyakan ke Local Lead | Sabtu 12.00 | Majukan jadwal bagian 14 dan pakai aturan potong |
| 3 | Kisaran suhu, pH, dan lama tumbuh lima tanaman di ECOCROP dan panduan setempat | Sabtu sore | Nilai ECOCROP yang dipakai. Slot kalender disesuaikan. |
| 4 | Nama dan satuan parameter radiasi NASA POWER | Saat menulis pengambil data | Pakai nama dari dokumentasi POWER |
| 5 | ClimateSERV: apakah CHIRPS dan IMERG tersedia untuk titik demo dan periode 2016 sampai 2025 | Sabtu malam | CHIRPS saja. Bila keduanya gagal, panel asal data menulis "hujan belum divalidasi". |
| 6 | Data stasiun BMKG terdekat lewat Data Online BMKG | Opsional | Ditulis sebagai celah informasi. Tidak menghambat submisi. |
| 7 | Pilih provider/model AI, verifikasi tool terstruktur, biaya, batas penggunaan, retensi data, dan ketersediaan API key | Sebelum implementasi agent | Sesuaikan integrasi dan anggaran; bila layanan belum tersedia, fitur agent belum dinyatakan selesai |

**Risiko**

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Layanan SoilGrids mati saat hackathon | Data tanah kosong | Cache titik demo di repositori, jalur penilaian parsial (A-11) |
| Kurasi tanaman dan pola tidak selesai atau tanpa sumber | Aturan agronomi tidak bisa dipertanggungjawabkan | Satu orang penuh di jalur kurasi sejak hari 1 pagi. Baris tanpa sumber tidak dipakai. |
| Nilai area POWER sekitar 50 km dianggap data petak | Klaim berlebihan, nilai validity turun | Resolusi ditulis di ringkasan lokasi dan panel asal data |
| Hujan POWER berbeda dari stasiun setempat | Kelas bulan meleset | Validasi sekali jalan terhadap IMERG atau CHIRPS dan stasiun BMKG (bagian 8.1). Bila selisihnya besar, hujan wilayah demo memakai pembanding. |
| Penyaring air terlalu kasar | Tanaman lolos padahal airnya kurang, atau sebaliknya | Disebut penyaring kasar, tampilkan hitungan per tahun, minta tinjauan penyuluh |
| Semua kandidat lolos atau semua gugur | Alternatif tidak berbeda atau tidak ada | Uji ambang K5 pada titik demo di hari 1 malam, sesuaikan dan dokumentasikan |
| Hasil tidak berubah saat input diubah | Interaksi utama gagal | A-09 dan A-10 dicek hari 1 malam, bukan hari 2 sore |
| Nilai awal di tabel bagian 4 keliru | Kalender dan penyaring salah | Verifikasi ke ECOCROP dan FAO adalah tugas pertama jalur kurasi |
| Cakupan melebar | Alur utama tidak selesai | Aturan add-on bagian 3 dan aturan potong bagian 14 |
| Agent mengarang fakta atau sumber | Petani menerima penjelasan keliru | Konteks backend, tool terbatas, sumber tervalidasi, uji jawaban, dan batas agronomi |
| API AI lambat, mahal, atau tidak tersedia | Chat terhambat atau anggaran habis | Batas request/tool/output, deadline, anggaran penyedia, dan kegagalan chat terpisah |
| Pesan petani terkirim ke penyedia eksternal | Paparan data percakapan | Pemberitahuan sebelum chat, konteks minimum tanpa koordinat mentah, tanpa log isi pesan; cek retensi penyedia |
| Agent menambah pekerjaan pada MVP dua hari | Jadwal awal terlewati | Kerjakan setelah pipeline inti, batasi ke teks dan dua tool; laporkan bila penerimaan agent belum lulus |

## 17. Sumber

Acuan cakupan adalah handover tim serta brief dan daftar resources challenge yang dilampirkan. Rincian teknis, aturan penghargaan, ambang Oldeman, kebutuhan air FAO, dan pola tanam Grobogan dicek lewat penelusuran web pada 14 November 2026. Kisaran suhu, pH, dan lama tumbuh tanaman belum dicek ke ECOCROP.

| Sumber | Dipakai untuk |
| --- | --- |
| Handover PRD tim, brief challenge Field Shift, dan daftar resources (lampiran) | Keputusan, cakupan, kriteria penilaian |
| [NASA POWER Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) | Endpoint dan parameter data harian |
| [Dokumentasi nasapower](https://docs.ropensci.org/nasapower/) | Nama parameter `PRECTOTCORR` dan `T2M`, resolusi grid POWER |
| [SoilGrids REST API](https://rest.isric.org/) | Endpoint, status beta |
| [FAQ akses SoilGrids](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html) | Batas 5 panggilan per menit, riwayat penghentian layanan |
| [ISRIC SoilGrids](https://isric.org/explore/soilgrids/) | Deskripsi produk tanah |
| [FAO ECOCROP](https://ecocrop.apps.fao.org/ecocrop/srv/en/home) | Kisaran suhu dan pH tanaman, untuk kurasi |
| Tabel kebutuhan air musiman FAO (tautan di bawah tabel) | Kisaran kebutuhan air per musim |
| [BMKG prediksi hujan bulanan](https://www.bmkg.go.id/iklim/prediksi-hujan-bulanan) | Add-on |
| [ECMWF seasonal forecasts](https://www.ecmwf.int/en/forecasts/documentation-and-support/seasonal) | Konteks prakiraan probabilistik, add-on |

Sumber tambahan dari riset keputusan:

- Penghargaan dan submisi: [Judging and Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide), [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), [Participant FAQs 2026](https://www.spaceappschallenge.org/resources/participant-faqs/).
- Kebutuhan air tanaman: [tabel kebutuhan air musiman FAO](https://sswm.info/water-nutrient-cycle/water-use/hardwares/conservation-soil-moisture/crop-selection), [FAO untuk kedelai](https://www.fao.org/land-water/databases-and-software/crop-information/soybean/fr/).
- Klasifikasi Oldeman: [jurnal Agritechnology UNIPA](https://journal.fateta.unipa.ac.id/index.php/agritechnology/article/download/82/43).
- Pola tanam Grobogan: [studi tiga desa](https://ppjp.ulm.ac.id/journal/index.php/es/article/download/11349/7292), [rotasi sesudah panen padi](https://www.corteva.com/id/berita/Petani-Grobongan-Rotasi-Tanaman-Usai-Panen-Padi.html), [komoditas unggulan](https://etd.repository.ugm.ac.id/penelitian/detail/82586), [angka produksi](https://pssh.umsida.ac.id/index.php/pssh/article/download/169/111).
- Pembanding hujan: [paket ClimateSERV](https://pypi.org/project/climateserv/0.0.24), [CHIRPS lewat ClimateSERV](https://ropensci.github.io/chirps), [Data Online BMKG](https://dataonline.bmkg.go.id/home).

NASA POWER meminta pencantuman ucapan terima kasih kepada proyek POWER NASA Langley Research Center bila datanya dipakai. Cantumkan di panel asal data dan slide penutup.
