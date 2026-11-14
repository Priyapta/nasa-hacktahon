"use client";

import { useEffect, useRef } from "react";
import { AttributionControl, Map as MapLibreMap, setWorkerUrl, type RasterSourceSpecification } from "maplibre-gl";
import { clarityStyle } from "@/lib/map-style";
import { bounds } from "@/lib/geo";
import { polygonFromRing } from "@/lib/query";
import type { OpenRing } from "@/lib/types";

// Clarity tiles above this zoom fail CORS, so the snapshot stays at native zoom.
const CLARITY_NATIVE_MAX_ZOOM = 17;

export default function FieldMap({ ring, label }: { ring: OpenRing; label: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const polygon = polygonFromRing(ring);
    let map: MapLibreMap;
    try {
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const style = clarityStyle();
      (style.sources.clarity as RasterSourceSpecification).maxzoom = CLARITY_NATIVE_MAX_ZOOM;
      map = new MapLibreMap({
        container: container.current,
        style: { ...style, projection: { type: "mercator" } },
        bounds: bounds(polygon),
        fitBoundsOptions: { padding: { top: 40, bottom: 56, left: 90, right: 40 }, maxZoom: 17 },
        interactive: false,
        attributionControl: false,
      });
    } catch {
      return;
    }
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => {
      // The compact attribution starts open; on a small card it would hide the field.
      container.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      map.addSource("field", { type: "geojson", data: { type: "Feature", properties: {}, geometry: polygon } });
      map.addLayer({ id: "field-fill", type: "fill", source: "field", paint: { "fill-color": "#C3E77A", "fill-opacity": 0.38 } });
      map.addLayer({ id: "field-line", type: "line", source: "field", paint: { "line-color": "#C3E77A", "line-width": 3 } });
    });
    return () => map.remove();
  }, [ring]);

  return (
    <div className="relative h-[150px] bg-[#2E4A22]">
      <div ref={container} className="h-full w-full" aria-hidden="true" />
      <span className="absolute bottom-3 left-3 rounded-[8px] bg-white px-2.5 py-1.5 text-[13px] font-bold">{label}</span>
    </div>
  );
}
