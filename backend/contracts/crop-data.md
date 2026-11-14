# Katalog tanaman dan pola rotasi (BE-12, versi awal)

Katalog ini adalah bahan untuk BE-06, belum mesin penilaian/rekomendasi.
Tidak ada keputusan kelayakan lokasi, skor, kalender kandidat, atau `/analyze`.
PRD dan frontend tidak diubah.

## Berkas dan validasi

- `data/catalog/crops.json`: lima tanaman + bera, fakta suhu/pH/air,
  famili, peran, slot kalender, sifat penambat N/penutup tanah, catatan id/en.
- `data/catalog/rotations.json`: delapan kandidat bersumber dan dua draft nonaktif.
- `data/catalog/sources.json`: judul, URL/dokumen, tanggal akses dan tingkat verifikasi.
- `app/catalog.py`: loader lokal; memeriksa tipe, rentang, bahasa, identitas unik,
  kelengkapan referensi tiap field, sumber yang dikenal, dan konsistensi versi.

Versi `2026-11-14.v1` ditambah SHA-256 isi tiga JSON (12 karakter pertama).
Perubahan data mengubah fingerprint untuk integrasi cache mesin nanti.
Data dibaca sekali melalui loader cache; restart aplikasi setelah mengedit JSON.
Katalog tidak melakukan scraping/request penyedia saat startup atau GET crops.
Data kecil ini masuk Git, berbeda dari raw POWER/SoilGrids dan ZIP yang diabaikan.

`sumber` per field memakai ID dalam registry, locator halaman/tabel/bagian, serta
`basis`: direct, prd_decision, proxy, model_assumption, mapping, adaptation.
`verification=indexed_primary_excerpt` berarti bagian sumber primer terbaca lewat
indeks pencarian; PDF/halaman penuhnya belum berhasil diakses. Ini dibedakan dari
`primary_page`. PDF sumber tidak disalin ke repo. Status `source_checked` berarti
ditelusuri ke sumber, bukan persetujuan ahli agronomi atau validasi lahan setempat.

## Nilai dan asumsi yang perlu dipahami

Suhu dalam derajat Celsius, pH tanpa satuan, air dalam mm **per musim tanam**.
Suhu absolut/optimal dan pH memakai data sheet FAO ECOCROP (tautan pada registry).
Curah hujan **tahunan** ECOCROP tidak dipakai sebagai kebutuhan air per musim.
Famili dari halaman identitas ECOCROP dinormalisasi: Gramineae menjadi Poaceae,
Leguminosae menjadi Fabaceae. Nama ilmiah mengikuti entri sumber tersebut.

| Tanaman | Slot bulan PRD | Air mm/musim | Dasar air |
| --- | --- | --- | --- |
| Padi sawah | 4 | 450–700 | FAO paddy rice |
| Jagung | 4 | 500–800 | FAO maize |
| Kedelai | 3 | 450–700 | FAO soybean |
| Kacang hijau | 2 | 300–500 | Kategori bean FAO sebagai proxy sesuai PRD |
| Orok-orok | 2 | null | Belum terverifikasi; pengecualian K5 sesuai PRD |
| Bera | Pilihan pengguna 1–6 | 0 | Tidak ada kebutuhan air tanaman |

Sumber air: [FAO Training Manual 3, Table 14](https://www.fao.org/4/s2022e/s2022e07.htm).
`null` orok-orok berarti belum diketahui, **bukan nol kebutuhan**. K5 belum
diimplementasikan; `k5_mode` baru menyimpan kebijakan PRD untuk mesin berikutnya.

Slot bulanan adalah pilihan kalender model PRD termasuk persiapan/panen, bukan
jaminan umur semua varietas. `crop_cycle_days` menyimpan rentang luas ECOCROP;
`local_cycle_days` menyimpan contoh varietas/penelitian lokal bila ditemukan.
Keduanya tidak otomatis mengganti slot PRD. Orok-orok dipakai sebagai pupuk hijau,
bukan siklus produksi biji. Sifat penambat N bersifat kualitatif tanpa perkiraan kg N.
`penutup_tanah` menunjukkan peran khusus dalam MVP; false bukan klaim bahwa
tanaman itu tidak pernah menutup tanah atau tidak bisa dipakai sebagai cover crop.

`aturan_urutan` masih kosong karena belum ada larangan spesifik yang terverifikasi
untuk katalog ini. Tidak dibuat larangan umum satu famili: itu akan melarang
padi-padi yang justru tercatat pada sumber lokal. K4 nanti hanya dapat menerapkan
aturan spesifik yang disertai referensi; daftar kosong tidak menjamin bebas risiko
hama/penyakit. Ini batas kurasi versi awal, perlu ditinjau sebelum klaim agronomi.

## Kandidat dan batas bukti

| Urutan | Bukti |
| --- | --- |
| Padi → padi → jagung | Pemetaan pola lokal |
| Padi → padi → kacang hijau | Pemetaan pola lokal |
| Padi → jagung → bera 4 bulan | Pemetaan pola lokal; durasi bera pilihan model |
| Padi → kacang hijau → bera 6 bulan | Pemetaan pola lokal; durasi bera pilihan model |
| Padi → padi → kedelai | Urutan dilaporkan di Grobogan |
| Padi → jagung → kedelai | Urutan dilaporkan di Grobogan |
| Padi → jagung → padi | Urutan dilaporkan di Grobogan |
| Padi → kedelai | Urutan pada uji lapang Toroh |

Empat pemetaan mengacu pada Irawati dkk. (2021), pola padi-padi-palawija dan
padi-palawija-bero. Sumber membahas jagung/kacang hijau termasuk tumpangsari;
MVP memetakan menjadi satu tanaman per tahap, **tidak mensimulasikan tumpangsari**.
Empat lainnya memakai Chanifah dkk. (2019), Agroland 26(2) (2019), dan Laporan
Tahunan Puslitbang Tanaman Pangan 2014. URL dan locator ada di registry/rotations.
Kandidat bukan klaim bahwa slotnya selalu berjumlah 12 bulan. Kalender pengulangan,
horizon, dan penyaringan kelayakan masih tugas BE-06 sesuai PRD.

Padi-kedelai-orok dan padi-jagung-orok adalah **draft**, belum punya bukti urutan
spesifik lokal. Bukti penggunaan umum pupuk hijau tidak dianggap bukti urutan.
`candidate_rotations()` mengecualikan draft. Tidak ada kandidat yang otomatis
menjadi rekomendasi hanya karena punya sumber.

## API dan demo

`GET /api/v1/crops?lang=id` (default) atau `?lang=en` mengembalikan kontrak empat
field: crop_id, nama, peran, slot_bulan. Enam opsi, dengan slot bera null.
Bahasa tidak dikenal/query tambahan mendapat 400; OpenAPI mengikuti kontrak ini.
Fixture crops sekarang sama dengan katalog; fixture analisis tetap sintetis.

Dari direktori backend:

```bash
.venv/bin/python scripts/check_catalog.py
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Buka `http://localhost:8000/docs`, pilih GET crops, lalu Execute. Demo CLI
memperlihatkan versi, opsi, kandidat beserta basis bukti, dan draft yang nonaktif.
Tidak perlu API key, mengunduh dataset lagi, atau memakai cache lingkungan.

Verifikasi: tes offline memeriksa transkripsi nilai sumber, slot PRD, proxy/null,
draft, validasi kerusakan referensi/data, fingerprint isi, lokalisasi dan kontrak HTTP.
Tes ini memeriksa integritas implementasi, bukan validasi agronomi lapangan.
