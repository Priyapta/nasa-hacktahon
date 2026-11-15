import { clarityTileUrl } from "./map-style";

const TILE = 256;

export interface TileView {
  zoom: number;
  width: number;
  height: number;
  tiles: { url: string; left: number; top: number }[];
  points: [number, number][];
}

function project([lon, lat]: [number, number], zoom: number): [number, number] {
  const scale = TILE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return [((lon + 180) / 360) * scale, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale];
}

/**
 * Picks the deepest Clarity zoom where the field fits inside `fill` of a width x height window,
 * then lists the tiles covering that window and the field outline in window pixels.
 */
export function tileView(ring: [number, number][], width = 400, height = 170, fill = 0.55, maxZoom = 17): TileView {
  let zoom = maxZoom;
  for (; zoom > 1; zoom -= 1) {
    const pts = ring.map((p) => project(p, zoom));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    if (Math.max(...xs) - Math.min(...xs) <= width * fill && Math.max(...ys) - Math.min(...ys) <= height * fill) break;
  }
  const pts = ring.map((p) => project(p, zoom));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = (Math.min(...xs) + Math.max(...xs)) / 2 - width / 2;
  const y0 = (Math.min(...ys) + Math.max(...ys)) / 2 - height / 2;
  const tiles = [];
  for (let ty = Math.floor(y0 / TILE); ty * TILE < y0 + height; ty += 1) {
    for (let tx = Math.floor(x0 / TILE); tx * TILE < x0 + width; tx += 1) {
      const url = clarityTileUrl.replace("{z}", String(zoom)).replace("{y}", String(ty)).replace("{x}", String(tx));
      tiles.push({ url, left: tx * TILE - x0, top: ty * TILE - y0 });
    }
  }
  return { zoom, width, height, tiles, points: pts.map(([x, y]) => [x - x0, y - y0]) };
}
