import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const crops = readFileSync(join(__dirname, "../../backend/contracts/fixtures/crops.json"), "utf8");
const base = "/lahan?langkah=2&area=110.892,-7.0915;110.8928,-7.0914;110.8928,-7.092;110.892,-7.0921&mulai=2027-01&horizon=6&air=irigasi";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-14T05:00:00Z"));
  await page.route("**/api/v1/crops**", (route) => route.fulfill({ contentType: "application/json", body: crops }));
  await page.route(/https:\/\/(clarity\.maptiles\.arcgis\.com|services\.arcgisonline\.com)\//, (route) => route.abort());
});

test("six-month period stops extra stages and shows the final stage crossing the boundary", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(base);
  const pattern = page.locator('section[aria-labelledby="pola-judul"]');
  await pattern.getByRole("button", { name: "Padi sawah", exact: true }).click();
  await pattern.getByRole("button", { name: "Jagung", exact: true }).click();
  const stages = pattern.getByRole("listitem");
  await expect(stages).toHaveCount(2);
  // A final stage ending later is valid in the fixed backend model.
  await expect(page.getByRole("link", { name: "Bandingkan strategi", exact: true })).toBeVisible();
  await expect(stages.nth(0)).toContainText("4 bulan (acuan)");
  await expect(stages.nth(0)).toContainText("Jan 2027 – Apr 2027");
  await expect(stages.nth(1)).toContainText("Mei 2027 – Agu 2027");
  await expect(stages.nth(1)).toContainText("Selesai setelah rentang analisis");
  await expect(pattern).toContainText("Satu putaran pola: 8 bulan");
  await expect(pattern).toContainText("Rentang analisis sudah terisi");
  await expect(pattern.getByRole("button", { name: "Kedelai", exact: true })).toBeDisabled();
  await expect(page.getByRole("group", { name: "Rentang analisis", exact: true })).toBeVisible();
  await expect(page.getByText("Jan 2027 – Jun 2027", { exact: true })).toBeVisible();
  expect(await page.locator("main").innerText()).not.toContain(";");
  await page.screenshot({ path: "/tmp/fixed-plan-mobile.png" });

  await page.getByRole("button", { name: "12 bulan", exact: true }).click();
  await expect(pattern.getByRole("button", { name: "Kedelai", exact: true })).toBeEnabled();
  await pattern.getByRole("button", { name: "Kedelai", exact: true }).click();
  await pattern.getByRole("button", { name: "Bera", exact: true }).click();
  await expect(stages).toHaveCount(4);
  await page.getByRole("button", { name: "6 bulan", exact: true }).click();
  await expect(pattern).toContainText("2 tahap dimulai setelah rentang analisis berakhir");
  await expect(pattern.getByText("Tidak masuk rentang analisis", { exact: true })).toHaveCount(2);
  await expect(stages).toHaveCount(4); // Never silently erase a saved pattern.
  await expect(page.getByRole("button", { name: "Bandingkan strategi", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Bandingkan strategi", exact: true })).toHaveCount(0);
  await expect(page.getByText("Ada tahap di luar rentang analisis. Perpanjang rentang atau hapus tahap itu untuk lanjut.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "12 bulan", exact: true }).click();
  await expect(page.getByRole("link", { name: "Bandingkan strategi", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "6 bulan", exact: true }).click();
  await pattern.getByRole("button", { name: "Hapus tahap 4", exact: true }).click();
  await pattern.getByRole("button", { name: "Hapus tahap 3", exact: true }).click();
  await expect(page.getByRole("link", { name: "Bandingkan strategi", exact: true })).toBeVisible();
});

test("short patterns explain repetition and only fallow has editable months", async ({ page }) => {
  await page.goto(`${base}&pola=padi_sawah,bera:2`);
  await page.getByRole("button", { name: "12 bulan", exact: true }).click();
  const pattern = page.locator('section[aria-labelledby="pola-judul"]');
  await expect(pattern).toContainText("Satu putaran pola: 6 bulan");
  await expect(pattern).toContainText("Pola diulang dari tahap pertama");
  await expect(pattern.getByRole("button", { name: "Tambah bulan bera" })).toHaveCount(1);
  await pattern.getByRole("button", { name: "Tambah bulan bera" }).click();
  await expect(pattern).toContainText("Satu putaran pola: 7 bulan");
  await expect(pattern.getByRole("listitem").nth(1)).toContainText("Mei 2027 – Jul 2027");
});


test("a saved overlong pattern cannot submit immediately after opening the page", async ({ page }) => {
  await page.goto(`${base}&pola=padi_sawah,jagung,kedelai`);
  await expect(page.getByRole("button", { name: "Bandingkan strategi", exact: true })).toBeDisabled();
  await expect(page.getByText("Ada tahap di luar rentang analisis. Perpanjang rentang atau hapus tahap itu untuk lanjut.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bandingkan strategi", exact: true })).toHaveCount(0);
});

test("missing crop metadata blocks patterned submission but no-pattern analysis still works", async ({ page }) => {
  await page.route("**/api/v1/crops**", (route) => route.fulfill({ status: 502, json: { detail: "Unavailable" } }));
  await page.goto(`${base}&pola=padi_sawah`);
  await expect(page.getByRole("button", { name: "Bandingkan strategi", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Belum punya pola", exact: true }).click();
  await expect(page.getByRole("link", { name: "Bandingkan strategi", exact: true })).toBeVisible();
});
