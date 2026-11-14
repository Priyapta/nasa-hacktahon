# Pencarian lokasi Nominatim — BE-04 / bagian endpoint BE-08

Branch `geocode` dibuat dari `soilgrids` setelah rebase pengguna. Base commit
SoilGrids saat itu `9936dc3` dan sudah memuat `origin/main` (`fab258b`).
Perubahan task ini hanya berada di `backend/`; PRD dan frontend tidak diedit.
Baseline setelah rebase: 133 tes backend lulus dan tiga smoke check tanah nyata
berhasil dari cache lokal.

## Endpoint dan kontrak

`GET /api/v1/geocode?q=Purwodadi%2C%20Grobogan`

Respons 200 mengikuti kontrak BE-02:

```json
{
  "results": [
    {
      "id": "node-1308712305",
      "name": "Purwodadi, Grobogan, Jawa Tengah, 58111, Indonesia",
      "center": [110.9172873, -7.0811262],
      "zoom": 11
    }
  ]
}
```

Contoh berasal dari hasil pencarian nyata pada 14 November 2026; jumlah/isi
hasil penyedia dapat berubah. Atribusi: OpenStreetMap contributors, ODbL;
[lisensi dan kredit](https://www.openstreetmap.org/copyright).
Hasil hanya membantu navigasi peta, bukan polygon lahan. Input analisis
polygon dan schema tanah/iklim tetap seperti sebelumnya. ID memakai jenis dan
ID objek OSM; tidak bergantung pada place_id internal penyedia atau urutan hasil.
`center` tetap [longitude, latitude]. Maksimal lima hasil; kosong menjadi
`{"results": []}` dengan status 200.

`q` wajib, di-trim, tidak boleh kosong. Cache menormalkan spasi dan kapitalisasi
agar query yang setara tidak mengambil data berulang. Parameter tak dikenal
ditolak sesuai schema strict yang sudah ada. Validasi HTTP 400 tetap memakai
handler utama. Dokumentasi OpenAPI menampilkan 400, bukan 422 bawaan FastAPI.

## Wilayah dan konfigurasi

Pencarian mengirim `countrycodes=id`, `bounded=1`, dan `viewbox` dari DEMO_BBOX.
Hasil penyedia dicek lagi agar titik pusat berada dalam kotak itu.
Ini pembatas kotak pencarian, bukan pemotongan batas administratif Grobogan.
Lokasi analisis di luar wilayah demo tetap tidak ditolak oleh schema polygon.

Default kotak berasal dari bounding box OSM relation 9687051 (Grobogan), dicek
14 November 2026:

`west,south,east,north = 110.5415518,-7.2832140,111.2468490,-6.9094001`

Environment (lihat `backend/.env.example`):

| Nama | Kegunaan |
| --- | --- |
| `DEMO_BBOX` | Empat angka west,south,east,north |
| `NOMINATIM_BASE_URL` | Root endpoint Nominatim-kompatibel; default layanan publik |
| `NOMINATIM_USER_AGENT` | Identitas aplikasi; default FieldShift dengan URL repo |
| `CACHE_DIR` | Parent cache; geocode menyimpan di CACHE_DIR/geocode |

Tanpa CACHE_DIR, lokasi default adalah `backend/data/geocode/`.
Gunakan path absolut dan disk persisten untuk deployment. Geocoder membaca
konfigurasi saat pertama dipakai pada tiap proses; restart backend setelah
mengubah environment. Tidak ada panggilan penyedia saat aplikasi dinyalakan
atau saat health diperiksa. File `.env.example` tidak dimuat otomatis Uvicorn.
Konfigurasi provider yang salah menghasilkan galat konfigurasi server; tidak
mengganti wilayah diam-diam atau melanjutkan dengan User-Agent kosong/generik.

Konfigurasi CACHE_DIR ini berlaku untuk geocoder. Arsip POWER/SoilGrids tetap
memakai direktori/parameter root yang sudah didokumentasikan; task ini tidak
memindahkan cache data lingkungan secara diam-diam.

## Kebijakan penyedia yang harus dipertahankan

[Aturan resmi layanan publik](https://operations.osmfoundation.org/policies/nominatim/):
pencarian eksplisit pengguna, maksimal satu permintaan per detik per aplikasi,
User-Agent pengenal, atribusi yang terlihat, cache, dan tidak ada autocomplete
atau pengambilan daftar tempat secara sistematis. Jangan mengirim data rahasia.
Pengguna telah memilih Nominatim untuk fitur pencarian lokasi Field Shift;
endpoint ini bukan layanan geocoding generik untuk pihak ketiga.

Frontend hasil rebase sudah memakai submit Cari/Enter. Implementasi backend
ini tidak menambahkan pencarian tiap keystroke meskipun PRD menyebut debounce
pada deskripsi komponen. Jangan mengubah frontend menjadi autocomplete ketika
menggunakan endpoint layanan publik. Memilih penyedia Nominatim-kompatibel
lain atau self-host dapat dilakukan melalui environment, tanpa mengubah kode.

Rate gate menyimpan waktu request berikutnya dalam file, dengan flock untuk
proses/thread yang berbagi direktori cache. Berbagai query/bbox/User-Agent ke
host penyedia yang sama berbagi budget. Satu query yang diminta serentak
menggunakan lock tersendiri sehingga cukup satu panggilan penyedia.

Batas deployment: satu instance host dengan CACHE_DIR bersama antar-worker.
Beberapa replika dengan filesystem terpisah tidak berbagi pembatas ini;
gunakan limiter terpusat atau provider sendiri sebelum scale-out. Endpoint
mengembalikan 429 + Retry-After, bukan menumpuk antrean request ke penyedia.

## Cache dan galat

Cache disk menyimpan hasil normalisasi, waktu fetch, dan kedaluwarsa tujuh hari.
Hasil kosong juga disimpan. Query teks tidak ditulis ke nama file/metadata;
kunci SHA-256 mencakup query ternormalisasi, provider, bbox, bahasa dan versi.
Ini tidak mengubah access log HTTP server, yang dapat memuat query URL.

File JSON ditulis atomik. File rusak/di luar bentuk kontrak diabaikan dan
pengambilan diulang, mengikuti rate gate. Cache segar langsung dipakai tanpa
panggilan provider dan tanpa menghabiskan budget provider.

| Status | Kondisi |
| --- | --- |
| 200 | Hasil normal, hasil kosong, atau cache yang masih bisa dipakai |
| 400 | Query gagal validasi |
| 429 | Batas lokal atau provider; Retry-After diteruskan dalam detik |
| 502 | Provider/network/format respons gagal dan tidak ada cache |

Provider 429 memperpanjang cooldown bersama; tidak ada retry otomatis yang
mengirim request pencarian tambahan. Timeout HTTP 10 detik. Kegagalan provider
lain dapat memakai cache kedaluwarsa, dengan header `X-Geocode-Cache: stale`
dan `Warning: 110`. UI dapat memilih menampilkan catatan cache lama.
Tidak mengubah body respons dengan field metadata baru.

Header `X-Geocode-Cache` bernilai hit/miss/stale. Header `Link` menunjuk lisensi
OSM; `X-Geocode-Attribution` membawa kredit sumber. Swagger juga menampilkan
kredit. Detail internal provider tidak dikirim pada pesan galat pengguna.

Cache geocoding adalah cache runtime yang bisa dibuat ulang dari pencarian
pengguna. Tidak menambah bulk-download lokasi atau ZIP daftar tempat. Folder
hasil, lock, rate-state, dan probe diabaikan Git. Daftar archive POWER dan tanah
sebelumnya tidak berubah.

## Integrasi frontend yang perlu dilakukan pemilik FE

Kode frontend hasil rebase sudah mengirim `q` dan membaca body `results` dengan
bentuk yang tepat. Dua hal belum diubah karena scope task hanya backend:

1. `frontend/next.config.ts` masih default ke API port 4000. Jika FastAPI berjalan
   pada 8000, set `API_URL=http://127.0.0.1:8000` saat menjalankan Next.js dan
   restart prosesnya. Alternatifnya jalankan FastAPI pada 4000 untuk mengikuti
   proxy yang sekarang. Konfigurasi produksi harus menunjuk backend produksi.
2. Kredit peta yang ada hanya mencantumkan penyedia Esri. Tampilkan kredit
   `© OpenStreetMap contributors` dengan tautan copyright pada hasil pencarian
   atau area peta sebelum memakai layanan Nominatim publik pada UI/deployment.
   Header API saja bukan pengganti kredit yang terlihat pada frontend.

Tampilan hasil pencarian tetap bukan hasil analisis lahan; pengguna menggambar
polygon sesudah berpindah lokasi.

## Menjalankan dan memeriksa

Dari folder backend di WSL/Linux:

```bash
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Buka `/docs` untuk mencoba GET /api/v1/geocode atau:

```bash
curl --get --data-urlencode 'q=Purwodadi, Grobogan' http://127.0.0.1:8000/api/v1/geocode
```

Pengujian offline:

```bash
.venv/bin/python -m pytest -q
```

Satu smoke check nyata, hanya jika sengaja ingin mengecek layanan (bukan loop):

```bash
.venv/bin/python scripts/test_geocode_live.py
```

Smoke check pertama yang dijalankan pada task ini memberi 200, cache miss,
dan tiga hasil Purwodadi. Pemanggilan berikutnya memakai cache selama segar.
Tidak ada jaringan dalam tes otomatis. Backend tetap belum mendaftarkan
`/analyze`, `/crops`, atau chat pada task ini.


## Hasil verifikasi branch

- 157 tes offline lulus, mencakup validasi HTTP, rate gate bersama, coalescing
  request serentak, cache restart/expired/corrupt, 429 dan Retry-After, respons
  kosong, format provider rusak, timeout, serta normalisasi wilayah/koordinat.
- Smoke check nyata GET geocode: HTTP 200 dan tiga hasil Purwodadi.
- Baseline SoilGrids setelah rebase tetap berhasil pada tiga sampel cache nyata.
- Cache runtime/probe tidak ikut commit. PRD dan frontend tidak berubah.
