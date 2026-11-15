import type { Polygon } from "geojson";
import { tileView } from "@/lib/tile-view";

interface Props {
  location: Polygon;
  width?: number;
  height?: number;
  credit?: boolean;
}

export default function SatelliteThumb({ location, width = 400, height = 170, credit = true }: Props) {
  const ring = location.coordinates[0].slice(0, -1) as [number, number][];
  const view = tileView(ring, width, height);
  const pct = (value: number, of: number) => `${(value / of) * 100}%`;
  return (
    <div className="relative overflow-hidden bg-[#2e4a22]" style={{ aspectRatio: `${width} / ${height}` }} aria-hidden="true">
      {view.tiles.map((tile) => (
        <img key={tile.url} src={tile.url} alt="" loading="lazy" decoding="async" draggable={false}
          className="absolute max-w-none select-none"
          style={{ left: pct(tile.left, width), top: pct(tile.top, height), width: pct(256, width), height: pct(256, height) }} />
      ))}
      <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full">
        <polygon points={view.points.map((p) => p.join(",")).join(" ")} fill="#c3e77a" fillOpacity="0.32"
          stroke="#c3e77a" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      {credit && <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Esri</span>}
    </div>
  );
}
