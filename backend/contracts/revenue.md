# Estimasi omzet nasional 2023

Tambahan cakupan ekonomi ini diminta pemilik pada 15 November 2026. PRD tidak
diedit. Pernyataan lama yang menunda ekonomi tetap dokumen historis. Ini omzet
penjualan sebelum biaya, bukan laba bersih, peramalan harga atau prediksi panen.

## Data dan batas model

`data/economics/national-2023.json` menyimpan empat komoditas penjualan dan dua
entri eksplisit tanpa penjualan. Harga, produktivitas, satuan, bentuk hasil,
referensi tabel dan asumsi lengkap ada pada [README data](../data/economics/README.md).
Semua lokasi dan bulan memakai harga/yield nasional tahun 2023 yang sama.
Padi memakai rata-rata padi nasional sebagai pendekatan untuk padi sawah.
Jagung memakai penyesuaian berat asumsi KA28% → KA15%. Harga rata-rata 2023
tidak dibuktikan sebagai harga khusus KA15%, sehingga hasil tetap skenario.
Tidak ada koefisien kehilangan bahan, biaya pengeringan atau biaya produksi.

## Perhitungan

Fungsi murni `core/revenue.py` menerima kalender BE, referensi, dan luas lahan.
Luas dihitung di service/adaptor dengan Geod radius bumi rata-rata 6.371.008,8 m,
selaras radius Turf pada FE. Orientasi ring dan lubang dinormalisasi.

`omzet tahap = luas ha × hasil acuan kg/ha × harga acuan Rp/kg`.
Hanya tahap dengan panen selesai dalam horizon yang menghasilkan penjualan.
Tahap yang melewati horizon diberi `after_horizon` dan tidak diprorata. Pengulangan
pola memakai kalender yang sama dengan K1–K5. Orok-orok dan bera diberi `no_sales`.
Acuan ekonomi yang hilang tidak diam-diam menjadi nol. Loader menolak tabel
tidak lengkap/rusak. Angka per tahap dan total dibulatkan rupiah hanya saat
serialisasi. Total dari nilai sebelum pembulatan bisa berbeda beberapa rupiah
dari penjumlahan baris yang sudah dibulatkan. Ranking memakai Decimal per hektare.

## Pemilihan

Kelayakan K1–K5 dan lima dimensi tetap. Hanya pola lolos dengan panen penjualan
selesai yang bisa mendapat `is_highest=true`. Pola biasa tetap dihitung omzetnya
walaupun gagal, tetapi tidak bisa diberi tanda tertinggi bila tidak lolos.
Pilih nilai per hektare tertinggi di seluruh kandidat layak yang dinilai dan pola
biasa yang lolos. Luas sama untuk setiap strategi, sehingga urutan juga berlaku
pada omzet total lahan. ID menjadi pemutus jika nilai sama.

Jika pola terbaik sudah tampil sebagai pola biasa/Hemat air/Jaga tanah/Seimbang,
tandai kartu itu, jangan menduplikasinya. Jika belum tampil, tambahkan role
`omzet_tertinggi`. Maksimum respons menjadi 4 kartu. Tidak menjamin kartu ekonomi
terpisah selalu muncul atau menampilkan pola gagal untuk memenuhi jumlah.

## Kontrak dan UI

`strategy.revenue` memuat tahun acuan, area, IDR, total, nilai per hektare,
jumlah panen selesai, penanda tertinggi dan audit per tahap. `provenance.economics`
memuat versi+fingerprint data, sumber, referensi angka dan asumsi id/en.
Keduanya opsional dan tidak diserialisasi jika kosong agar fixture/hasil lama
tetap terbaca. Enum role bertambah dan maksimum strategies menjadi 4.

FE menampilkan omzet pada setiap kartu dan rincian strategi terpilih. Penanda
tertinggi, status pola gagal, panen yang belum selesai, penggunaan pupuk hijau,
asumsi jagung dan tahun nasional dijelaskan. Lima dimensi agronomi tidak diganti
oleh uang. Perhitungan/ranking tidak dilakukan ulang di FE atau oleh LLM.

Versi metode/data harus dinaikkan bila basis tahun, satuan, harga/yield, asumsi
kadar air atau aturan panen berubah. Menggunakan harga live/per provinsi atau
menampilkan keuntungan bersih tetap di luar fitur ini.
