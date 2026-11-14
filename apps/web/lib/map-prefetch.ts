import type { Map } from "maplibre-gl";
import { clarityTileUrl } from "./map-style";

export function prefetchTileUrls(
  center: { lng: number; lat: number },
  zoom: number,
): string[] {
  if (![center.lng, center.lat, zoom].every(Number.isFinite) || zoom < 12)
    return [];
  const urls: string[] = [];
  // Raster tiles are 256px, so their native level is one above MapLibre's 512px camera zoom.
  const currentLevel = Math.round(zoom + 1);
  const lat =
    (Math.max(-85.05112878, Math.min(85.05112878, center.lat)) * Math.PI) / 180;
  const longitude = (((center.lng + 180) % 360) + 360) % 360;
  for (let z = currentLevel + 1; z <= Math.min(currentLevel + 2, 19); z++) {
    const count = 2 ** z;
    const x = Math.floor((longitude / 360) * count);
    const y = Math.min(
      count - 1,
      Math.max(
        0,
        Math.floor(((1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2) * count),
      ),
    );
    for (let dy = -1; dy <= 1; dy++) {
      if (y + dy < 0 || y + dy >= count) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const tx = (x + dx + count) % count;
        urls.push(
          clarityTileUrl
            .replace("{z}", String(z))
            .replace("{y}", String(y + dy))
            .replace("{x}", String(tx)),
        );
      }
    }
  }
  return urls;
}

export function attachClarityPrefetch(map: Map): () => void {
  const seen = new Set<string>();
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pausedUntil = 0;
  let running = false;
  const cancel = () => {
    clearTimeout(timer);
    controller?.abort();
    running = false;
  };
  const start = () => {
    if (
      running ||
      Date.now() < pausedUntil ||
      document.hidden ||
      map.isMoving() ||
      !map.areTilesLoaded() ||
      map.getLayoutProperty("basemap-clarity", "visibility") === "none"
    )
      return;
    const urls = prefetchTileUrls(map.getCenter(), map.getZoom()).filter(
      (url) => !seen.has(url),
    );
    if (!urls.length) return;
    controller?.abort();
    const task = new AbortController();
    controller = task;
    running = true;
    let next = 0;
    const worker = async () => {
      while (!task.signal.aborted && next < urls.length) {
        const url = urls[next++];
        try {
          const response = await fetch(url, {
            signal: task.signal,
            cache: "force-cache",
            priority: "low",
          });
          if (!response.ok && response.status !== 404)
            throw new Error("Tile prefetch unavailable");
          await response.arrayBuffer();
          seen.add(url);
          if (seen.size > 96) seen.delete(seen.values().next().value!);
        } catch {
          if (!task.signal.aborted) {
            pausedUntil = Date.now() + 60000;
            task.abort();
          }
          return;
        }
      }
    };
    void Promise.all([worker(), worker()]).finally(() => {
      if (controller === task) running = false;
    });
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(start, 200);
  };
  const styleChanged = () => {
    if (map.getLayoutProperty("basemap-clarity", "visibility") === "none")
      cancel();
  };
  map.on("idle", schedule);
  map.on("movestart", cancel);
  map.on("styledata", styleChanged);
  schedule();
  return () => {
    cancel();
    map.off("idle", schedule);
    map.off("movestart", cancel);
    map.off("styledata", styleChanged);
  };
}
