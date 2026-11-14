"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  AttributionControl,
  Map as MapLibreMap,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type RasterSourceSpecification,
} from "maplibre-gl";
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  TerraDrawModeUndoRedo,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import type { Feature } from "geojson";
import { clarityStyle } from "@/lib/map-style";
import { bounds, measure } from "@/lib/geo";
import { polygonFromRing, ringFromPolygon } from "@/lib/query";
import type { Dictionary } from "@/lib/i18n";
import type { OpenRing } from "@/lib/types";
import { Layers, Minus, PenLine, Plus, Undo2 } from "lucide-react";
import styles from "./MapPicker.module.css";

// Purwodadi, Grobogan: the PRD demo region.
const DEMO_CENTER: [number, number] = [110.91, -7.09];
const DEMO_ZOOM = 11;
const INDONESIA_CENTER: [number, number] = [118, -2];
const INDONESIA_ZOOM = 3;
export const MIN_DRAW_ZOOM = 14;
// Clarity level 18 tiles fail with CORS-blocked 404s around Central Java, so
// the map overzooms native level 17 imagery instead.
const CLARITY_NATIVE_MAX_ZOOM = 17;
// Terra Draw only accepts UUID v4 feature ids. One fixed id keeps a single field.
const FIELD_ID = "6f1c2e4a-8b3d-4c5e-9f7a-1b2c3d4e5f60";

// Reserve space for both desktop card sizes without moving the field between steps.
function fitPadding(m: MapLibreMap) {
  const wide = m.getContainer().clientWidth >= 1024;
  if (wide) return { top: 120, bottom: 60, left: 600, right: 100 };
  return { top: 80, bottom: 40, left: 40, right: 80 };
}

export interface MapPickerHandle {
  startDrawing: () => void;
  flyTo: (center: [number, number], zoom: number) => void;
}

interface MapPickerProps {
  t: Dictionary;
  initialArea: OpenRing | null;
  editable: boolean;
  onAreaChange: (ring: OpenRing | null) => void;
  onDrawingChange: (drawing: boolean) => void;
  onZoomChange: (zoom: number) => void;
  onInvalidBoundary: () => void;
}

