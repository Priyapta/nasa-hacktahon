import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const fixtures = join(__dirname, "../../backend/contracts/fixtures");
const sample = JSON.parse(readFileSync(join(__dirname, "../../backend/data/soilgrids/samples.json"), "utf8")).samples[0];
const area = sample.location.coordinates[0].slice(0, -1).map((p: number[]) => p.join(",")).join(";");
const plan = new URLSearchParams({ langkah: "2", area, pola: "padi_sawah,bera:4", air: "tadah_hujan", horizon: "12", lang: "id" });
const strategyCards = (page: import("@playwright/test").Page) =>
  page.getByRole("radiogroup", { name: /Pilih strategi|Pick a strategy/ }).getByRole("radio");

test("input form submits real inputs through the FE proxy and renders backend strategies", async ({ page }) => {
  test.setTimeout(60000);
  // Only map imagery is stubbed; crops and analysis use the actual backend.
  await page.route(/https:\/\/(clarity\.maptiles\.arcgis\.com|services\.arcgisonline\.com)\//, (route) => route.abort());
  const crops = page.waitForResponse((response) => response.url().includes("/api/v1/crops") && response.status() === 200);
  await page.goto(`/lahan?${plan}`);
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
  await expect(strategyCards(page)).toHaveCount(body.strategies.length);
  for (const strategy of body.strategies) await expect(strategyCards(page).filter({ hasText: strategy.label })).toHaveCount(1);
});

test("analysis failure can be retried and fewer candidates are rendered as returned", async ({ page }) => {
  let outage = true;
  let retried = 0;
  const result = JSON.parse(readFileSync(join(fixtures, "analyze_fewer_candidates.json"), "utf8"));
  await page.route("**/api/v1/analyze", async (route) => {
    if (outage) return route.fulfill({ status: 502, json: { detail: [{ loc: [], msg: "Data iklim belum bisa diambil." }] } });
    retried++;
    await route.fulfill({ json: result });
  });
  await page.goto(`/hasil?${plan}`);
  await expect(page.locator("main").getByRole("alert")).toContainText("Data iklim NASA POWER sedang tidak bisa diambil.");
  outage = false;
  await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pola biasa Anda dan satu pilihan lain");
  await expect(strategyCards(page)).toHaveCount(result.strategies.length);
  expect(retried).toBe(1);
});

test("changing language ignores an obsolete response and requests localized analysis", async ({ page }) => {
  const result = JSON.parse(readFileSync(join(fixtures, "analyze_success.json"), "utf8"));
  const langs: string[] = [];
  await page.route("**/api/v1/analyze", async (route) => {
    const lang = route.request().postDataJSON().lang;
    langs.push(lang);
    if (lang === "id") await new Promise((resolve) => setTimeout(resolve, 1000));
    const strategies = result.strategies.map((s: { label: string }) => ({ ...s, label: lang === "en" ? `${s.label} EN` : `${s.label} lama` }));
    await route.fulfill({ json: { ...result, strategies } }).catch(() => {});
  });
  await page.goto(`/hasil?${plan}`);
  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your usual pattern and two other options");
  await expect(strategyCards(page).first()).toContainText("EN");
  await page.waitForTimeout(1200);
  await expect(page.getByText(/ lama$/)).toHaveCount(0);
  expect(langs.at(-1)).toBe("en");
});

test("invalid field URL never sends an analysis request", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/v1/analyze", (route) => { requests++; return route.abort(); });
  await page.goto("/hasil?area=110,-7;111,-6;110,-6;111,-7&pola=kosong&air=irigasi");
  await expect(page.getByText("Rencana belum lengkap.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ubah rencana" })).toBeVisible();
  expect(requests).toBe(0);
});
