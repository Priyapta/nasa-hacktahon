import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const fixtures = join(__dirname, "../../backend/contracts/fixtures");
const sample = JSON.parse(readFileSync(join(__dirname, "../../backend/data/soilgrids/samples.json"), "utf8")).samples[0];
const area = sample.location.coordinates[0].slice(0, -1).map((p: number[]) => p.join(",")).join(";");
const plan = new URLSearchParams({ langkah: "2", area, pola: "padi_sawah,bera:4", air: "tadah_hujan", horizon: "12", lang: "id" });

test("input form submits real inputs through the FE proxy and renders backend strategies", async ({ page }) => {
  test.setTimeout(60000);
  // Only map imagery is stubbed; crops and analysis use the actual backend.
  await page.route(/https:\/\/(clarity\.maptiles\.arcgis\.com|services\.arcgisonline\.com)\//, (route) => route.abort());
  const crops = page.waitForResponse((response) => response.url().includes("/api/v1/crops") && response.status() === 200);
  await page.goto(`/?${plan}`);
  await crops;
  await expect(page.getByRole("heading", { name: "Apa rencana di lahan ini?" })).toBeVisible();
  const response = page.waitForResponse((res) => res.url().includes("/api/v1/analyze") && res.request().method() === "POST");
  await page.getByRole("link", { name: "Bandingkan strategi" }).click();
  const res = await response;
  expect(res.status()).toBe(200);
  const input = res.request().postDataJSON();
  expect(input.location.type).toBe("Polygon");
  const ring = input.location.coordinates[0];
  expect(ring[0]).toEqual(ring[ring.length - 1]);
  expect(ring[0][0]).toBeCloseTo(sample.location.coordinates[0][0][0], 5);
  expect(input.rotation).toEqual({ has_pattern: true, stages: [{ crop_id: "padi_sawah" }, { crop_id: "bera", months: 4 }] });
  expect(input.water_source).toBe("tadah_hujan");
  expect(input.time.horizon_months).toBe(12);
  expect(input.lang).toBe("id");
  const body = await res.json();
  expect(body.context.soil.status).toBe("ok");
  await expect(page.getByTestId("analysis-results")).toBeVisible();
  for (const strategy of body.strategies) await expect(page.getByRole("heading", { name: strategy.label, exact: true })).toBeVisible();
});

test("analysis failure can be retried and fewer candidates are rendered as returned", async ({ page }) => {
  let attempts = 0;
  const result = JSON.parse(readFileSync(join(fixtures, "analyze_fewer_candidates.json"), "utf8"));
  await page.route("**/api/v1/analyze", async (route) => {
    attempts++;
    await route.fulfill(attempts === 1
      ? { status: 502, json: { detail: [{ loc: [], msg: "Data iklim belum bisa diambil." }] } }
      : { json: result });
  });
  await page.goto(`/hasil?${plan}`);
  await expect(page.locator("main").getByRole("alert")).toContainText("Data iklim belum bisa diambil.");
  await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
  await expect(page.getByTestId("analysis-results").locator("article")).toHaveCount(result.strategies.length);
  expect(attempts).toBe(2);
});

test("changing language ignores an obsolete response and requests localized analysis", async ({ page }) => {
  const result = JSON.parse(readFileSync(join(fixtures, "analyze_success.json"), "utf8"));
  await page.route("**/api/v1/analyze", async (route) => {
    const lang = route.request().postDataJSON().lang;
    if (lang === "id") await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({ json: { ...result, notes: [lang === "en" ? "English result" : "Hasil lama"] } }).catch(() => {});
  });
  await page.goto(`/hasil?${plan}`);
  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByTestId("analysis-results")).toContainText("English result");
  await expect(page.getByText("Hasil lama", { exact: true })).toHaveCount(0);
});

test("invalid field URL never sends an analysis request", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/v1/analyze", (route) => { requests++; return route.abort(); });
  await page.goto("/hasil?area=110,-7;111,-6;110,-6;111,-7&pola=kosong&air=irigasi");
  await expect(page.locator("main").getByRole("alert")).toContainText("Lengkapi batas lahan");
  expect(requests).toBe(0);
});