const MapPicker = forwardRef<MapPickerHandle, MapPickerProps>(function MapPicker(
  props,
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const draw = useRef<TerraDraw | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const [ready, setReady] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [zoom, setZoom] = useState(props.initialArea ? DEMO_ZOOM : INDONESIA_ZOOM);
  const [satellite, setSatellite] = useState(true);
  const [tileError, setTileError] = useState(false);
  const [fatal, setFatal] = useState(false);

  function setDrawingState(value: boolean) {
    setDrawing(value);
    callbacks.current.onDrawingChange(value);
    const m = map.current;
    if (!m) return;
    if (value) m.doubleClickZoom.disable();
    else m.doubleClickZoom.enable();
  }

  function currentRing(): OpenRing | null {
    const feature = draw.current?.getSnapshotFeature(FIELD_ID);
    if (feature?.geometry.type !== "Polygon") return null;
    return ringFromPolygon(feature.geometry);
  }

  function beginDrawing() {
    const d = draw.current;
    if (!d) return;
    d.clear();
    callbacks.current.onAreaChange(null);
    d.setMode("polygon");
    setDrawingState(true);
  }

  useImperativeHandle(ref, () => ({
    startDrawing: beginDrawing,
    flyTo(center, targetZoom) {
      map.current?.flyTo({ center, zoom: targetZoom, duration: 1200 });
    },
  }));

  useEffect(() => {
    if (!container.current) return;
    let m: MapLibreMap;
    let d: TerraDraw | undefined;
    try {
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const style = clarityStyle();
      (style.sources.clarity as RasterSourceSpecification).maxzoom = CLARITY_NATIVE_MAX_ZOOM;
      m = new MapLibreMap({
        container: container.current,
        style: { ...style, projection: { type: props.editable ? "globe" : "mercator" } },
        center: props.initialArea ? DEMO_CENTER : INDONESIA_CENTER,
        zoom: props.initialArea ? DEMO_ZOOM : container.current.clientWidth >= 1024 ? 4 : INDONESIA_ZOOM,
        maxZoom: 20,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
      });
    } catch {
      setFatal(true);
      return;
    }
    map.current = m;
    m.touchZoomRotate.disableRotation();
    m.addControl(new AttributionControl({ compact: true }), "bottom-left");
    m.on("error", (event) => {
      const { sourceId, error } = event as { sourceId?: string; error?: { status?: number } };
      // Clarity answers 404 for empty tiles on purpose and MapLibre falls back
      // to the parent tile, so only other failures are worth telling the user.
      if ((sourceId === "clarity" || sourceId === "streets") && error?.status !== 404)
        setTileError(true);
    });
    function reportZoom() {
      setZoom(m.getZoom());
      callbacks.current.onZoomChange(m.getZoom());
    }
    m.on("zoomend", reportZoom);
    m.on("load", () => {
      reportZoom();
      if (m.getContainer().clientWidth < 640)
        container.current
          ?.querySelector(".maplibregl-ctrl-attrib")
          ?.classList.remove("maplibregl-compact-show");
      d = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map: m, coordinatePrecision: 9 }),
        undoRedo: { modeLevel: new TerraDrawModeUndoRedo() },
        modes: [
          new TerraDrawPolygonMode({
            pointerDistance: 14,
            keyEvents: { cancel: null, finish: null },
            pointerEvents: {
              leftClick: (event) => {
                const draft = d?.getSnapshot().find((feature) => feature.properties.currentlyDrawing && feature.geometry.type === "Polygon");
                if (draft?.geometry.type !== "Polygon") return true;
                const points = draft.geometry.coordinates[0];
                const count = Number(draft.properties.committedCoordinateCount);
                const pointer = m.project([event.lng, event.lat]);
                const first = m.project(points[0] as [number, number]);
                const last = m.project(points[count - 1] as [number, number]);
                if (pointer.dist(first) <= 14) return count >= 3;
                return pointer.dist(last) > 14;
              },
              rightClick: true, contextMenu: false, onDragStart: true, onDrag: true, onDragEnd: true,
            },
            styles: {
              fillColor: "#c3e77a",
              fillOpacity: (feature) => feature.properties.currentlyDrawing ? 0 : 0.34,
              outlineOpacity: (feature) => feature.properties.currentlyDrawing ? 0 : 1,
              outlineColor: "#c3e77a",
              outlineWidth: 3,
              closingPointColor: "#ffffff",
              closingPointOutlineColor: "#145a37",
              closingPointWidth: 0,
              closingPointOutlineWidth: 0,
            },
          }),
          new TerraDrawSelectMode({
            flags: {
              polygon: {
                feature: {
                  draggable: false,
                  selfIntersectable: false,
                  coordinates: { draggable: true, midpoints: true, deletable: true },
                },
              },
            },
            keyEvents: { delete: null, deselect: null, rotate: null, scale: null },
            styles: {
              selectedPolygonColor: "#c3e77a",
              selectedPolygonFillOpacity: 0.34,
              selectedPolygonOutlineColor: "#c3e77a",
              selectedPolygonOutlineWidth: 3,
              selectionPointColor: "#ffffff",
              selectionPointOutlineColor: "#145a37",
              selectionPointWidth: 7,
              selectionPointOutlineWidth: 3,
              midPointColor: "#c3e77a",
              midPointOutlineColor: "#145a37",
            },
          }),
        ],
      });
      draw.current = d;
      m.addSource("field-draft", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      d.start();
      m.addLayer({ id: "field-draft", type: "line", source: "field-draft", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#c3e77a", "line-width": 3 } });
      m.addLayer({
        id: "field-draft-points", type: "circle", source: "field-draft", filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": ["case", ["get", "first"], 8, 5],
          "circle-color": ["case", ["get", "first"], "#145a37", "#ffffff"],
          "circle-stroke-color": ["case", ["get", "first"], "#ffffff", "#145a37"],
          "circle-stroke-width": 2,
        },
      });
      m.addSource("field-hover", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "field-hover", type: "circle", source: "field-hover", paint: {
        "circle-radius": 12, "circle-color": "#1f7a4d", "circle-opacity": 0.2,
        "circle-stroke-color": "#ffffff", "circle-stroke-width": 2,
      } });
      const hint = new Popup({ closeButton: false, closeOnClick: false, offset: 18, anchor: "bottom", className: styles.pointHint });
      let hovered = "";
      function clearHover() {
        if (!hovered) return;
        hovered = "";
        hint.remove();
        (m.getSource("field-hover") as GeoJSONSource).setData({ type: "FeatureCollection", features: [] });
        m.getCanvas().style.cursor = "";
      }
      m.on("mousemove", (event) => {
        if (!callbacks.current.editable || event.originalEvent.buttons) { clearHover(); return; }
        const draft = d?.getSnapshot().find((feature) => feature.properties.currentlyDrawing && feature.geometry.type === "Polygon");
        const points = draft?.geometry.type === "Polygon"
          ? draft.geometry.coordinates[0].slice(0, Number(draft.properties.committedCoordinateCount))
          : currentRing();
        const index = points?.findIndex((point) => m.project(point as [number, number]).dist(event.point) <= 14) ?? -1;
        if (!points || index < 0) { clearHover(); return; }
        const coordinate = points[index] as [number, number];
        const key = `${coordinate}:${Boolean(draft)}:${points.length}:${callbacks.current.t.land.closeBoundary}`;
        if (hovered === key) return;
        hovered = key;
        const copy = callbacks.current.t.land;
        const text = draft ? index === 0 ? points.length >= 3 ? copy.closeBoundary : copy.needPoints : copy.draftPoint : copy.editPoint;
        (m.getSource("field-hover") as GeoJSONSource).setData({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: coordinate } });
        hint.setLngLat(coordinate).setText(text).addTo(m);
        m.getCanvas().style.cursor = draft ? index === 0 && points.length >= 3 ? "pointer" : "crosshair" : "grab";
      });
      m.on("mouseout", clearHover);
      m.on("mousedown", clearHover);
      d.on("history", () => setCanUndo(d?.canUndo() ?? false));

      const initial = callbacks.current.initialArea;
      if (initial) {
        const geometry = polygonFromRing(initial);
        const [result] = d.addFeatures([
          { type: "Feature", id: FIELD_ID, properties: { mode: "polygon" }, geometry },
        ]);
        if (result.valid) {
          m.fitBounds(bounds(geometry), { padding: fitPadding(m), maxZoom: 17, duration: 0 });
          if (callbacks.current.editable) {
            d.setMode("select");
            d.selectFeature(FIELD_ID);
          }
        }
      }

      d.on("finish", (id) => {
        const feature = d?.getSnapshotFeature(id);
        if (!d || feature?.geometry.type !== "Polygon") return;
        try {
          measure(feature.geometry);
        } catch {
          d.clear();
          callbacks.current.onInvalidBoundary();
          return;
        }
        d.clear();
        d.addFeatures([
          { type: "Feature", id: FIELD_ID, properties: { mode: "polygon" }, geometry: feature.geometry },
        ]);
        d.setMode("select");
        d.selectFeature(FIELD_ID);
        setDrawingState(false);
        callbacks.current.onAreaChange(ringFromPolygon(feature.geometry));
      });
      d.on("change", (_ids, type) => {
        if (type !== "update") clearHover();
        const draft = d?.getSnapshot().find((feature) => feature.properties.currentlyDrawing && feature.geometry.type === "Polygon");
        const features: Feature[] = [];
        if (draft?.geometry.type === "Polygon") {
          const coordinates = draft.geometry.coordinates[0];
          features.push({
            type: "Feature", properties: {},
            geometry: { type: "LineString", coordinates: coordinates.slice(0, -1) },
          });
          coordinates.slice(0, Number(draft.properties.committedCoordinateCount)).forEach((coordinate, index) => {
            features.push({ type: "Feature", properties: { first: index === 0 }, geometry: { type: "Point", coordinates: coordinate } });
          });
        }
        (m.getSource("field-draft") as GeoJSONSource).setData({ type: "FeatureCollection", features });
        if (type !== "update" || d?.getMode() !== "select") return;
        const ring = currentRing();
        if (!ring) return;
        try {
          measure(polygonFromRing(ring));
          callbacks.current.onAreaChange(ring);
        } catch {
          callbacks.current.onInvalidBoundary();
        }
      });
      reportZoom();
      setReady(true);
    });

    const resize = new ResizeObserver(() => m.resize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      d?.stop();
      m.remove();
      map.current = null;
      draw.current = null;
    };
  }, []);

  useEffect(() => {
    const d = draw.current;
    const m = map.current;
    if (!ready || !d || !m) return;
    m.setProjection({ type: props.editable ? "globe" : "mercator" });
    const hasField = Boolean(d.getSnapshotFeature(FIELD_ID));
    if (props.editable) {
      if (hasField && d.getMode() !== "polygon") {
        d.setMode("select");
        d.selectFeature(FIELD_ID);
      }
    } else {
      if (d.getMode() === "polygon") {
        d.clear();
        setDrawingState(false);
      }
      d.setMode("static");
    }
  }, [props.editable, ready]);

  useEffect(() => {
    if (!drawing) return;
    function cancel(event: KeyboardEvent) {
      if ((event.target as HTMLElement).matches("input, textarea, select, [contenteditable=true]")) return;
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        draw.current?.undo();
        return;
      }
      if (event.key !== "Escape") return;
      draw.current?.clear();
      draw.current?.setMode("static");
      setDrawingState(false);
    }
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [drawing]);

  function toggleBase() {
    const m = map.current;
    if (!m) return;
    const next = !satellite;
    m.setLayoutProperty("basemap-clarity", "visibility", next ? "visible" : "none");
    m.setLayoutProperty("basemap-streets", "visibility", next ? "none" : "visible");
    setSatellite(next);
  }

  const { t } = props;
  const canDraw = zoom >= MIN_DRAW_ZOOM;

  return (
    <div className={`${styles.frame} absolute inset-0 ${props.editable ? styles.cosmos : "bg-[#2e4a22]"}`} data-panel={props.editable ? "left" : undefined} aria-busy={!ready}>
      <div ref={container} className="h-full w-full" />
      {fatal && (
        <p role="alert" className="absolute inset-x-4 top-20 rounded-xl bg-white p-4 text-sm">
          {t.map.webglError}
        </p>
      )}
      {tileError && (
        <p role="status" className="surface absolute left-1/2 top-24 max-w-[calc(100%-120px)] -translate-x-1/2 px-4 py-2 text-sm">
          {t.map.tileError}
        </p>
      )}
      {drawing && (
        <button type="button" className="btn-secondary absolute bottom-28 right-3 gap-2 lg:right-5" disabled={!canUndo} onClick={() => draw.current?.undo()}>
          <Undo2 size={18} aria-hidden="true" />{t.land.undoPoint}
        </button>
      )}
      <div role="group" aria-label={t.map.tools} className="absolute right-3 top-20 flex flex-col gap-2 lg:right-5 lg:top-5">
        {props.editable && (
          <button
            type="button"
            className="icon-btn"
            aria-label={t.map.draw}
            title={canDraw ? t.map.draw : t.land.zoomFirst}
            aria-pressed={drawing}
            disabled={!ready || !canDraw}
            onClick={() => {
              if (!drawing) beginDrawing();
            }}
          >
            <PenLine size={20} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="icon-btn" aria-label={t.map.switchBase} title={satellite ? t.map.street : t.map.satellite} onClick={toggleBase} disabled={!ready}>
          <Layers size={20} aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" aria-label={t.map.zoomIn} onClick={() => map.current?.zoomIn()}>
          <Plus size={20} aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" aria-label={t.map.zoomOut} onClick={() => map.current?.zoomOut()}>
          <Minus size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
});

export default MapPicker;
