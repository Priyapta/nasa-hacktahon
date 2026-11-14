# Cache SoilGrids lokal

`raw/`: subset raster native 250m dan metadata JSON, bukan hasil sintesis.
`results/`: ringkasan polygon yang dapat dihitung ulang.
`probes/`: pemeriksaan akses awal; bukan bagian paket deployment.
`samples.json`: tiga polygon kecil untuk pengujian (dilacak Git).
`prepare-status.json`: status persiapan data sampel (lokal).

Rincian metode dan batasan ada di `../../contracts/soilgrids-data.md`.
Raw, hasil, probe, log, status dan lock diabaikan Git. Paket untuk dibagikan
akan didaftarkan di `../../cache-archives/`.
