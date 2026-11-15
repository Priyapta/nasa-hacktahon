import type { Map, StyleSpecification } from "maplibre-gl";

export const terrainSourceId = "maptiler-terrain";
export const clarityTileUrl =
  "https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false";
export function clarityStyle(indonesiaOverview = false): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    projection: { type: "globe" },
    sources: {
      clarity: {
        type: "raster",
        tiles: [clarityTileUrl],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          '<a href="https://www.esri.com/arcgis-blog/products/imagery/imagery/world-imagery-clarity-a-clearer-view-of-the-world">Esri World Imagery (Clarity)</a> · Esri, Vantor, Earthstar Geographics, IGN, and the GIS User Community',
      },
      streets: {
        type: "raster",
        tiles: [
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}?blankTile=false",
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          "Esri World Street Map · Esri, HERE, Garmin, USGS, and the GIS User Community",
      },
    },
    layers: [
      {
        id: "basemap-clarity",
        type: "raster",
        source: "clarity",
        paint: { "raster-fade-duration": 300 },
      },
      {
        id: "basemap-streets",
        type: "raster",
        source: "streets",
        layout: { visibility: "none" },
        paint: { "raster-fade-duration": 300 },
      },
    ],
  };
  if (indonesiaOverview) {
    style.sources.countries = {
      type: "geojson",
      data: "/maps/countries.geojson",
      attribution: '<a href="https://www.naturalearthdata.com/">Natural Earth</a>',
    };
    style.layers.push(
      {
        id: "overview-ocean", type: "background", maxzoom: 8,
        paint: {
          "background-color": "#dce8e9",
          "background-opacity": ["interpolate", ["linear"], ["zoom"], 6, 1, 8, 0],
        },
      },
      {
        id: "overview-countries", type: "fill", source: "countries", maxzoom: 8,
        paint: {
          "fill-color": ["case", ["==", ["get", "country"], "IDN"], "#2e8b57", "#c3c7c5"],
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 1, 8, 0],
        },
      },
      {
        id: "overview-borders", type: "line", source: "countries", maxzoom: 8,
        paint: {
          "line-color": "#f3f5f3", "line-width": 0.6,
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.7, 8, 0],
        },
      },
    );
  }
  return style;
}
export function mapTilerTerrainUrl(key: string): string {
  return `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${encodeURIComponent(key)}`;
}
export function syncTerrain(
  map: Pick<Map, "getZoom" | "getTerrain" | "setTerrain">,
): void {
  const current = map.getTerrain();
  if (map.getZoom() >= 11) {
    if (current?.source !== terrainSourceId || current.exaggeration !== 1.4)
      map.setTerrain({ source: terrainSourceId, exaggeration: 1.4 });
  } else if (current) map.setTerrain(null);
}
