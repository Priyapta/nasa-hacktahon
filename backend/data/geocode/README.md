# Cache pencarian lokasi

`results/`: hasil normalisasi pencarian, TTL tujuh hari.
`locks/`: lock query untuk coalescing request.
`provider-*.json` / `provider-*.lock`: budget penyedia bersama antar-worker.
`probes/`: hasil smoke check manual dan pemeriksaan batas wilayah.

Seluruh state/cache/probe diabaikan Git; kode serta dokumentasi dilacak.
Tidak ada bulk geocoding atau paket ZIP baru. Direktori dapat dipindahkan
melalui CACHE_DIR. Lihat `../../contracts/geocode.md`.
