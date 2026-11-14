# Docker backend dan CI/CD

Untuk Ubuntu 24.04 LTS **amd64**, 2 core / RAM 2 GB. Frontend memakai alamat `.vercel.app`; backend memakai `api-atlas.alworkbench.site`.

```text
Push/merge main
  GitHub Actions → tes frontend/backend → build image → GHCR → SSH → VPS Docker Compose
  Vercel Git integration → build frontend → production .vercel.app

Browser → Vercel /api/* → HTTPS Nginx → 127.0.0.1:8000 → container FastAPI
```

Image dibangun di GitHub, bukan di VPS. Backend memakai satu worker, batas memori 1200 MB, reservasi 900 MB, maksimum CPU 1,5 core, dan log berotasi. Cache geocode memakai named volume sehingga tetap ada ketika container diganti. `restart: unless-stopped` menghidupkan kembali container setelah Docker/VPS reboot, kecuali sebelumnya sengaja dihentikan.

Health membuktikan API berjalan, bukan koneksi provider. Chat membutuhkan `AI_API_KEY` dan masih berupa percakapan pertanian umum; analisis/tool belum terhubung. Kuota chat awal lima request per menit untuk seluruh proses. Jangan menjalankan batch arsip nasional/raster di VPS ini bersamaan dengan API.

## 1. Persiapan VPS sekali saja

