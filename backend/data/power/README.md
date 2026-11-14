# Arsip lokal NASA POWER

Data unduhan bukan fixture sintetis dan tidak dimasukkan ke Git.
`raw/` menyimpan NetCDF per petak/tahun/variabel beserta sidecar JSON metadata.
`results/` menyimpan hasil harian berbobot polygon untuk inspeksi; service belum
memakai hasil tersimpan ini sebagai shortcut, sehingga perubahan source selalu
membaca ulang dan memvalidasi arsip. Cache yang dipakai ulang adalah file sumber.
`download-status.json` dan `download.log` menunjukkan progres proses lokal.

Lihat `../../contracts/power-data.md` untuk metode dan perintah penggunaan.
