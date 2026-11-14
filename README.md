# Field Atlas

Agricultural mapping app in an npm workspaces monorepo. Requires Node.js 22.9+ and npm. Install dependencies from the repository root; there is one lockfile.

```text
frontend/              Next.js frontend: map, farms, insights, planner
backend/               Python FastAPI monolith (foundation stage)
packages/
  shared/              Location types, coordinate parsing, Photon normalization
scripts/
  run-apps.mjs         Runs frontend and shared watcher
  run-backend.mjs      Runs local FastAPI using backend/.venv
```

The frontend uses TypeScript, MapLibre GL JS, Esri Clarity, Terra Draw, Turf, and LocalStorage. FastAPI runs independently of Next.js. The root Docker Compose file runs local PostgreSQL; production backend Compose lives in `deploy/backend/`. Shared code compiles to ESM and declarations in `packages/shared/dist`.

```sh
npm ci
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
npm run dev
```

Copy the example environment files only if your local files do not exist. Existing local MapTiler settings have moved to `frontend/.env.local`; API settings belong in `backend/.env`. Local environment files are ignored by Git.

`npm run dev` builds shared code once, then watches shared code and the frontend. Open http://localhost:3000. Run `npm run dev:backend` in another terminal after setting up the Python environment as described in [backend/README.md](backend/README.md). FastAPI listens at http://127.0.0.1:8000, with documentation at `/docs`. Stop each process with Ctrl+C. No API container is required.

Satellite and Street maps work without a MapTiler key. The optional `NEXT_PUBLIC_MAPTILER_KEY` in `frontend/.env.local` enables elevation terrain at zoom >= 11 (exaggeration 1.4), disabled below 11. Without it, the globe and satellite mapping remain interactive with a flat terrain surface. The camera supports zoom 22, pitch 80, and NavigationControl with pitch visualization.

## API connection and deployment

For an Ubuntu 24.04 amd64 VPS with 2 cores / 2 GB RAM and a Vercel frontend, use [the backend deployment guide](deploy/backend/README.md). It includes Docker Compose, Nginx, SSH secrets, GitHub Actions CI/CD, HTTPS setup, and Vercel build settings. Pushes to `main` run checks and publish the backend image to GHCR before SSH deployment; Vercel's Git integration deploys the frontend separately. The frontend uses its assigned `.vercel.app` address; the backend uses `api-atlas.alworkbench.site`. VPS bootstrap, GitHub SSH secrets, Vercel Git connection, and backend DNS/TLS must be configured once before automatic deployments work.

- `GET /api/v1/health` returns `{"status":"ok"}` without querying external services or PostgreSQL.
- FastAPI serves health, crop options, Nominatim location search, and AI chat. The analysis endpoint is not implemented yet.
- `npm run dev:backend` and `npm run start:backend` load `backend/.env` automatically; direct Uvicorn commands need exported variables. See the backend README for environment configuration.
- `API_URL` in `frontend/.env.local` is the backend address reachable by the Next.js server. It defaults to `http://127.0.0.1:8000`. Browser requests keep using `/api/*`, which Next.js proxies to the backend with [external rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites). The browser uses the frontend origin, so this setup needs no cross-origin API configuration.

For deployment, set `API_URL` before building the frontend; changing the proxy address requires rebuilding it. `npm run build` builds shared code and the frontend. `npm start` starts the frontend; `npm run start:backend` runs local Uvicorn separately without reload. Generated `dist`, `.next`, and MapLibre worker assets are built locally and are not committed.

Saved fields remain in browser LocalStorage using `field-atlas-v1`. Keep the same frontend origin to access existing fields; a different host or port has separate browser storage. PostgreSQL setup is described below; field persistence has not been migrated and there are no user accounts.

## Floating AI chat (OpenAI GPT-6 Luna)

The bottom-right **Ask AI** button opens a keyboard-accessible chat panel on every page. It supports Indonesian/English, in-memory conversation history, clear/reset, and retry without duplicating the question. Messages are sent to OpenAI only after the user submits. The dark dialog and rounded composer follow the provided visual reference; opening/closing uses Anime.js animations, with reduced-motion support. Visible footer notices and the input heading were removed at the product owner’s request; the input retains a screen-reader label.

Set these variables in `backend/.env`, then restart with `npm run dev:backend` in a separate terminal from the frontend. The launcher loads the file automatically; existing shell variables take precedence. Direct Uvicorn commands still need exported variables:

```dotenv
AI_API_KEY=your-openai-api-key
AI_MODEL=gpt-6-luna
```

