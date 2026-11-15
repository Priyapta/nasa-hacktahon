import type { Polygon } from "geojson";
import { tileView } from "@/lib/tile-view";

const W = 400;
const H = 170;

export default function SatelliteThumb({ location }: { location: Polygon }) {
  const ring = location.coordinates[0].slice(0, -1) as [number, number][];
  const view = tileView(ring, W, H);
  const pct = (value: number, of: number) => `${(value / of) * 100}%`;
  return (
    <div className="relative overflow-hidden bg-[#2e4a22]" style={{ aspectRatio: `${W} / ${H}` }} aria-hidden="true">
      {view.tiles.map((tile) => (
        <img key={tile.url} src={tile.url} alt="" loading="lazy" decoding="async" draggable={false}
          className="absolute max-w-none select-none"
          style={{ left: pct(tile.left, W), top: pct(tile.top, H), width: pct(256, W), height: pct(256, H) }} />
      ))}
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
        <polygon points={view.points.map((p) => p.join(",")).join(" ")} fill="#c3e77a" fillOpacity="0.32"
          stroke="#c3e77a" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Esri</span>
    </div>
  );
}
