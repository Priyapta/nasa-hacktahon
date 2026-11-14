# Field Atlas

Agricultural mapping app in an npm workspaces monorepo. Requires Node.js 22.9+ and npm. Install dependencies from the repository root; there is one lockfile.

```text
frontend/              Next.js frontend: map, farms, insights, planner
backend/               Standalone Node.js HTTP backend: location search
packages/
  shared/              Location types, coordinate parsing, Photon normalization
scripts/
  run-apps.mjs         Runs and stops the app processes together
```

The frontend uses TypeScript, MapLibre GL JS, Esri Clarity, Terra Draw, Turf, and LocalStorage. The backend runs independently of Next.js and has its own environment and build output. Shared code compiles to ESM and declarations in `packages/shared/dist`.

```sh
npm ci
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
npm run dev
```

Copy the example environment files only if your local files do not exist. Existing local MapTiler settings have moved to `frontend/.env.local`; API settings belong in `backend/.env`. Local environment files are ignored by Git.

`npm run dev` builds shared code once, then watches shared code, the API, and the frontend together. Open http://localhost:3000. The API listens at http://127.0.0.1:4000. Ctrl+C stops all processes. To run them in separate terminals, use `npm run dev:backend` and `npm run dev:frontend`; after editing shared code in this mode, run `npm run build --workspace @field-atlas/shared`.

Satellite and Street maps work without a MapTiler key. The optional `NEXT_PUBLIC_MAPTILER_KEY` in `frontend/.env.local` enables elevation terrain at zoom >= 11 (exaggeration 1.4), disabled below 11. Without it, the globe and satellite mapping remain interactive with a flat terrain surface. The camera supports zoom 22, pitch 80, and NavigationControl with pitch visualization.

## API connection and deployment

- `GET /health` on the API returns its service status.
- `GET /api/geocode?q=Yogyakarta` validates the query, calls Photon, and returns normalized results. Invalid queries return 400, rapid requests return 429 with `Retry-After`, and provider failures return 502. A bounded in-memory cache retains up to 100 searches for 24 hours. The throttle and cache are per process.
- `API_PORT`, `API_HOST`, and optional `PHOTON_API_URL` live in `backend/.env`. Use `API_HOST=0.0.0.0` for a container or external access.
- `API_URL` in `frontend/.env.local` is the backend address reachable by the Next.js server. It defaults to `http://127.0.0.1:4000`. Browser requests keep using `/api/*`, which Next.js proxies to the backend with [external rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites). The browser uses the frontend origin, so this setup needs no cross-origin API configuration.

For deployment, set `API_URL` before building the frontend; changing the proxy address requires rebuilding it. Build from the repository root with `npm run build`. Use `npm start` to run both services, or `npm run start:backend` and `npm run start:frontend` on separate services with their respective environments. Keep the workspace packages and production dependencies available to both services. Generated `dist`, `.next`, and MapLibre worker assets are built locally and are not committed.

Saved fields remain in browser LocalStorage using `field-atlas-v1`. Keep the same frontend origin to access existing fields; a different host or port has separate browser storage. PostgreSQL setup is described below; field persistence has not been migrated and there are no user accounts.

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

URL-encode special characters in the password when constructing the connection URL. If the backend later runs in the same Compose network, use host `db` and port `5432` instead. Never place this URL in a `NEXT_PUBLIC_` variable or frontend environment file.

```sh
docker compose logs --tail=50 db
docker compose stop db
docker compose start --wait db
```

Stopping or recreating the container keeps the named volume. `docker compose down` also keeps it; **`docker compose down -v` deletes the database data**. PostgreSQL initialization variables apply to an empty data directory; changing the password in `.env` does not update an existing database password. Update the database role password first, then synchronize both environment files.

This change provisions the database and connection configuration. The current Node.js location-search API does not query PostgreSQL yet; application tables, migrations, and persistence integration belong to the planned FastAPI work. Existing fields stay in LocalStorage, curated/reference files and demo caches remain JSON, and chat history stays in tab memory. The official image's volume and initialization behavior is documented in the [PostgreSQL image documentation](https://hub.docker.com/_/postgres).

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

Search uses Photon through the standalone API via `/api/geocode`; coordinate searches resolve locally using `packages/shared`. `PHOTON_API_URL` can point to your own Photon service. Fields stay in this browser; LocalStorage is not a backup or multi-device account.

## Bounded tile prefetch

After visible tiles finish loading and the map becomes idle, prefetch prepares two closer native zoom levels in a 3×3 area around the center: at most 18 tiles per stationary view, with only two low-priority requests at a time. It operates at camera zoom 12 and above, respects the source's maximum native level 19, and performs no globe-wide prefetch.

Moving/zooming, switching to Street, or unmounting cancels pending prefetch. A small bounded seen-set avoids repeated speculative requests, and browser HTTP caching is used for reuse during subsequent zooms. Provider/network failures pause prefetch for a minute and never display a map error. The currently visible map takes priority. This is a small interactive look-ahead cache, not a bulk imagery downloader or offline pack. It reduces waiting around the center; it cannot make every area/zoom instant. Prefetch consumes additional bandwidth, and browser/provider caching policies still apply.

## Code and checks

- `frontend/components/earth.tsx`: complete map and drawing lifecycle.
- `frontend/lib/map-style.ts`: Clarity/Street styles and optional DEM threshold.
- `frontend/lib/map-prefetch.ts`: bounded tile selection, two workers, cancellation, and HTTP-cache warming.
- `frontend/store/fields.ts`, `frontend/lib/geo.ts`: field persistence and geographic calculations.
- `frontend/scripts/copy-map-worker.mjs`: predev/prebuild resolves the installed MapLibre package and copies its worker into frontend public assets.
- `backend/src/app.ts`, `backend/src/geocode.ts`: HTTP routing and location-search service.
- `packages/shared/src/geocoding.ts`: search result types and geographic normalization.

```sh
npm test
npm run build
npm start -- --port 3100
# Against both running services, in another terminal:
npx playwright install chromium
npm run test:browser
```

`npm test` runs API, frontend, and shared tests. Browser tests use fixture map/terrain tiles to verify fields, map switching, and bounded prefetch; the proxy test calls the real local backend. Use ATLAS_URL for a different running frontend and CHROMIUM_EXECUTABLE_PATH for an installed Chrome executable. Browser fixtures live in `frontend/tests/fixtures`. Real endpoint/imagery checks are separate from fixture tests.

Climate charts remain labeled demo data; NASA POWER is not integrated. Soil values must come from field observations. Crop rotations remain illustrative, with no predicted yield or water-saving percentages.