Instal **Docker Engine dan Compose plugin** melalui [panduan resmi Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Jangan gunakan Docker Desktop di VPS. Periksa:

```bash
docker --version
docker compose version
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Pakai akun SSH deployment yang dapat menjalankan Docker. Bila memakai grup `docker`, tambahkan pengguna lalu login SSH ulang:

```bash
sudo usermod -aG docker "$(id -un)"
```

Akses grup Docker setara hak root; gunakan key SSH khusus deployment. Setelah login ulang, jalankan sebagai pengguna deployment:

```bash
docker info
sudo install -d -o "$(id -un)" -g "$(id -gn)" -m 0750 /opt/field-shift
```

Jika konfigurasi systemd aplikasi sebelumnya sudah dipasang, hentikan agar tidak berebut port 8000: `sudo systemctl disable --now field-shift`. Tidak perlu unit systemd khusus aplikasi lagi. Pastikan Docker Engine sendiri aktif otomatis saat boot; instalasi resmi Ubuntu mengaktifkannya secara default.

Repo privat tidak perlu di-clone di VPS. Dari checkout repo di komputer Anda, kirim file awal berikut, dengan mengganti `DEPLOY_USER` dan `VPS_IP`:

```bash
scp deploy/backend/.env.example DEPLOY_USER@VPS_IP:/opt/field-shift/backend.env
scp deploy/backend/nginx.conf DEPLOY_USER@VPS_IP:/opt/field-shift/nginx.conf
```

Di VPS:

```bash
chmod 600 /opt/field-shift/backend.env
nano /opt/field-shift/backend.env
```

Isi `AI_API_KEY`. File ini hanya disimpan di VPS, tidak dikirim lewat GitHub Actions. Workflow hanya memperbarui `compose.yaml` dan `deploy.sh`. Tidak perlu memasang Python, npm, atau PostgreSQL di host untuk endpoint saat ini.

## 2. SSH untuk GitHub Actions

Buat key deployment di komputer yang Anda percaya; simpan private key di GitHub, bukan di repo:

```bash
ssh-keygen -t ed25519 -f ./atlas-deploy -C atlas-github-actions
ssh-copy-id -i ./atlas-deploy.pub DEPLOY_USER@VPS_IP
```

Jangan pakai passphrase untuk key otomatis ini; jangan membagikan private key lewat chat. Key pribadi SSH harian Anda tidak perlu dipakai. Daftarkan secret berikut di **repository → Settings → Secrets and variables → Actions**:

| Nama secret | Isi |
| --- | --- |
| `VPS_HOST` | IP publik atau hostname SSH VPS |
| `VPS_USER` | Pengguna deployment pemilik `/opt/field-shift` |
| `VPS_SSH_KEY` | Seluruh isi private key `atlas-deploy` |
| `VPS_KNOWN_HOSTS` | Baris host key SSH VPS yang sudah diverifikasi |

Bila port SSH bukan 22, tambahkan **Actions variable** `VPS_PORT` dengan port sebenarnya. Gunakan port yang sama saat `scp`, `ssh-copy-id`, dan pengambilan host key.

Ambil kandidat host key dari komputer Anda:

```bash
ssh-keyscan -H -t ed25519 VPS_IP
```

Verifikasi fingerprint melalui console VPS/provider dengan `sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` sebelum mempercayainya. `ssh-keyscan` sendiri tidak memverifikasi identitas server. Salin baris yang sudah diverifikasi ke `VPS_KNOWN_HOSTS`; untuk port nonstandar gunakan `ssh-keyscan -p PORT -H -t ed25519 VPS_IP`.

Workflow memakai `StrictHostKeyChecking=yes`, sehingga tidak menerima host key asing secara otomatis. Repo ini privat; image juga bisa tetap privat. Workflow memakai `GITHUB_TOKEN` bawaan untuk publish/pull GHCR, lalu mengirim token sementara lewat stdin SSH. Kredensial registry sementara di VPS dibersihkan setelah deploy; tidak perlu PAT registry permanen di VPS.

Image akan bernama `ghcr.io/priyapta/nasa-hacktahon-api`. Jika package sudah pernah dibuat tanpa terhubung ke repo, beri repository ini akses Actions pada pengaturan package GHCR. Untuk package baru, label source repo pada workflow menghubungkannya ke repo.

## 3. Trigger otomatis dan penanganan kegagalan

Workflow `.github/workflows/ci-deploy.yml` menjalankan tes/build pada PR ke `main`. Setelah push/merge ke `main`, job deployment berjalan **setelah checks lulus**. Workflow juga bisa dijalankan manual dari tab Actions dengan memilih branch `main`.

GitHub membangun image `linux/amd64`, menandainya dengan SHA commit, lalu mengirim digest pastinya ke VPS. VPS menarik image dan menunggu healthcheck maksimal 120 detik. Hanya deployment sehat yang dicatat di `.release.env`; image sebelumnya dicatat di `.previous.env`. Jika image baru gagal sehat, script mencoba mengembalikan image sebelumnya dan job tetap gagal agar terlihat di Actions. Pada deployment pertama yang gagal, container dihentikan. Volume cache tidak dihapus.

Deployment backend diantrekan agar tidak saling memotong. Workflow commit lama yang sudah didahului commit `main` lebih baru tidak akan mengganti server. Deployment bisa menyebabkan jeda singkat karena hanya ada satu container. Rollback ini untuk image aplikasi; perubahan database atau konfigurasi yang tidak kompatibel tetap memerlukan penanganan tersendiri.

## 4. Nginx dan HTTPS

Arahkan record DNS **A `api-atlas`** pada `alworkbench.site` ke IPv4 VPS. Tambahkan AAAA hanya jika IPv6 benar-benar aktif. Frontend `.vercel.app` tidak memerlukan record DNS domain Anda.

Di VPS:

```bash
sudo install -m 0644 /opt/field-shift/nginx.conf /etc/nginx/sites-available/field-shift
sudo ln -s /etc/nginx/sites-available/field-shift /etc/nginx/sites-enabled/field-shift
sudo nginx -t
sudo systemctl reload nginx
```

Port 8000 dipublikasikan hanya di loopback host. Port publik yang dibutuhkan adalah 80/443 dan port SSH Anda. Bila memakai UFW, izinkan `Nginx Full`; jangan mengaktifkan firewall sebelum mengizinkan SSH yang benar.

Setelah DNS mengarah ke VPS dan backend sudah berhasil deploy:

```bash
curl --fail http://127.0.0.1:8000/api/v1/health
sudo certbot --nginx -d api-atlas.alworkbench.site --redirect
sudo certbot renew --dry-run
curl --fail https://api-atlas.alworkbench.site/api/v1/health
```

Nginx tetap dipasang sekali di host; GitHub Actions tidak menimpa konfigurasi TLS Certbot pada setiap push. Timeout proxy 35 detik melebihi deadline chat 25 detik. Trust proxy Uvicorn berlaku di jaringan container; pemetaan port host tetap hanya `127.0.0.1`.

## 5. Vercel auto-deploy

Import repo GitHub ini ke Vercel dan pilih:

| Pengaturan | Nilai |
| --- | --- |
| Framework | Next.js |
| Root Directory | `frontend` |
| Include files outside Root Directory | Aktif |
| Install Command | `cd .. && npm ci` |
| Build Command | `cd .. && npm run build` |
| Production Branch | `main` |
| Environment `API_URL` | `https://api-atlas.alworkbench.site` |

Build root menyiapkan `packages/shared/dist` sebelum frontend; output tetap `.next` relatif ke `frontend`. Pilih alamat `.vercel.app` bawaan. Set `API_URL` untuk Production dan Preview bila diperlukan; jangan memakai prefix `NEXT_PUBLIC_` atau mengisi key AI di Vercel.

`frontend/vercel.json` menyimpan framework, install command, dan build command di repo agar tidak bergantung pada override manual dashboard. Root Directory tetap harus `frontend` di pengaturan project. Jika muncul error tidak menemukan `pages`, periksa root tersebut, gunakan commit terbaru, dan redeploy tanpa build cache. Aplikasi ini menggunakan `frontend/app`, sehingga tidak perlu membuat folder `pages` baru.

Pertahankan versi Next.js yang eksplisit di `frontend/package.json`. Rentang `"*"` cocok dengan versi Next 7 dalam deteksi legacy Vercel; builder kemudian mengubah manifest sebelum install sehingga `npm ci` menolak lockfile modern. Saat memperbarui Next/React, sinkronkan lockfile dan uji instalasi bersih/build.

Integrasi Git Vercel otomatis membangun Production saat `main` berubah, dan Preview untuk branch/PR. Tidak perlu GitHub secret `VERCEL_TOKEN` atau deploy hook tambahan. Jalur deployment frontend dan backend berjalan terpisah; Vercel tidak menunggu job checks GitHub secara otomatis. Jadikan job `checks` wajib lewat branch protection/ruleset `main` agar perubahan melalui PR sudah diuji sebelum merge.

## 6. Operasional setelah deploy pertama

Sebagai pengguna deployment di VPS:

```bash
cd /opt/field-shift
docker compose --env-file .release.env -f compose.yaml ps
docker compose --env-file .release.env -f compose.yaml logs --tail 80 api
docker compose --env-file .release.env -f compose.yaml restart api
curl --fail http://127.0.0.1:8000/api/v1/health
```

Untuk rollback manual tanpa menarik ulang image yang sudah ada:

```bash
docker compose --env-file .previous.env -f compose.yaml up -d --wait --pull never api
cp .previous.env .release.env
```

Periksa hasil perintah sebelum menyalin `.previous.env`. Jika env/key AI berubah, jalankan `docker compose --env-file .release.env -f compose.yaml up -d --force-recreate --wait api`, bukan hanya restart. Jangan hapus named volume atau image release sebelumnya; rollback membutuhkannya. Pantau ruang disk dan bersihkan image lama secara berkala sambil mempertahankan image aktif dan sebelumnya.

Referensi: [Docker production Compose](https://docs.docker.com/compose/how-tos/production/), [restart policy](https://docs.docker.com/engine/containers/start-containers-automatically/), [GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry), [Vercel Git deployments](https://vercel.com/docs/git), [Nginx proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).
