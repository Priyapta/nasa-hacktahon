# Mesin rotasi BE-06

Acuan utama: PRD bagian 9 dan 10. Dokumen ini mencatat cara PRD diterapkan di
kode dan keputusan implementasi untuk bagian yang belum dirinci PRD. Semua
fungsi di `app/core/rotation.py`, `feasibility.py`, `dimensions.py`, dan
`selector.py` murni. Fungsi tersebut menerima data yang sudah diambil dan tidak
memanggil jaringan atau berkas.

## Alur

1. `build_calendar` meletakkan pola mulai bulan mulai dan mengulangnya dari
   tahap pertama sampai horizon tertutup. Tahap terakhir boleh melewati horizon
   dan diberi tanda `continues_after_horizon`.
2. `evaluate` memeriksa K1 sampai K5 dan mengumpulkan risiko.
3. `measure` menghitung lima dimensi PRD 10.
4. `select` memilih Hemat air, Jaga tanah, dan Seimbang (hanya tanpa pola).

## Keputusan implementasi

| Topik | Keputusan | Alasan |
| --- | --- | --- |
| Pengulangan kandidat | Kandidat katalog diulang dari tahap pertama seperti pola biasa | Semua strategi memakai bulan mulai dan horizon yang sama (A-04) dan tidak ada bulan kosong tanpa penjelasan |
| Lama bera kandidat | Mengikuti `months` di `rotations.json` (4 dan 6 bulan) | Sudah dikurasi BE-12 |
| Hujan tahap yang melewati horizon | Dihitung untuk seluruh tahap memakai bulan historis asli setelah akhir jendela | Kebutuhan air berlaku untuk seluruh tahap. Jendela tanpa data untuk bulan itu tidak dihitung |
| Bulan hilang atau tidak sah | Jendela dikeluarkan dari pembagi untuk tahap itu, tidak diisi | PRD 11: tidak ada nilai karangan |
| Padi pada bulan basah (K5) | Minimal separuh bulan tahap padi berkelas basah menurut profil musiman | PRD 10 tidak menyebut berapa bulan. Semua bulan basah akan menggugurkan hampir semua pola padi. Konstanta `PADDY_MIN_WET_SHARE` |
| Padi di luar bulan basah dengan irigasi | Tidak menggugurkan, dicatat sebagai risiko | PRD 10: K5 tidak membuang kandidat untuk irigasi |
| K2 dengan suhu kosong | Bulan tanpa median suhu dilewati dan dicatat sebagai data terbatas | Tidak mengarang suhu |
| K4 | Hanya aturan `not_after_crop` yang bersumber. Katalog saat ini belum punya aturan, sehingga K4 selalu lolos | Handover BE-12 melarang aturan umum satu famili |
| Orok-orok | Dikecualikan dari K5 dan selalu diberi risiko kebutuhan air belum diketahui | PRD 4 dan katalog `k5_mode` |
| Kacang hijau | Dinilai memakai proxy bean FAO dan diberi risiko proxy | PRD 4 |
| Tingkat tekanan air | Dari tahap terlemah. Tanpa tahap yang dinilai, tingkat rendah dengan 0 dari 0 tahun | PRD 10 dan kontrak tidak menerima null |
| Daftar periksa tanah | Penambat N, pupuk hijau atau penutup tanah, dan lebih dari satu famili | PRD 10 |
| Kebutuhan air total (urutan Hemat air) | Jumlah `air_min_mm` semua tahap tanaman yang dinilai dalam kalender | PRD 10 menyebut total batas bawah kebutuhan air |
| Strategi berbeda | Berbeda bila ada tahap di dalam horizon yang berbeda tanaman, posisi, atau panjang | PRD 10 minimal satu tahap berbeda |
| Risiko nyaris gagal | Suhu kurang dari 1 °C dari batas absolut, atau hujan mencukupi di 60 sampai 69% jendela | PRD 10 menyebut aturan yang nyaris gagal tanpa angka. Hanya risiko, tidak menggugurkan |

Semua ambang ada sebagai konstanta bernama di `app/core/feasibility.py` agar
mudah ditinjau dan diubah.

## Kode risiko

Mesin mengembalikan kode, bukan kalimat. Kalimat dua bahasa dirakit BE-07.

| Kode | Arti |
| --- | --- |
| `soil_unavailable` | Data tanah tidak tersedia, K3 dilewati |
| `irrigation_assumed` | Irigasi dianggap tersedia, volume tidak dihitung |
| `continues_after_horizon` | Tahap berlanjut setelah horizon |
| `near_temperature` | Suhu dekat batas absolut tanaman |
| `near_water` | Hujan mencukupi hanya sedikit di atas ambang 60% |
| `water_unknown` | Kebutuhan air tanaman belum diketahui (orok-orok) |
| `water_proxy` | Kebutuhan air memakai proxy (kacang hijau) |
| `water_unassessed` | Tidak ada jendela sah untuk menilai hujan tahap ini |
| `paddy_outside_wet` | Kurang dari separuh bulan tahap padi berkelas basah |
| `data_limited` | Bulan dengan kurang dari 8 tahun data sah |

## Pemeriksaan dengan data nyata

Polygon contoh `contracts/fixtures/analyze_request.json`, arsip NASA POWER
2016 sampai 2025, pola biasa padi, padi, bera 4 bulan, horizon 12 bulan:

| Bulan mulai dan air | Hasil |
| --- | --- |
| November, tadah hujan | Pola biasa gagal K5 karena padi kedua jatuh pada Maret sampai Juni. Terpilih padi, jagung, bera dan padi, kacang hijau, bera |
| November, irigasi | Pola biasa lolos dan alternatif Jaga tanah berubah menjadi padi, jagung, kedelai |
| Mei, tadah hujan | Semua kandidat gagal K5, tidak ada alternatif |

Tabel ini pemeriksaan kewajaran, bukan validasi agronomi atau validasi hujan BE-13.