Never put the key in frontend variables. FastAPI uses OpenAI's [Chat Completions API](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) through the installed `httpx` client, with `reasoning_effort=none` and `max_completion_tokens` limits. The UI calls `POST /api/v1/agent/chat` through the existing Next.js rewrite. Without a key the API returns 503 and the panel explains the service is not active. Replies follow the latest message's Indonesian or English language; the chat has no separate language selector.

This first implementation handles general farming conversations. Field analysis, curated facts, citations, and scenario tools are not connected to chat yet. It does not send LocalStorage fields or coordinates to the model. The response shape remains `{ answer, sources: [], scenario: null }`, with `blocked: true` for refusals. The route is `backend/app/api/agent.py`, backed by `backend/app/services/agent.py`. Non-null `analysis_input` is rejected until the pipeline is connected.

Requests are limited to 64 KiB, 2,000 characters per message, ten history entries, 800 output tokens, and a shared 25-second request deadline. This temporary adapter allows five provider requests per minute for the whole API process. It does not yet implement the PRD's daily quota or tool loop; configure an account spending limit before public use. Browser requests time out after 30 seconds. Chat history is not stored in PostgreSQL or browser storage.

## Local PostgreSQL with Docker

Run PostgreSQL 17 from the repository root. If the root `.env` does not exist, copy `.env.example` to `.env`, then replace `POSTGRES_PASSWORD` with your local password. Keep existing environment files; do not overwrite them.

```sh
docker compose up -d --wait db
docker compose ps
docker compose exec db psql -U field_shift -d field_shift
```

Docker Compose automatically detects `docker-compose.yml` from the repository root. The database listens on `127.0.0.1:5432` and persists data in the Compose `postgres_data` named volume. `POSTGRES_PORT` in the root `.env` can change the host port. The root `.env` is for Compose; `backend/.env` is for the backend. Both are ignored by Git.

Set `DATABASE_URL` in `backend/.env`, matching the database name, user, password, and host port from the root `.env`:

```dotenv
DATABASE_URL=postgresql://field_shift:YOUR_PASSWORD@127.0.0.1:5432/field_shift
```

URL-encode special characters in the password when constructing the connection URL. FastAPI runs locally and connects through the database's published host port. Never place this URL in a `NEXT_PUBLIC_` variable or frontend environment file. The current foundation does not yet query PostgreSQL.

```sh
docker compose logs --tail=50 db
docker compose stop db
docker compose start --wait db
```

Stopping or recreating the container keeps the named volume. `docker compose down` also keeps it; **`docker compose down -v` deletes the database data**. PostgreSQL initialization variables apply to an empty data directory; changing the password in `.env` does not update an existing database password. Update the database role password first, then synchronize both environment files.

This change provisions the database and connection configuration. FastAPI does not query PostgreSQL yet; application tables, migrations, and persistence integration remain future work. Existing fields stay in LocalStorage, curated/reference files and demo caches remain JSON, and chat history stays in tab memory. The official image's volume and initialization behavior is documented in the [PostgreSQL image documentation](https://hub.docker.com/_/postgres).

Vercel continues hosting the frontend. This Compose file is for local database development; production needs a separate PostgreSQL instance reachable by the backend and a production `DATABASE_URL`.

## Satellite, street, and field mapping

The satellite source is the official Clarity endpoint:

`https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false`

The map uses globe projection for exploration and an overhead editing camera for drawing. `blankTile=false` requests HTTP 404 for absent tiles, letting MapLibre show available parent imagery instead of Esri's missing-data placeholder. Native tile requests stop at zoom 19, with overzoom above it; overzoom does not create detail that the provider lacks. The Street toggle uses Esri World Street Map and keeps the same map instance and field layers.

