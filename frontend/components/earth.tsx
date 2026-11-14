"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AttributionControl,
  NavigationControl,
  Map,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { bbox } from "@turf/turf";
import type { Polygon } from "geojson";
import type { FarmField } from "@/types";
import { fieldsGeoJSON, measure } from "@/lib/geo";
import { mapErrorMessage } from "@/lib/map-error";
import { attachClarityPrefetch } from "@/lib/map-prefetch";
import { parseCoordinates, type LocationResult } from "@field-atlas/shared";
import {
  clarityStyle,
  mapTilerTerrainUrl,
  syncTerrain,
  terrainSourceId,
} from "@/lib/map-style";
import {
  Search,
  Plus,
  Minus,
  Compass,
  Globe2,
  Layers,
  PenTool,
  MousePointer2,
  Download,
  X,
} from "lucide-react";
import { Button } from "./ui/button";

interface EarthProps {
  active: boolean;
  fields: FarmField[];
  selected: FarmField | undefined;
  resetKey: number;
  onGeometry: (geometry: Polygon) => void;
  onLocation: (name: string) => void;
  onNew: () => void;
  onSelect: (field: FarmField) => void;
}

export default function Earth(props: EarthProps) {
  const container = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const map = useRef<Map | null>(null);
  const draw = useRef<TerraDraw | null>(null);
  const prefetchStop = useRef<(() => void) | undefined>(undefined);
  const activeFeature = useRef<string | number | undefined>(undefined);
  const callbacks = useRef(props);
  callbacks.current = props;
  const searchAbort = useRef<AbortController | null>(null);
  const mapAbort = useRef<AbortController | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [ready, setReady] = useState(false);
  const [fatalError, setFatalError] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [local, setLocal] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [satellite, setSatellite] = useState(true);
  const mapTilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();

  useEffect(() => {
    const key: string = mapTilerKey || "";
    const controller = new AbortController();
    mapAbort.current = controller;
    let m: Map | undefined;
    let d: TerraDraw | undefined;
    let resize: ResizeObserver | undefined;

    function initialize() {
      if (controller.signal.aborted || !container.current) return;
      try {
        setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        m = new Map({
          container: container.current,
          style: clarityStyle(),
          center: [112, -6],
          zoom: container.current.clientWidth < 600 ? 0.5 : 1.4,
          maxZoom: 22,
          maxPitch: 80,
          canvasContextAttributes: { antialias: true },
          attributionControl: false,
        });
        map.current = m;
        m.addControl(new AttributionControl({ compact: true }), "bottom-right");
        m.addControl(
          new NavigationControl({ visualizePitch: true }),
          "top-right",
        );
        m.on("error", (event) => setError(mapErrorMessage(event)));
        m.on("zoomend", () => setLocal((m?.getZoom() ?? 0) >= 9));
        m.on("zoom", () => {
          if (callbacks.current.active && m?.getSource(terrainSourceId))
            syncTerrain(m);
        });
        m.on("sourcedataloading", (event) => {
          if (
            event.sourceId !== terrainSourceId &&
            event.sourceId !== "fields" &&
            !event.sourceId?.startsWith("td-")
          )
            setLoadingDetail(true);
        });
        m.on("sourcedata", (event) => {
          if (event.isSourceLoaded) setLoadingDetail(false);
        });
        m.on("idle", () => setLoadingDetail(false));
        m.on("load", () => {
          if (!m || controller.signal.aborted) return;
          m.setProjection({ type: "globe" });
          if (key && !m.getSource(terrainSourceId)) {
            m.addSource(terrainSourceId, {
              type: "raster-dem",
              url: mapTilerTerrainUrl(key),
              tileSize: 512,
              maxzoom: 14,
            });
            syncTerrain(m);
          }
          m.setSky({
            "sky-color": "#09141c",
            "horizon-color": "#a8c9d7",
            "fog-color": "#c6dce4",
            "atmosphere-blend": 0.8,
          });
          m.addSource("fields", { type: "geojson", data: fieldsGeoJSON([]) });
          m.addLayer({
            id: "field-fill",
            type: "fill",
            source: "fields",
            paint: { "fill-color": "#9ee078", "fill-opacity": 0.24 },
          });
          m.addLayer({
            id: "field-line",
            type: "line",
            source: "fields",
            paint: { "line-color": "#c3e77a", "line-width": 2 },
          });
          d = new TerraDraw({
            adapter: new TerraDrawMapLibreGLAdapter({
              map: m,
              coordinatePrecision: 9,
            }),
            modes: [
              new TerraDrawPolygonMode({
                styles: {
                  fillColor: "#9ee078",
                  fillOpacity: 0.25,
                  outlineColor: "#c3e77a",
                  outlineWidth: 2,
                  closingPointColor: "#c3e77a",
                },
              }),
              new TerraDrawSelectMode({
                flags: {
                  polygon: {
                    feature: {
                      draggable: true,
                      selfIntersectable: false,
                      coordinates: {
                        draggable: true,
                        midpoints: true,
                        deletable: true,
                      },
                    },
                  },
                },
                keyEvents: {
                  delete: null,
                  deselect: "Escape",
                  rotate: null,
                  scale: null,
                },
                styles: {
                  selectedPolygonColor: "#9ee078",
                  selectedPolygonFillOpacity: 0.25,
                  selectedPolygonOutlineColor: "#c3e77a",
                  selectedPolygonOutlineWidth: 2,
                  selectionPointColor: "#ffffff",
                  selectionPointOutlineColor: "#287a55",
                  midPointColor: "#c3e77a",
                },
              }),
            ],
          });
          draw.current = d;
          d.start();
          d.on("finish", (id) => {
            const feature = d?.getSnapshotFeature(id);
            if (feature?.geometry.type !== "Polygon") return;
            try {
              measure(feature.geometry);
              activeFeature.current = id;
              callbacks.current.onGeometry(feature.geometry);
              d?.setMode("select");
              d?.selectFeature(id);
              m?.doubleClickZoom.enable();
              m?.dragRotate.enable();
              setDrawing(false);
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Invalid field boundary. Please redraw.",
              );
            }
          });
          d.on("change", () => {
            if (
              activeFeature.current === undefined ||
              d?.getMode() !== "select"
            )
              return;
            const feature = d.getSnapshotFeature(activeFeature.current);
            if (feature?.geometry.type === "Polygon")
              callbacks.current.onGeometry(feature.geometry);
          });
          m.on("click", "field-fill", (event) => {
            if (d?.getMode() === "polygon") return;
            const id = event.features?.[0]?.properties?.id;
            const field = callbacks.current.fields.find(
              (field) => field.id === id,
            );
            if (field && field.id !== callbacks.current.selected?.id) {
              if (
                activeFeature.current !== undefined &&
                !window.confirm(
                  "Discard the unsaved boundary and open this field?",
                )
              )
                return;
              callbacks.current.onSelect(field);
            }
          });
          setReady(true);
        });
        resize = new ResizeObserver(() => {
          if (container.current?.clientWidth && container.current.clientHeight)
            m?.resize();
        });
        resize.observe(container.current);
      } catch {
        setFatalError(
          "Your browser could not start the 3D map. Enable WebGL / hardware acceleration and reload.",
        );
      }
    }
    void initialize();
    return () => {
      controller.abort();
      searchAbort.current?.abort();
      resize?.disconnect();
      prefetchStop.current?.();
      d?.stop();
      m?.remove();
      map.current = null;
      draw.current = null;
    };
  }, [mapTilerKey]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    prefetchStop.current?.();
    prefetchStop.current = undefined;
    if (props.active) {
      m.resize();
      if (m.getSource(terrainSourceId)) syncTerrain(m);
      prefetchStop.current = attachClarityPrefetch(m);
    } else {
      m.stop();
      m.setTerrain(null);
    }
    return () => prefetchStop.current?.();
  }, [props.active, ready]);

  useEffect(() => {
    function cancelDrawing(event: KeyboardEvent) {
      const d = draw.current;
      if (event.key !== "Escape" || d?.getMode() !== "polygon") return;
      d.setMode("select");
      d.clear();
      activeFeature.current = undefined;
      map.current?.doubleClickZoom.enable();
      map.current?.dragRotate.enable();
      setDrawing(false);
    }
    window.addEventListener("keydown", cancelDrawing, true);
    return () => window.removeEventListener("keydown", cancelDrawing, true);
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource("fields") as GeoJSONSource).setData(
      fieldsGeoJSON(
        props.fields.filter((field) => field.id !== props.selected?.id),
      ),
    );
  }, [props.fields, props.selected, ready]);

  useEffect(() => {
    if (!ready) return;
    activeFeature.current = undefined;
    draw.current?.setMode("select");
    draw.current?.clear();
    map.current?.doubleClickZoom.enable();
    map.current?.dragRotate.enable();
    setDrawing(false);
  }, [props.resetKey, ready]);

  useEffect(() => {
    const m = map.current;
    const d = draw.current;
    if (!ready || !props.selected || !m || !d) return;
    try {
      measure(props.selected.geometry);
      m.resize();
      m.setProjection({ type: "mercator" });
      const bounds = bbox(props.selected.geometry);
      m.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        {
          padding: {
            top: 100,
            bottom: 130,
            left: m.getContainer().clientWidth > 700 ? 340 : 40,
            right: 80,
          },
          maxZoom: 17,
          pitch: 0,
          bearing: 0,
          duration: 1800,
        },
      );
      activeFeature.current = undefined;
      d.setMode("select");
      d.clear();
      const [result] = d.addFeatures([
        {
          type: "Feature",
          id: props.selected.id,
          properties: { mode: "polygon" },
          geometry: props.selected.geometry,
        },
      ]);
      if (!result.valid)
        throw new Error("The saved field could not be opened for editing.");
      activeFeature.current = props.selected.id;
      d.selectFeature(props.selected.id);
      callbacks.current.onGeometry(props.selected.geometry);
      setLocal(true);
      setDrawing(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to open saved geometry.",
      );
    }
  }, [props.selected, ready]);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    setSearching(true);
    setSearched(false);
    setResults([]);
    setError("");
    try {
      const coordinate = parseCoordinates(query);
      if (coordinate) {
        locate(coordinate);
        return;
      }
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(query.trim())}`,
        { signal: controller.signal },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Location search unavailable.");
      setResults(data.results);
      setSearched(true);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Location search unavailable.",
        );
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }

  function locate(result: LocationResult) {
    const m = map.current;
    if (!m) return;
    if (
      activeFeature.current !== undefined &&
      !window.confirm(
        "Discard the unsaved boundary and move to another location?",
      )
    )
      return;
    activeFeature.current = undefined;
    draw.current?.setMode("select");
    draw.current?.clear();
    props.onNew();
    props.onLocation(result.name);
    m.setProjection({ type: "globe" });
    m.flyTo({
      center: result.center,
      zoom: result.zoom,
      pitch: 0,
      bearing: 0,
      duration: 2200,
    });
    setLocal(result.zoom >= 9);
    setDrawing(false);
    setResults([]);
    setSearched(false);
    setQuery("");
  }

  function startDrawing() {
    const m = map.current;
    const d = draw.current;
    if (!m || !d) return;
    if (m.getZoom() < 13) {
      setError(
        "Zoom closer to your farmland before drawing (zoom level 13 or greater).",
      );
      return;
    }
    if (
      activeFeature.current !== undefined &&
      !window.confirm("Discard the unsaved boundary and draw a new field?")
    )
      return;
    setError("");
    activeFeature.current = undefined;
    props.onNew();
    m.setProjection({ type: "mercator" });
    m.jumpTo({ pitch: 0, bearing: 0 });
    m.doubleClickZoom.disable();
    m.dragRotate.disable();
    d.clear();
    d.setMode("polygon");
    setDrawing(true);
    setLocal(true);
  }

  function toggleBasemap() {
    const m = map.current;
    if (!m) return;
    const next = !satellite;
    m.setLayoutProperty(
      "basemap-clarity",
      "visibility",
      next ? "visible" : "none",
    );
    m.setLayoutProperty(
      "basemap-streets",
      "visibility",
      next ? "none" : "visible",
    );
    setSatellite(next);
    setError("");
  }

  function exportFields() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(fieldsGeoJSON(props.fields), null, 2)], {
        type: "application/geo+json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "field-atlas.geojson";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="earth">
      <div
        ref={container}
        className="map"
        role="region"
        aria-label="Interactive Earth and farmland map"
      />
      {!ready && (
        <div className="setup" role="status">
          <Globe2 size={48} />
          <h2>
            {fatalError ? "Map unavailable" : "Opening your view of Earth"}
          </h2>
          <p>{fatalError || "Loading Esri Clarity satellite imagery…"}</p>
          {fatalError && (
            <Button onClick={() => window.location.reload()}>Reload map</Button>
          )}
        </div>
      )}
      <form className="search" role="search" onSubmit={search}>
        <Search size={19} aria-hidden="true" />
        <input
          ref={searchInput}
          aria-label="Search location"
          placeholder="Place or latitude, longitude"
          maxLength={120}
          value={query}
          onChange={(event) => {
            searchAbort.current?.abort();
            setSearching(false);
            setQuery(event.target.value);
            setResults([]);
            setSearched(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setResults([]);
              setSearched(false);
            }
          }}
        />
        <button
          className="search-submit"
          type="submit"
          disabled={!ready || searching || query.trim().length < 2}
        >
          {searching ? "Searching…" : "Search"}
        </button>
        {searched && (
          <div className="results" aria-label="Location search results">
            {results.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => locate(result)}
              >
                {result.name}
              </button>
            ))}
            {!results.length && (
              <p role="status">
                No matching places. Try a nearby town or coordinates.
              </p>
            )}
            <small>Search: Photon · © OpenStreetMap contributors</small>
          </div>
        )}
      </form>
      {ready && !local && (
        <div className="hero">
          <span>YOUR LAND, IN PERSPECTIVE</span>
          <h1>
            Understand Your Land.
            <br />
            Plan a Better Future.
          </h1>
          <p>A clearer view of the ground you grow on.</p>
          <Button onClick={() => searchInput.current?.focus()}>
            Find My Farmland
          </Button>
        </div>
      )}
      {local && (
        <div className="map-hint">
          {drawing
            ? "Click along the field edges. Click the first point to finish. Esc to cancel."
            : "Map Your Farmland · Zoom in, then outline your field."}
        </div>
      )}
      {local && satellite && loadingDetail && (
        <div className="detail-loading" role="status">
          Loading detailed satellite imagery…
        </div>
      )}
      <div className="tools" role="toolbar" aria-label="Map and field tools">
        {[
          { icon: Plus, label: "Zoom in", action: () => map.current?.zoomIn() },
          {
            icon: Minus,
            label: "Zoom out",
            action: () => map.current?.zoomOut(),
          },
          {
            icon: Compass,
            label: "Reset bearing",
            action: () => map.current?.resetNorth(),
          },
          {
            icon: Globe2,
            label: "Return to globe",
            action: () => {
              if (
                activeFeature.current !== undefined &&
                !window.confirm(
                  "Discard the unsaved boundary and return to the globe?",
                )
              )
                return;
              activeFeature.current = undefined;
              draw.current?.setMode("select");
              draw.current?.clear();
              props.onNew();
              map.current?.doubleClickZoom.enable();
              map.current?.dragRotate.enable();
              map.current?.setProjection({ type: "globe" });
              map.current?.flyTo({
                zoom:
                  (container.current?.clientWidth ?? 1000) < 600 ? 0.5 : 1.4,
                pitch: 0,
                bearing: 0,
              });
              setDrawing(false);
              setLocal(false);
            },
          },
          {
            icon: Layers,
            label: satellite
              ? "Switch to street map"
              : "Switch to satellite imagery",
            action: toggleBasemap,
          },
          {
            icon: PenTool,
            label: "Draw a new field",
            action: startDrawing,
            pressed: drawing,
          },
          {
            icon: MousePointer2,
            label: "Edit vertices",
            action: () => {
              draw.current?.setMode("select");
              if (activeFeature.current !== undefined)
                draw.current?.selectFeature(activeFeature.current);
              map.current?.doubleClickZoom.enable();
              map.current?.dragRotate.enable();
              setDrawing(false);
            },
          },
          {
            icon: Download,
            label: "Export saved fields as GeoJSON",
            action: exportFields,
            disabled: !props.fields.length,
          },
        ].map(({ icon: Icon, label, action, disabled, pressed }) => (
          <button
            key={label}
            type="button"
            disabled={!ready || disabled}
            title={label}
            aria-label={label}
            aria-pressed={pressed}
            onClick={action}
          >
            <Icon size={20} />
          </button>
        ))}
      </div>
      {error && (
        <div className="map-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            aria-label="Dismiss map message"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="imagery-note">
        {satellite
          ? local
            ? "Esri Clarity · Archived satellite imagery. Capture date and detail vary by location."
            : "Esri Clarity · Interactive globe"
          : "Esri World Street Map"}
      </div>
      <div className="map-caption">
        FIELD ATLAS <span>MapLibre / GeoJSON field mapping</span>
      </div>
    </div>
  );
}
