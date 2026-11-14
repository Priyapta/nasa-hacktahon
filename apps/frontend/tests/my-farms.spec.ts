import { expect, test } from "@playwright/test";
import type { FarmField } from "../types";

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];
const fields: FarmField[] = ids.map((id, index) => {
  const x = 110 + index * 0.008;
  return {
    id,
    farmId: "farm-one",
    name: index ? "South Field" : "North Field",
    locationName: "Sleman, Yogyakarta",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [x, -7],
          [x + 0.002, -7],
          [x + 0.002, -7.002],
          [x, -7.002],
          [x, -7],
        ],
      ],
    },
    centroid: [x + 0.001, -7.001],
    areaHectares: index ? 2.46 : 1.23,
    currentCrop: index ? "Maize" : "Rice",
    previousCrop: "Soybean",
    soilType: "Loam",
    irrigationType: "Rainfed",
    notes: "",
    createdAt: "2026-01-01",
    updatedAt: "2026-11-14",
  };
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ fields }) => {
      if (!localStorage.getItem("field-atlas-v1"))
        localStorage.setItem(
          "field-atlas-v1",
          JSON.stringify({
            fields,
            farms: [
              {
                id: "farm-one",
                name: "Sleman Farm",
                locationName: "Sleman",
                createdAt: "2026-01-01",
                updatedAt: "2026-11-14",
                fields: fields.map((f) => f.id),
              },
            ],
          }),
        );
    },
    { fields },
  );
  await page.route("https://clarity.maptiles.arcgis.com/**", (route) =>
    route.fulfill({
      path: `${process.cwd()}/tests/fixtures/flat-dem.png`,
      contentType: "image/png",
    }),
  );
  await page.route("https://api.maptiler.com/**", (route) => {
    if (route.request().url().includes("tiles.json"))
      return route.fulfill({
        json: {
          tilejson: "2.2.0",
          tiles: ["https://api.maptiler.com/dem/{z}/{x}/{y}.png"],
          minzoom: 0,
          maxzoom: 14,
        },
      });
    return route.fulfill({
      path: `${process.cwd()}/tests/fixtures/flat-dem.png`,
      contentType: "image/png",
    });
  });
  await page.route("https://tiles.openfreemap.org/styles/liberty", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#f0f4ec" },
          },
        ],
      },
    }),
  );
});

test("My Farms selects saved boundaries, switches basemaps without resetting selection, and edits on satellite", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let satelliteRequests = 0;
  let fieldSatelliteRequests = 0;
  const fieldTileLevels: number[] = [];
  page.on("request", (r) => {
    if (/clarity\.maptiles|wayback\.maptiles|api\.maptiler/.test(r.url()))
      satelliteRequests++;
    const tileLevel = r.url().match(/clarity\.maptiles.*\/tile\/(1[2-9])\//);
    if (tileLevel) {
      fieldSatelliteRequests++;
      fieldTileLevels.push(Number(tileLevel[1]));
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "My Farms", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Show all fields", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".farm-list-item")).toHaveCount(2);
  await expect(page.locator(".farm-detail")).toContainText("Choose a field");
  await page
    .locator(".farm-map .maplibregl-canvas")
    .evaluate((canvas) => canvas.setAttribute("data-original-map", "true"));
  await page
    .locator(".farm-list-item")
    .filter({ hasText: "South Field" })
    .click();
  await expect(page.locator(".farm-detail h2")).toHaveText("South Field");
  await expect(
    page.locator('.farm-list-item[aria-pressed="true"]'),
  ).toContainText("South Field");
  await expect(page.locator(".farm-detail")).toContainText("2.46");
  const basemap = page.getByRole("group", { name: "Field basemap" });
  await expect(basemap.getByRole("button", { name: "Satellite", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => fieldSatelliteRequests).toBeGreaterThan(0);
  await basemap.getByRole("button", { name: "Street", exact: true }).click();
  await expect(basemap.getByRole("button", { name: "Street", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Show all fields", exact: true })
    .click();
  await expect(page.locator(".farm-detail")).toContainText("Choose a field");
  // Wait for the fitted GeoJSON source to render before hit-testing the polygon.
  await page.waitForTimeout(800);
  const satelliteCount = satelliteRequests;
  const bounds = (await page.locator(".farm-map-canvas").boundingBox())!;
  await page.mouse.click(
    bounds.x + bounds.width / 2 - 0.4 * (bounds.width - 96),
    bounds.y + bounds.height / 2,
  );
  await expect(page.locator(".farm-detail h2")).toHaveText("North Field");
  await expect(
    page.locator('.farm-list-item[aria-pressed="true"]'),
  ).toContainText("North Field");
  await expect(
    page.locator('.farm-map .maplibregl-canvas[data-original-map="true"]'),
  ).toHaveCount(1);
  expect(satelliteRequests).toBe(satelliteCount);
  await expect(basemap.getByRole("button", { name: "Street", exact: true })).toHaveAttribute("aria-pressed", "true");
  await basemap.getByRole("button", { name: "Satellite", exact: true }).click();
  await expect(page.locator(".farm-detail h2")).toHaveText("North Field");
  await expect(page.locator('.farm-map .maplibregl-canvas[data-original-map="true"]')).toHaveCount(1);
  expect(fieldTileLevels.every((level) => level <= 17)).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("my-farms-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".farm-list-item")
    .filter({ hasText: "South Field" })
    .click();
  await expect(page.locator(".farm-detail h2")).toHaveText("South Field");
  await expect(basemap.getByRole("button", { name: "Satellite", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("my-farms-mobile.png"),
    fullPage: true,
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete South Field", exact: true })
    .click();
  await expect(page.locator(".farm-list-item")).toHaveCount(1);
  await expect(page.locator(".farm-detail")).toContainText("Choose a field");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("field-atlas-v1")!),
  );
  expect(saved.fields).toHaveLength(1);
  expect(saved.fields[0].id).toBe(ids[0]);
  await page.reload();
  await page.getByRole("button", { name: "My Farms", exact: true }).click();
  await page
    .locator(".farm-list-item")
    .filter({ hasText: "North Field" })
    .click();
  await page.getByRole("button", { name: "Open field", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Save Your Field" }),
  ).toBeVisible();
  await expect(page.locator('[name="name"]')).toHaveValue("North Field");
  expect(errors).toEqual([]);
});

test("field management remains usable when the OSM basemap is unavailable", async ({
  page,
}) => {
  await page.route("https://tiles.openfreemap.org/styles/liberty", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "My Farms", exact: true }).click();
  await expect(page.locator('.farm-map [role="alert"]')).toContainText(
    "basemap could not load",
  );
  await page
    .locator(".farm-list-item")
    .filter({ hasText: "North Field" })
    .click();
  await expect(page.locator(".farm-detail h2")).toHaveText("North Field");
  await expect(
    page.getByRole("button", { name: "Open field", exact: true }),
  ).toBeEnabled();
});
