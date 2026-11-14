# Perubahan kontrak lokasi: Polygon

Perubahan ini diminta pengguna pada 14 November 2026 dan telah dikomunikasikan
pengguna kepada tim. Ini adalah pengecualian yang disetujui terhadap bentuk
lokasi satu titik pada PRD bagian 7. Dokumen PRD tidak diedit. Perubahan kode,
fixture, schema, dependensi, dan dokumentasi dibatasi ke direktori `backend/`.
Aturan input lain dan bentuk hasil analisis tetap mengikuti kontrak sebelumnya.

## Bentuk yang dikirim frontend

`location` langsung memuat **geometry GeoJSON Polygon**, sesuai objek geometry
polygon di frontend. Bukan pembungkus Feature atau FeatureCollection.

```json
{
  "location": {
    "type": "Polygon",
    "coordinates": [
      [
        [110.90, -7.10],
        [110.92, -7.10],
        [110.92, -7.08],
        [110.90, -7.08],
        [110.90, -7.10]
      ]
    ]
  }
}
```

Contoh di atas hanya bagian lokasi. Input lengkap masih memerlukan `rotation`,
`time`, dan `water_source`, serta `lang` opsional pada `/analyze`.
Koordinat berurutan **[longitude, latitude]** dalam derajat geografis WGS84,
bukan `[lat, lon]`. Posisi dua dimensi saja; altitude tidak diterima.
Ring pertama adalah batas luar. Ring berikutnya, jika ada, adalah lubang
(interior rings); semuanya dipertahankan. Arah ring tidak diubah/dipaksakan.

Bentuk ini dipakai bersama oleh:

- `AnalysisInput.location` untuk `/analyze`;
- `ChatInput.analysis_input.location` jika konteks chat ada;
- `ChatResponse.scenario.input.location` jika ada hasil simulasi.

Input lama `{ "lat": ..., "lon": ... }` ditolak. `Point`, `MultiPolygon`,
`Feature`, dan `FeatureCollection` juga ditolak. Ini perubahan kontrak yang
memutus kompatibilitas payload titik lama; FE harus mengirim geometry polygon.
`analysis_input=null` untuk chat umum tetap diperbolehkan.
Hasil `/geocode` tetap titik pusat untuk navigasi pencarian peta; hasil pencarian
bukan batas lahan, sehingga bentuk `results[].center` tidak diubah.

## Validasi di backend

- Semua koordinat angka terbatas; string, boolean, NaN, dan infinity ditolak.
- Longitude -180 sampai 180, latitude -90 sampai 90.
- Minimal satu ring, setiap ring minimal empat posisi termasuk titik penutup.
- Ring tertutup secara eksplisit dan memiliki minimal tiga titik berbeda.
- Polygon harus memiliki area positif dan topologi valid: batas tidak boleh
  berpotongan sendiri; lubang harus valid terhadap batas dan lubang lainnya.
- Geometry tidak diperbaiki otomatis dan tidak dikonversi menjadi titik.

Validasi topologi menggunakan Shapely/GEOS, bukan algoritme persilangan buatan.
Dokumentasi: [Polygon](https://shapely.readthedocs.io/en/stable/reference/shapely.Polygon.html),
[is_valid_reason](https://shapely.readthedocs.io/en/stable/reference/shapely.is_valid_reason.html).
Pemeriksaan area/topologi dilakukan pada bidang koordinat untuk validasi saja;
`geometry.area` tidak digunakan/dilaporkan sebagai luas hektare. Penanganan
geodesik atau area melintasi antimeridian perlu dirinci saat implementasi data
area; pemeriksaan ini belum membuktikan validitas metode analisis spasial.

Galat mengikuti handler yang sudah ada: HTTP 400 dan `detail` berisi lokasi
field serta pesan. Validasi lintas koordinat berada pada `location.coordinates`.
Wilayah demo tidak dijadikan batas penolakan schema. Kebijakan peringatan
wilayah untuk polygon akan diterapkan pipeline, tanpa mengubah aturan PRD
bahwa lokasi di luar wilayah demo tidak langsung ditolak.

## Pengambilan NASA POWER dan SoilGrids belum diputuskan

Penerimaan polygon **tidak berarti analisis area sudah tersedia**. Backend belum
memilih centroid, titik interior, beberapa sampel, ataupun agregasi semua grid.
Tidak ada penghitungan centroid atau penyusutan polygon menjadi titik pada
perubahan ini. Tidak ada service data atau cache spasial yang sudah aktif.

Sebelum BE-03/BE-04 dapat dinyatakan mendukung area, tim perlu menetapkan metode
spasial, penanganan beberapa grid, kunci cache, dan metadata untuk menjelaskan
cakupan data yang diambil. Jangan mengklaim satu titik sebagai statistik seluruh
lahan. Aturan mesin rotasi yang tidak terkait representasi lokasi tetap sama.

## Setup dan verifikasi

Ada dependensi runtime baru `shapely` dan dependensi transitifnya `numpy`.
Dari direktori backend, perbarui environment yang sudah ada:

```bash
.venv/bin/python -m pip install -r requirements-dev.lock.txt
.venv/bin/python scripts/export_contracts.py
.venv/bin/python -m pytest -q
```

Fixture analisis, konteks chat, dan input skenario telah dimigrasikan. JSON Schema
`AnalysisInput`, `ChatInput`, dan `ChatResponse` diekspor ulang. `/docs` masih hanya
menampilkan endpoint aktif; `/analyze` dan chat tidak didaftarkan sebagai stub.
