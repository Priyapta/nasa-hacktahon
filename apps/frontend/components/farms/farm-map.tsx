"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map,
  NavigationControl,
  AttributionControl,
  setWorkerUrl,
  type GeoJSONSource,
  type ExpressionSpecification,
  type VisibilitySpecification,
  type RasterSourceSpecification,
} from "maplibre-gl";
import { bbox } from "@turf/turf";
import type { FeatureCollection, Point } from "geojson";
import type { FarmField } from "@/types";
import { fieldsGeoJSON } from "@/lib/geo";
import { clarityStyle } from "@/lib/map-style";

interface FarmMapProps {
  fields: FarmField[];
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
}

export default function FarmMap(props: FarmMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const current = useRef(props);
  current.current = props;
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"street" | "satellite">();
  const basemap = view ?? (props.selectedId ? "satellite" : "street");
  const streetLayers = useRef<
    { id: string; visibility: VisibilitySpecification }[]
  >([]);

  function fitFields(m: Map, fields: FarmField[]) {
    if (!fields.length) return;
    const bounds = bbox(fieldsGeoJSON(fields));
    m.fitBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      { padding: 48, maxZoom: 17, duration: 450, pitch: 0, bearing: 0 },
    );
  }

  useEffect(() => {
    if (!container.current) return;
    let m: Map;
    try {
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      m = new Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [110, -7],
        zoom: 4,
        maxZoom: 22,
        maxPitch: 0,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
      });
    } catch {
      setLoading(false);
      setError(
        "The field map could not start. You can still select and manage fields from the list.",
      );
      return;
    }
    map.current = m;
    m.touchZoomRotate.disableRotation();
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new AttributionControl({ compact: false }), "bottom-right");
    m.on("error", () => {
      setLoading(false);
      setError(
        "The basemap could not load. Check your connection. Your saved fields are still available in the list.",
      );
    });
    m.on("load", () => {
      m.setProjection({ type: "mercator" });
      m.setTerrain(null);
      streetLayers.current = m.getStyle().layers.map((layer) => ({
        id: layer.id,
        visibility: layer.layout?.visibility ?? "visible",
      }));
      const satellite = clarityStyle().sources.clarity as RasterSourceSpecification;
      // shortcut: overzoom z17 for regional coverage gaps; use coverage-aware fallback for finer imagery.
      m.addSource("farm-satellite", { ...satellite, maxzoom: 17 });
      m.addLayer({
        id: "farm-satellite",
        type: "raster",
        source: "farm-satellite",
        layout: { visibility: "none" },
        paint: { "raster-fade-duration": 300 },
      });
      m.addSource("farm-fields", { type: "geojson", data: fieldsGeoJSON([]) });
      m.addSource("farm-centers", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "farm-fill",
        type: "fill",
        source: "farm-fields",
        paint: { "fill-color": "#287A55", "fill-opacity": 0.2 },
      });
      m.addLayer({
        id: "farm-outline",
        type: "line",
        source: "farm-fields",
        paint: { "line-color": "#287A55", "line-width": 2 },
      });
      m.addLayer({
        id: "farm-centers",
        type: "circle",
        source: "farm-centers",
        paint: {
          "circle-color": "#163D2B",
          "circle-radius": 5,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      });
      m.on("click", ["farm-fill", "farm-centers"], (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") current.current.onSelect(id);
      });
      m.on("mouseenter", "farm-fill", () => {
        m.getCanvas().style.cursor = "pointer";
      });
      m.on("mouseleave", "farm-fill", () => {
        m.getCanvas().style.cursor = "";
      });
      setReady(true);
      setLoading(false);
    });
    const resize = new ResizeObserver(() => {
      if (container.current?.clientWidth && container.current.clientHeight)
        m.resize();
    });
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    setError("");
    for (const layer of streetLayers.current)
      m.setLayoutProperty(
        layer.id,
        "visibility",
        basemap === "street" ? layer.visibility : "none",
      );
    m.setLayoutProperty(
      "farm-satellite",
      "visibility",
      basemap === "satellite" ? "visible" : "none",
    );
    m.setPaintProperty("farm-outline", "line-color", [
      "case",
      ["==", ["get", "id"], props.selectedId ?? ""],
      basemap === "satellite" ? "#C3E77A" : "#163D2B",
      basemap === "satellite" ? "#A8C9B0" : "#287A55",
    ]);
  }, [basemap, ready, props.selectedId]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const selected = props.fields.find(
      (field) => field.id === props.selectedId,
    );
    const centers: FeatureCollection<Point> = {
      type: "FeatureCollection",
      features: props.fields.map((field) => ({
        type: "Feature",
        properties: { id: field.id },
        geometry: { type: "Point", coordinates: field.centroid },
      })),
    };
    (m.getSource("farm-fields") as GeoJSONSource).setData(
      fieldsGeoJSON(props.fields),
    );
    (m.getSource("farm-centers") as GeoJSONSource).setData(centers);
    const isSelected: ExpressionSpecification = [
      "==",
      ["get", "id"],
      selected?.id ?? "",
    ];
    m.setPaintProperty("farm-fill", "fill-opacity", [
      "case",
      isSelected,
      0.4,
      0.18,
    ]);
    m.setPaintProperty("farm-outline", "line-width", [
      "case",
      isSelected,
      3,
      1.5,
    ]);
    m.setPaintProperty("farm-centers", "circle-radius", [
      "case",
      isSelected,
      7,
      5,
    ]);
    fitFields(m, selected ? [selected] : props.fields);
  }, [props.fields, props.selectedId, ready]);

  return (
    <div className="farm-map-section">
      <div className="farm-map-toolbar">
        <span>Map view</span>
        <div role="group" aria-label="Field basemap">
          {(["street", "satellite"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={basemap === mode}
              disabled={!ready}
              onClick={() => setView(mode)}
            >
              {mode === "street" ? "Street" : "Satellite"}
            </button>
          ))}
        </div>
      </div>
      <div
        className="farm-map"
        role="region"
        aria-label="Saved field map"
      >
        <div ref={container} className="farm-map-canvas" />
        {loading && !error && (
          <div className="farm-map-loading" role="status">
            Loading your field map…
          </div>
        )}
        {error && (
          <div className="farm-map-message" role="alert">
            {error}
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss field map message"
            >
              ×
            </button>
          </div>
        )}
        <div className="farm-map-badge">
          {basemap === "satellite" ? "Satellite" : "2D street map"} ·{" "}
          {props.fields.length} fields
        </div>
        <button
          type="button"
          className="farm-map-fit"
          disabled={!ready}
          onClick={() => {
            props.onSelect(undefined);
            if (map.current) fitFields(map.current, props.fields);
          }}
        >
          Show all fields
        </button>
      </div>
    </div>
  );
}
