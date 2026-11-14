import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const analysis = readFileSync(join(__dirname, "fixtures/analyze.json"), "utf8");
const tile = readFileSync(join(__dirname, "fixtures/flat-dem.png"));
const plan =
  "area=110.892,-7.0915;110.8928,-7.0914;110.8928,-7.092;110.892,-7.0921&pola=padi_sawah,padi_sawah,bera:4&mulai=2026-11&horizon=12&air=tadah_hujan&lang=id";

async function mockTiles(page: Page) {
  await page.route("https://clarity.maptiles.arcgis.com/**", (route) => route.fulfill({ contentType: "image/png", body: tile }));
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-14T05:00:00Z"));
  await mockTiles(page);
});

test("the results screen animates the chosen strategy month by month", async ({ page }) => {
  let body: Record<string, unknown> | null = null;
  await page.route("**/api/v1/analyze", async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ contentType: "application/json", body: analysis });
  });
  await page.goto(`/hasil?${plan}`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pola biasa Anda dan dua pilihan lain");
  expect(body).toMatchObject({ lang: "id", water_source: "tadah_hujan", time: { start_month: "2026-11", horizon_months: 12 } });

  const months = page.getByRole("group", { name: "Pilih bulan" });
  const status = page.locator('[aria-live="polite"]');
  await expect(status).toContainText("Nov 2026");
  await expect(status).toContainText("Tanam");
  await expect(status).toContainText("hujan tahap cukup di 9 dari 9 tahun");

  await months.getByRole("button", { name: /^Februari 2027/ }).click();
  await expect(status).toContainText("Panen");

  await months.getByRole("button", { name: /^April 2027/ }).click();
  await expect(status).toContainText("Padi sawah mulai Mar 2027 hanya punya 1 dari 4 bulan basah.");

  await page.getByRole("radio", { name: /Hemat air/ }).click();
  await expect(page.getByRole("heading", { name: /Lahan Anda sepanjang musim dengan Hemat air/ })).toBeVisible();
  await months.getByRole("button", { name: /^Mei 2027/ }).click();
  await expect(status).toContainText("Jagung");
  await expect(status).toContainText("hujan tahap cukup di 8 dari 9 tahun");

  await months.getByRole("button", { name: /^Agustus 2027/ }).click();
  await expect(status).toContainText("Lahan istirahat 4 bulan");
  await expect(page.getByText("Kebutuhan air", { exact: true })).toBeVisible();

  await page.getByRole("group", { name: "Kelas hujan per bulan" }).getByRole("button", { name: /^Januari/ }).click();
  await expect(status).toContainText("Jan 2027");

  await expect(page.getByText("Lempung berliat")).toBeVisible();
  await expect(page.getByText("2.183 mm")).toBeVisible();
});

test("changing the water source runs the analysis again from the URL", async ({ page }) => {
  const sources: string[] = [];
  await page.route("**/api/v1/analyze", async (route) => {
    sources.push(route.request().postDataJSON().water_source);
    await route.fulfill({ contentType: "application/json", body: analysis });
  });
  await page.goto(`/hasil?${plan}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pola biasa Anda dan dua pilihan lain");
  await page.getByRole("radio", { name: "Irigasi" }).click();
  await expect(page).toHaveURL(/air=irigasi/);
  await expect.poll(() => sources.at(-1)).toBe("irigasi");
});

test("a climate outage shows a retry instead of an empty page", async ({ page }) => {
  let outage = true;
  await page.route("**/api/v1/analyze", async (route) => {
    if (outage) return route.fulfill({ status: 502, contentType: "application/json", body: '{"detail":"NASA POWER unavailable"}' });
    return route.fulfill({ contentType: "application/json", body: analysis });
  });
  await page.goto(`/hasil?${plan}`);
  await expect(page.getByRole("alert").filter({ hasText: "Analisis belum berhasil" })).toContainText("Data iklim NASA POWER sedang tidak bisa diambil.");
  outage = false;
  await page.getByRole("button", { name: "Coba lagi" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pola biasa Anda dan dua pilihan lain");
});

test("an incomplete plan points back to the form", async ({ page }) => {
  await page.goto("/hasil?mulai=2026-11&horizon=12&lang=id");
  await expect(page.getByText("Rencana belum lengkap.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ubah rencana" })).toBeVisible();
});
