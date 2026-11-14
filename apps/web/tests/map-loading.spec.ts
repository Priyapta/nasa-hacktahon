import { expect, test } from "@playwright/test";

test("Clarity works without a basemap key and preserves field workflow", async ({
  page,
}) => {
  test.setTimeout(60000);
  const oldRequests: string[] = [];
  let demTiles = 0;
  let terrainConfigured = false;
  page.on("request", (r) => {
    if (/maps\.eox|api\.maptiler\.com\/maps/.test(r.url()))
      oldRequests.push(r.url());
  });
  await page.route("https://api.maptiler.com/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/maps/"))
      return route.fulfill({
        json: {
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#a8c9b0" },
            },
          ],
        },
      });
    if (url.pathname.endsWith("tiles.json")) {
      terrainConfigured = true;
      return route.fulfill({
        json: {
          tilejson: "2.2.0",
          tiles: ["https://api.maptiler.com/fixture/dem/{z}/{x}/{y}.png"],
          minzoom: 0,
          maxzoom: 14,
          encoding: "mapbox",
        },
      });
    }
    demTiles++;
    return route.fulfill({
      path: `${process.cwd()}/tests/fixtures/flat-dem.png`,
      contentType: "image/png",
    });
  });
  await page.route("https://clarity.maptiles.arcgis.com/**", (route) =>
    route.fulfill({
      path: `${process.cwd()}/tests/fixtures/flat-dem.png`,
      contentType: "image/png",
    }),
  );
  await page.route("https://services.arcgisonline.com/**", (route) =>
    route.fulfill({
      path: `${process.cwd()}/tests/fixtures/flat-dem.png`,
      contentType: "image/png",
    }),
  );
  await page.route("https://tiles.openfreemap.org/styles/liberty", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#f2f5ed" },
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Find My Farmland", exact: true }),
  ).toBeVisible();
  expect(demTiles).toBe(0);
  await page
    .locator(".maplibregl-canvas")
    .evaluate((c) => c.setAttribute("data-instance", "original"));
  const zoomIn = page.locator('.tools button[aria-label="Zoom in"]');
  for (let i = 0; i < 9; i++) await zoomIn.click();
  expect(demTiles).toBe(0);
  await zoomIn.click();
  if (terrainConfigured) await expect.poll(() => demTiles).toBeGreaterThan(0);
  else expect(demTiles).toBe(0);
  await page.locator('.tools button[aria-label="Return to globe"]').click();
  await expect(
    page.getByRole("button", { name: "Find My Farmland", exact: true }),
  ).toBeVisible();
  const count = demTiles;
  await page.waitForTimeout(300);
  expect(demTiles).toBe(count);
  await page
    .getByRole("textbox", { name: "Search location" })
    .fill("-7.8,110.36");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.locator('.tools button[aria-label="Draw a new field"]').click();
  const box = (await page.locator(".map").boundingBox())!;
  const x = box.x + box.width * 0.55,
    y = box.y + box.height * 0.45;
  for (const [dx, dy] of [
    [0, 0],
    [120, 0],
    [120, 100],
    [0, 100],
    [0, 0],
  ]) {
    await page.mouse.move(x + dx, y + dy);
    await page.mouse.click(x + dx, y + dy, { delay: 60 });
    await page.waitForTimeout(100);
  }
  await expect(
    page.getByRole("heading", { name: "Save Your Field" }),
  ).toBeVisible();
  for (const [name, value] of [
    ["farmName", "Clarity Farm"],
    ["name", "North Field"],
    ["currentCrop", "Rice"],
    ["previousCrop", "Soybean"],
  ])
    await page.locator(`[name="${name}"]`).fill(value);
  await page.getByRole("button", { name: "Save Field", exact: true }).click();
  await expect(page.locator(".field-form")).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("field-atlas-v1")!),
  );
  expect(saved.fields[0].geometry.type).toBe("Polygon");
  await page
    .getByRole("button", { name: "Switch to street map", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Switch to satellite imagery",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Switch to satellite imagery", exact: true })
    .click();
  await expect(
    page.locator('.maplibregl-canvas[data-instance="original"]'),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "My Farms", exact: true }).click();
  await page
    .locator(".farm-list-item")
    .filter({ hasText: "North Field" })
    .click();
  await page.getByRole("button", { name: "Open field", exact: true }).click();
  await expect(page.locator('[name="name"]')).toHaveValue("North Field");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Export saved fields as GeoJSON",
      exact: true,
    })
    .click();
  expect((await download).suggestedFilename()).toBe("field-atlas.geojson");
  expect(oldRequests).toEqual([]);
});

test("prefetch prepares at most 18 tiles at two close zooms with two concurrent requests", async ({
  page,
}) => {
  test.setTimeout(60000);
  let active = 0,
    peak = 0;
  let delay = 120;
  const prefetched: string[] = [];
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
  await page.route("https://clarity.maptiles.arcgis.com/**", async (route) => {
    const z = Number(
      new URL(route.request().url()).pathname.split("/tile/")[1].split("/")[0],
    );
    if (z === 17 || z === 18) {
      active++;
      peak = Math.max(peak, active);
      prefetched.push(route.request().url());
      await new Promise((resolve) => setTimeout(resolve, delay));
      active--;
    }
    await route.fulfill({
      path: `${process.cwd()}/tests/fixtures/flat-dem.png`,
      contentType: "image/png",
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Find My Farmland", exact: true }),
  ).toBeVisible();
  expect(prefetched).toEqual([]);
  await page
    .getByRole("textbox", { name: "Search location" })
    .fill("-7.8,110.36");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect.poll(() => prefetched.length, { timeout: 15000 }).toBe(18);
  expect(new Set(prefetched).size).toBe(18);
  expect(peak).toBeLessThanOrEqual(2);
  await page.waitForTimeout(400);
  expect(prefetched).toHaveLength(18);
  delay = 1000;
  await page
    .getByRole("textbox", { name: "Search location" })
    .fill("-7.5,110.1");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect.poll(() => prefetched.length, { timeout: 15000 }).toBe(20);
  await page.locator('.tools button[aria-label="Return to globe"]').click();
  const cancelledCount = prefetched.length;
  await page.waitForTimeout(1200);
  expect(prefetched).toHaveLength(cancelledCount);
});
