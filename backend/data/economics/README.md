# Referensi omzet nasional 2023

`national-2023.json` adalah data kecil yang dikurasi dan masuk Git. PDF sumber di
`backend/cache-archives/` adalah berkas lokal pemilik dan tidak diperlukan saat runtime.

Harga dari Statistik Harga Komoditas Pertanian 2025, tabel 1.1 dan 2.1, kolom
2023. Produktivitas dari Statistik Pertanian 2024, tabel 2.1.17/18/19/21,
baris Indonesia, kolom 2023. Satuan kuintal/ha dikalikan 100 menjadi kg/ha.
Padi menggunakan GKG tingkat petani, bukan GKP atau harga beras eceran.

Jagung: data hasil 8.071 kg/ha pada kadar air 28%. Untuk skenario konservatif,
berat disetarakan ke kadar air 15% dengan `8071 * 72 / 85`, sekitar 6.836,61
kg/ha. Harga Rp5.360/kg tetap rata-rata produsen 2023. Outlook Jagung 2024
halaman 21 menyebut variasi kadar air sekitar 15–20%, bukan harga tepat KA15%.
Ini asumsi pemodelan yang terlihat dalam respons/tampilan, bukan pasangan mutu
yang sudah terverifikasi identik atau batas bawah pendapatan yang terjamin.
Kehilangan bahan dan biaya pengeringan tidak dimodelkan.

Orok-orok dan bera ditandai `non_market`, tanpa harga pasar dalam model.
Penjualan nol adalah keputusan penggunaan, bukan data harga nol atau biaya nol.
Semua sumber, locator, SHA-256 PDF lokal dan asumsi id/en tercatat di JSON.
Tidak ada crawling atau akses penyedia harga saat pengguna melakukan analisis.

Metode/perubahan kontrak: [revenue.md](../../contracts/revenue.md).
