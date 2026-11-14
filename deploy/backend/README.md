# Backend di Ubuntu 24.04 LTS

Konfigurasi untuk VPS 2 core / RAM 2 GB. FastAPI berjalan dengan **satu worker**, Nginx menerima HTTPS, dan systemd menjalankan ulang proses bila gagal. Frontend dibangun di Vercel; server ini tidak membutuhkan Node, npm, Docker, atau PostgreSQL untuk endpoint yang tersedia sekarang.

```text
Browser → Vercel /api/* → HTTPS Nginx → 127.0.0.1:8000 FastAPI → DeepSeek/Nominatim
```

API yang tersedia: health, katalog tanaman, geocode, dan chat umum. Endpoint analisis dan tool chat belum tersedia. Kuota chat awal berlaku untuk seluruh proses: lima request per menit. Cache geocode persisten berada di `/var/lib/field-shift/geocode`.

## 1. Instal aplikasi

Jalankan di VPS lewat SSH sebagai pengguna yang memiliki `sudo`. Contoh branch ini memuat konfigurasi sebelum PR digabung; sesudah merge, gunakan `--branch main`.

```bash
sudo apt-get update
sudo apt-get install -y python3-venv git nginx certbot python3-certbot-nginx
sudo adduser --system --group --home /var/lib/field-shift --no-create-home field-shift
sudo git clone --branch feat/field-planning-agent-ux https://github.com/Priyapta/nasa-hacktahon.git /opt/field-shift
sudo python3 -m venv /opt/field-shift/backend/.venv
sudo /opt/field-shift/backend/.venv/bin/python -m pip install --only-binary=:all: -r /opt/field-shift/backend/requirements.lock.txt
```

Lockfile produksi mengikuti versi yang diuji pada lockfile pengembangan, tanpa pytest. Opsi `--only-binary` menghindari kompilasi paket geospasial di VPS kecil; bila wheel tidak tersedia untuk arsitektur server, instalasi berhenti agar kebutuhan build dapat diperiksa.

## 2. Pasang service dan environment

```bash
sudo install -d -m 0750 /etc/field-shift
sudo install -m 0600 /opt/field-shift/deploy/backend/.env.example /etc/field-shift/backend.env
sudoedit /etc/field-shift/backend.env
sudo install -m 0644 /opt/field-shift/deploy/backend/field-shift.service /etc/systemd/system/field-shift.service
sudo systemd-analyze verify /etc/systemd/system/field-shift.service
sudo systemctl daemon-reload
sudo systemctl enable --now field-shift
curl --fail http://127.0.0.1:8000/api/v1/health
```

Isi `AI_API_KEY` di file environment server. Tanpa key, health tetap bekerja dan chat mengembalikan 503. systemd membaca file tersebut sebagai root; proses aplikasi memakai pengguna `field-shift`. Jangan memasukkan key ke Git atau environment frontend.

Batas memori service: `MemoryHigh=900M`, `MemoryMax=1200M`, dan swap maksimal 256 MB bila server memiliki swap. Ini menyisakan ruang bagi OS/Nginx, bukan jaminan kapasitas analisis. Jangan menjalankan unduhan arsip nasional atau batch raster bersamaan di VPS ini. Kode aplikasi hanya dibaca; direktori state systemd dan temporary directory boleh ditulis.

## 3. Nginx dan domain

Frontend memakai alamat bawaan Vercel. Hanya backend yang memakai subdomain `alworkbench.site`, sehingga domain utama tetap bisa dipakai untuk proyek lain:

| Alamat | Tujuan | Record DNS |
| --- | --- | --- |
| Alamat project `.vercel.app` dari Vercel | Frontend Vercel | Dikelola Vercel, tanpa record DNS domain sendiri |
| `api-atlas.alworkbench.site` | Backend VPS | A `api-atlas` ke IPv4 VPS |

Tidak perlu menambahkan custom domain atau record CNAME untuk frontend. Gunakan alamat `.vercel.app` yang diberikan setelah deployment. Domain utama dan subdomain proyek lain tidak perlu diubah. Service dapat diuji melalui SSH memakai health lokal sebelum DNS/TLS aktif.

Arahkan DNS A `api-atlas` ke IPv4 VPS. Buat record AAAA hanya jika IPv6 server benar-benar aktif. Konfigurasi Nginx sudah memakai `server_name api-atlas.alworkbench.site`:

```bash
sudo install -m 0644 /opt/field-shift/deploy/backend/nginx.conf /etc/nginx/sites-available/field-shift
sudo ln -s /etc/nginx/sites-available/field-shift /etc/nginx/sites-enabled/field-shift
sudo nginx -t
sudo systemctl reload nginx
```

Izinkan TCP 80/443 di firewall VPS/provider; port 8000 tetap lokal. Bila UFW sudah dipakai, tambahkan `sudo ufw allow 'Nginx Full'`. Jika baru hendak mengaktifkan UFW, izinkan port SSH yang benar terlebih dahulu agar sesi tidak terputus.

Setelah DNS API mengarah ke server:

```bash
sudo certbot --nginx -d api-atlas.alworkbench.site --redirect
sudo certbot renew --dry-run
curl --fail https://api-atlas.alworkbench.site/api/v1/health
```

Certbot memasang konfigurasi TLS dan redirect HTTPS. Timeout proxy 35 detik melebihi deadline chat 25 detik. Log akses dimatikan agar query pencarian tidak tersimpan di access log; galat proses tersedia di journal.

## 4. Hubungkan Vercel

Untuk project frontend: pilih root directory `frontend`, aktifkan akses file di luar root directory karena memakai workspace `packages/shared`, dan gunakan preset Next.js. Set Install Command ke `cd .. && npm ci` dan Build Command ke `cd .. && npm run build`. Build root menyiapkan `packages/shared/dist` sebelum frontend; output frontend tetap `.next` relatif terhadap root directory `frontend`.

Tambahkan environment variable **server-side** di Vercel:

```dotenv
API_URL=https://api-atlas.alworkbench.site
```

Jangan tambahkan `/api/v1` di belakang URL. Set untuk Production dan Preview bila dibutuhkan, lalu redeploy frontend: Next.js menanam tujuan rewrite saat build. Jangan memakai `NEXT_PUBLIC_API_URL` atau menaruh `AI_API_KEY` di Vercel. Browser tetap mengakses `/api/*` pada origin frontend melalui rewrite; tidak perlu CORS wildcard.

## 5. Pembaruan dan pemeriksaan

```bash
sudo git -C /opt/field-shift pull --ff-only
sudo /opt/field-shift/backend/.venv/bin/python -m pip install --only-binary=:all: -r /opt/field-shift/backend/requirements.lock.txt
sudo systemctl restart field-shift
sudo systemctl status field-shift --no-pager
sudo journalctl -u field-shift -n 80 --no-pager
curl --fail http://127.0.0.1:8000/api/v1/health
```

Health membuktikan proses berjalan, bukan koneksi provider. Uji satu pertanyaan chat pertanian lewat frontend setelah key terpasang. Jika restart gagal, lihat journal; bila unit terkena batas restart, perbaiki penyebab lalu jalankan `sudo systemctl reset-failed field-shift` dan `sudo systemctl start field-shift`.

Referensi: [Uvicorn settings](https://uvicorn.dev/settings/), [systemd resource control](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html), [systemd environment/state directories](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html), [Nginx proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html), [Vercel external rewrites](https://vercel.com/docs/routing/rewrites), [Vercel domain dan CNAME](https://vercel.com/docs/domains/working-with-domains/add-a-domain).
