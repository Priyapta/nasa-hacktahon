import type { OpenRing } from "./types";

export const SCENE_W = 700;
export const SCENE_H = 400;
export const SLAB = 9;
export const PLANT_TALL = 62;

type Point = [number, number];

const VIEW_ANGLE = (-24 * Math.PI) / 180;
const TILT = 0.5;
const TARGET_PLANTS = 54;

function inside([x, y]: Point, poly: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function shoelace(poly: Point[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

const str = (pts: Point[]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const path = (pts: Point[]) => "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");

/**
 * Projects a lon/lat ring into an oblique view of a lifted plot, centred in the
 * scene, with plant spots on a grid clipped to the real field shape.
 */
export function sceneGeometry(ring: OpenRing) {
  const lat0 = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  const lon0 = ring.reduce((a, p) => a + p[0], 0) / ring.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110540;
  // Local metres, x east and y south so the screen keeps north at the top.
  const local: Point[] = ring.map(([lon, lat]) => [(lon - lon0) * kx, -(lat - lat0) * ky]);
  const turn = ([x, y]: Point): Point => [
    x * Math.cos(VIEW_ANGLE) - y * Math.sin(VIEW_ANGLE),
    (x * Math.sin(VIEW_ANGLE) + y * Math.cos(VIEW_ANGLE)) * TILT,
  ];
  const turned = local.map(turn);
  const xs = turned.map((p) => p[0]);
  const ys = turned.map((p) => p[1]);
  const zoom = Math.min(400 / (Math.max(...xs) - Math.min(...xs)), 190 / (Math.max(...ys) - Math.min(...ys)));
  const top = Math.min(...ys) * zoom - SLAB - PLANT_TALL;
  const bottom = Math.max(...ys) * zoom;
  const ox = SCENE_W / 2 - ((Math.min(...xs) + Math.max(...xs)) / 2) * zoom;
  const oy = 222 - (top + bottom) / 2;
  const project = (p: Point, z = 0): Point => {
    const [x, y] = turn(p);
    return [ox + x * zoom, oy + y * zoom - z];
  };

  const base = local.map((p) => project(p));
  const surface = local.map((p) => project(p, SLAB));
  const cx = surface.reduce((a, p) => a + p[0], 0) / surface.length;
  const cy = surface.reduce((a, p) => a + p[1], 0) / surface.length;

  const sides: string[] = [];
  for (let e = 0; e < surface.length; e++) {
    const a = surface[e];
    const b = surface[(e + 1) % surface.length];
    let n: Point = [b[1] - a[1], -(b[0] - a[0])];
    if (n[0] * ((a[0] + b[0]) / 2 - cx) + n[1] * ((a[1] + b[1]) / 2 - cy) < 0) n = [-n[0], -n[1]];
    if (n[1] > 0) sides.push(str([a, b, base[(e + 1) % base.length], base[e]]));
  }

  const lx = local.map((p) => p[0]);
  const ly = local.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...lx), Math.max(...lx), Math.min(...ly), Math.max(...ly)];
  const spacing = Math.sqrt(shoelace(local) / TARGET_PLANTS);
  const spots: Point[] = [];
  for (let y = minY + spacing / 2; y < maxY; y += spacing)
    for (let x = minX + spacing / 2; x < maxX; x += spacing) if (inside([x, y], local)) spots.push([x, y]);
  const plants = spots.map((p) => project(p, SLAB)).sort((a, b) => a[1] - b[1]);
  const rows = Math.round((maxY - minY) / spacing);
  const furrows = Array.from({ length: Math.max(rows - 1, 0) }, (_, r) => {
    const y = minY + (r + 1) * spacing;
    return path([project([minX - spacing, y], SLAB), project([maxX + spacing, y], SLAB)]);
  }).join(" ");

  const at = (u: number, v: number, z = SLAB) => project([minX + (maxX - minX) * u, minY + (maxY - minY) * v], z);
  const crackSets: [number, number][][] = [
    [[0.15, 0.2], [0.22, 0.35], [0.18, 0.5], [0.27, 0.62]],
    [[0.45, 0.55], [0.52, 0.68], [0.48, 0.85]],
    [[0.7, 0.15], [0.76, 0.3], [0.72, 0.45], [0.8, 0.55]],
    [[0.85, 0.7], [0.9, 0.82]],
    [[0.32, 0.8], [0.4, 0.9]],
  ];
  const shine: [number, number, number][] = [[0.15, 0.3, 0.15], [0.5, 0.15, 0.2], [0.62, 0.75, 0.14]];
  const ripples = plants.filter((_, i) => i % Math.max(1, Math.floor(plants.length / 10)) === 0).slice(0, 10);

  const grow = (f: number) => {
    const c: Point = [(minX + maxX) / 2, (minY + maxY) / 2];
    return str(local.map(([x, y]) => project([c[0] + (x - c[0]) * f, c[1] + (y - c[1]) * f])));
  };
  const fieldTop = Math.min(...surface.map((p) => p[1])) - PLANT_TALL;
  const front = base.reduce((a, p) => (p[1] > a[1] ? p : a));

  return {
    ground: grow(1.5),
    groundIn: grow(1.22),
    shadow: str(base.map(([x, y]) => [x + 9, y + 7])),
    sides,
    surface: str(surface),
    furrows,
    cracks: crackSets.map((c) => path(c.map(([u, v]) => at(u, v)))).join(" "),
    shine: shine.map(([u, v, l]) => path([at(u, v), at(u + l, v)])).join(" "),
    plants,
    ripples,
    cloud: { x: cx - 10, y: Math.max(62, fieldTop - 40) },
    centre: [cx, cy] as Point,
    tag: front,
  };
}

const PUFFS: [number, number, number][] = [[-40, 8, 20], [-16, -8, 28], [16, -2, 24], [40, 10, 16]];
const circle = (x: number, y: number, r: number) =>
  `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${(-2 * r).toFixed(1)} 0`;

/** A cloud as one clockwise path, so overlapping puffs never cut holes. */
export function cloudPath(x: number, y: number, k: number, dy = 0): string {
  const left = x - 50 * k;
  const top = y + 4 * k + dy;
  const w = 100 * k;
  const h = 22 * k;
  const r = 11 * k;
  return (
    PUFFS.map(([a, b, R]) => circle(x + a * k, y + b * k + dy, R * k)).join("") +
    `M${(left + r).toFixed(1)} ${top.toFixed(1)}h${(w - 2 * r).toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 0 ${h.toFixed(1)}h${(-(w - 2 * r)).toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 0 ${(-h).toFixed(1)}z`
  );
}