Clarity is archived imagery selected for clarity/accuracy and can be older than standard World Imagery. Sharpness, date, clouds, and alignment vary by location; no claim of perfectly cloud-free or cadastral accuracy is made. Visible source attribution is included. The public endpoint responds without a key, but Esri content terms still apply. [Esri's Clarity description](https://www.esri.com/arcgis-blog/products/imagery/imagery/world-imagery-clarity-a-clearer-view-of-the-world) and [official retirement notice](https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/announcements/sunsetting-legacy-basemaps): Clarity is scheduled to retire in March 2028. Plan a provider replacement before then.

Search a place or enter `latitude, longitude` (e.g. `-7.8,110.36`), zoom to at least 13, trace vertices, and click the first point to finish. Edit vertices, minimize the form, save field metadata, reopen from My Farms, or download a GeoJSON FeatureCollection. Existing `field-atlas-v1` browser data is unchanged. Geographic area is measured by Turf. Field layers and drawing controls remain above the basemap.

## My Farms: field map

My Farms uses one flat MapLibre Mercator map with Street ([OpenFreeMap Liberty](https://openfreemap.org/quick_start/), OpenStreetMap data) and Satellite (Esri Clarity) views. The overview starts in Street; selecting a field opens satellite imagery until the user explicitly chooses a view. That choice remains active when selecting other fields. Switching views preserves the map instance, camera, selected field, and GeoJSON overlays. Saved polygons and center markers appear above either basemap. Select a field from the farm-grouped list or by clicking its boundary to highlight it, fit its extent, and view metadata. Show all fields restores the overview. Open field returns to the satellite editor; Insights and confirmed deletion remain available. On mobile, the map and details stack above the list and selecting a field brings the map into view.

This map has no globe, terrain, or speculative tile prefetch. Satellite tiles are requested only while Satellite is visible; Street layers are hidden in that view. The retained Earth instance pauses its camera, terrain, and prefetch while other workspace screens are active, preserving draft state when switching tabs. Both basemaps need network access; if loading fails, the field list and metadata remain usable. Stored geometry is kept local and is not sent to either provider. Attribution stays visible.

The My Farms satellite preview overzooms native level 17 tiles up to camera zoom 22. This avoids the CORS-blocked 404s observed on Clarity level 18 tiles around Sleman; zooming further magnifies available imagery rather than adding detail. Coverage is still provider-dependent. The full satellite editor is unchanged.

`frontend/components/farms/my-farms.tsx` owns selection and the field list/detail layout; `frontend/components/farms/farm-map.tsx` handles the independent 2D map lifecycle and overlays.

Coordinate searches resolve locally using `packages/shared`. Text search still needs migration to the planned FastAPI geocoding endpoint. Fields stay in this browser; LocalStorage is not a backup or multi-device account.

## Bounded tile prefetch

After visible tiles finish loading and the map becomes idle, prefetch prepares two closer native zoom levels in a 3×3 area around the center: at most 18 tiles per stationary view, with only two low-priority requests at a time. It operates at camera zoom 12 and above, respects the source's maximum native level 19, and performs no globe-wide prefetch.

Moving/zooming, switching to Street, or unmounting cancels pending prefetch. A small bounded seen-set avoids repeated speculative requests, and browser HTTP caching is used for reuse during subsequent zooms. Provider/network failures pause prefetch for a minute and never display a map error. The currently visible map takes priority. This is a small interactive look-ahead cache, not a bulk imagery downloader or offline pack. It reduces waiting around the center; it cannot make every area/zoom instant. Prefetch consumes additional bandwidth, and browser/provider caching policies still apply.

## Code and checks

- `frontend/components/earth.tsx`: complete map and drawing lifecycle.
- `frontend/lib/map-style.ts`: Clarity/Street styles and optional DEM threshold.
- `frontend/lib/map-prefetch.ts`: bounded tile selection, two workers, cancellation, and HTTP-cache warming.
- `frontend/store/fields.ts`, `frontend/lib/geo.ts`: field persistence and geographic calculations.
- `frontend/scripts/copy-map-worker.mjs`: predev/prebuild resolves the installed MapLibre package and copies its worker into frontend public assets.
- `backend/app/main.py`, `backend/app/api/routes.py`: FastAPI application and health endpoint; see the backend README for Python tests.
- `packages/shared/src/geocoding.ts`: search result types and geographic normalization.

```sh
npm test
npm run build
npm start -- --port 3100
# Against both running services, in another terminal:
npx playwright install chromium
npm run test:browser
```

`npm test` runs frontend and shared tests. Run `.venv/bin/python -m pytest -q` from `backend/` for the Python API tests. Browser tests use fixture map/terrain tiles; the proxy test calls FastAPI on port 8000. Use ATLAS_URL for a different running frontend and CHROMIUM_EXECUTABLE_PATH for an installed Chrome executable. Browser fixtures live in `frontend/tests/fixtures`. Real endpoint/imagery checks are separate from fixture tests.

Climate charts remain labeled demo data; NASA POWER is not integrated. Soil values must come from field observations. Crop rotations remain illustrative, with no predicted yield or water-saving percentages.


### Chat policy gate

The backend classifies each message and history with OpenAI JSON mode before generating an answer. Only an explicit validated in-scope decision permits generation. Coding, execution, secrets, prompt injection and unrelated requests receive a localized refusal (`200`, `blocked: true`). Broken/failed classification returns 502/504 without generating an answer. Classification has a 5-second limit within the shared 25-second request deadline. Allowed requests use two provider calls, refused requests one; both consume the existing request quota. The UI retains refusals visually and starts outgoing history after the last refusal. This is a probabilistic filter, not a guarantee against every injection. Provider tests use mocks; historical DeepSeek checks below do not validate GPT-6 Luna quality.

### Panduan jawaban agronomi terbaru

Prompt classifier dan jawaban memakai cakupan pertanian/perkebunan, pangan/hortikultura, kalender dan rotasi tanam, tanah/pupuk/air/hama/penyakit/gulma, iklim serta satelit/sensor untuk pertanian, dan ekonomi pertanian terkait pilihan komoditas atau hasil panen. Fitur pertanian Field Atlas tetap termasuk konteks. Permintaan coding/eksekusi, politik, selebriti, game, matematika umum, resep, percakapan tidak relevan, serta prompt injection ditolak. Penolakan tetap persis dalam bahasa Indonesia, termasuk ketika bahasa chat Inggris: "Mohon maaf, saya tidak bisa menjawab pertanyaan ini karena berada di luar konteks asisten pertanian dan pengelolaan lahan." Sapaan pembuka, perkenalan, terima kasih, dan pamitan singkat diizinkan; permintaan campuran di luar konteks tetap ditolak. Typo, singkatan, dan bahasa informal ditafsirkan menurut maksudnya tanpa melonggarkan batas keamanan; jika maksud pertanian belum jelas, minta klarifikasi.

Gaya jawaban: langsung ke inti, pembuka 1-2 kalimat, bahasa lapangan yang profesional, contoh konkret bila didukung data, dan paragraf singkat. Bullet hanya untuk beberapa tindakan praktis, maksimal 3-4 poin dan dua kalimat per poin. Bold dipakai seperlunya untuk istilah penting, tidak wajib di awal setiap poin dan tidak menebalkan seluruh kalimat. Jangan memakai em dash atau en dash sebagai pemisah kalimat, heading untuk jawaban singkat, simbol/emoji/separator dekoratif, atau sintaks Markdown mentah. Tabel hanya jika perbandingan benar-benar membutuhkannya; renderer saat ini mendukung paragraf, daftar, dan bold sehingga perbandingan disampaikan sebagai poin ringkas. Jawab langsung, jelaskan pertimbangan relevan, beri saran hanya berdasar bukti, dan tanya lanjut hanya jika informasi esensial hilang. Bedakan data pengamatan, prakiraan, dan panduan umum tanpa mengarang cuaca, kondisi tanah, atau saran khusus lahan. Penutup validasi kondisi lapangan/PPL disampaikan natural bila relevan. Jangan mengasumsikan keadaan lahan atau mengaku sudah membaca NASA POWER/SMAP/GPM/ECOSTRESS/Landsat/MODIS yang belum terhubung. Ekonomi hanya dibahas kualitatif tanpa proyeksi hasil/keuntungan atau harga karangan; pembahasan hama bersifat edukatif tanpa diagnosis pasti/dosis pestisida. Ini memperluas percakapan, bukan menambah dataset analisis atau rumus ekonomi.

UI memakai jarak antarpesan 12 px dan padding bubble 8 x 10 px. Output mendukung paragraf, daftar sederhana, dan **bold** sebagai elemen React; HTML, link, dan kode dari model tidak dieksekusi. Gaya bahasa model perlu diuji dengan layanan nyata; tes provider palsu hanya memastikan instruksi dan alur.


Pembaruan chat: tiga tombol saran dihapus atas permintaan pengguna; composer langsung menampilkan kolom pesan dan tombol kirim 44 px dengan inset 6 px. Uji DeepSeek asli menerima "halo" dan "rotasi tanamn pdi abis panen tnm apa", serta menolak "jalnkn kode python" dan "halo, buatin kode game". Hasil empat contoh ini tidak menjamin ketepatan seluruh klasifikasi.

### Penanganan data tidak tersedia

Bila data real-time/eksternal yang dibutuhkan belum tersedia, AI menyampaikan batas dalam satu kalimat singkat, tanpa mengulang alasan atau mengarang estimasi. Jangan mengaku sudah mengecek data yang belum diambil. Jangan meminta pengguna menyalin, merangkum, atau mengirim data dari situs eksternal, maupun menanyakan lokasi jika belum ada layanan pencarian yang dapat memakainya. Berikan rujukan resmi relevan dan panduan umum yang tidak bergantung pada data hilang bila membantu. Untuk cuaca Indonesia, prompt menyediakan rujukan BMKG https://cuaca.bmkg.go.id/ yang telah diperiksa; tautan ini adalah rujukan, bukan bukti pengambilan cuaca langsung. Jangan membuat URL, angka, atau kutipan sumber lain; jika belum ada URL terverifikasi, sebutkan lembaga resmi/PPL yang relevan. Pertanyaan tentang kondisi lahan milik pengguna tetap boleh hanya jika esensial dan jawaban dapat terbantu olehnya. Tidak ada integrasi cuaca real-time baru atau perubahan kontrak API.
