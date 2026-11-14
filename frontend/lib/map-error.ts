interface MapFailure {
  sourceId?: unknown;
  error?: unknown;
}
export function mapErrorMessage(event: MapFailure): string {
  const error = (
    event.error && typeof event.error === "object" ? event.error : {}
  ) as Record<string, unknown>;
  const status = typeof error.status === "number" ? error.status : undefined;
  const message = typeof error.message === "string" ? error.message : "";
  const address = typeof error.url === "string" ? error.url : message;
  if (
    event.sourceId === "clarity" ||
    address.includes("clarity.maptiles.arcgis.com")
  )
    return `Esri Clarity (clarity.maptiles.arcgis.com) could not load${status ? ` (HTTP ${status})` : ""}. Retry or zoom out to available imagery.`;
  if (event.sourceId === "streets" || address.includes("World_Street_Map"))
    return `Esri Street map could not load${status ? ` (HTTP ${status})` : ""}. Retry shortly.`;
  if (
    address.includes("api.maptiler.com") &&
    (status === 401 || status === 403)
  )
    return `Optional MapTiler terrain denied access (HTTP ${status}). Check the terrain key or leave it empty.`;
  if (
    address.includes("api.maptiler.com") ||
    event.sourceId === "maptiler-terrain"
  )
    return `MapTiler map or terrain data could not load${status ? ` (HTTP ${status})` : ""}. Try again shortly.`;
  if (event.sourceId === "fields" || String(event.sourceId).startsWith("td-"))
    return "A field boundary could not be rendered. Reopen the field or redraw its boundary.";
  return "The map renderer could not load some data. Reload the app.";
}
