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
  await page.getByText("Dari mana angka ini", { exact: true }).click();
  await page.getByText("Detail pengolahan data", { exact: true }).click();
  await expect(page.getByText("Data area grid adalah estimasi, bukan pengukuran langsung di lahan.")).toBeVisible();
  await expect(page.getByText(/divalidasi/)).toHaveCount(0);
});

test("the results screen shows the submitted plan and changes it only through the form", async ({ page }) => {
  await page.route("**/api/v1/analyze", (route) => route.fulfill({ contentType: "application/json", body: analysis }));
  await page.goto(`/hasil?${plan}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pola biasa Anda dan dua pilihan lain");

  const summary = page.getByRole("definition");
  await expect(summary.first()).toHaveText("Nov 2026 – Okt 2027 · 12 bulan");
  await expect(summary.nth(1)).toHaveText("Tadah hujan");
  await expect(page.getByRole("radio", { name: "Irigasi" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^(6|18|24|12 bln)$/ })).toHaveCount(0);

  const edit = new URL((await page.getByRole("link", { name: "Ubah rencana" }).getAttribute("href"))!, "http://x");
  expect(edit.pathname).toBe("/lahan");
  expect(Object.fromEntries(edit.searchParams)).toMatchObject({ langkah: "2", mulai: "2026-11", horizon: "12", air: "tadah_hujan" });
});

test("a climate outage shows a retry instead of an empty page", async ({ page }) => {
  let outage = true;
  await page.route("**/api/v1/analyze", async (route) => {
    if (outage) return route.fulfill({ status: 502, contentType: "application/json", body: '{"detail":"NASA POWER unavailable"}' });
    return route.fulfill({ contentType: "application/json", body: analysis });
  });
  await page.goto(`/hasil?${plan}`);
  await expect(page.getByRole("alert").filter({ hasText: "Analisis belum berhasil" })).toContainText("Data iklim belum selesai diproses atau tidak tersedia untuk lahan ini.");
  outage = false;
  await page.getByRole("button", { name: "Coba lagi" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pola biasa Anda dan dua pilihan lain");
});

test("an incomplete plan points back to the form", async ({ page }) => {
  await page.goto("/hasil?mulai=2026-11&horizon=12&lang=id");
  await expect(page.getByText("Rencana belum lengkap.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ubah rencana" })).toBeVisible();
});

test("pattern explanations use the requested format and distinguish usual patterns from recommendations", async ({ page }) => {
  await page.route("**/api/v1/analyze", (route) => route.fulfill({ contentType: "application/json", body: analysis }));
  await page.goto(`/hasil?${plan}`);
  const explanation = page.getByRole("region", { name: "Bagaimana pola biasa Anda dinilai?" });
  await expect(explanation).toContainText("bukan rekomendasi baru");
  await expect(explanation.getByRole("list", { name: "Penilaian per tahap" }).getByRole("listitem")).toHaveCount(3);
  await expect(explanation.getByRole("heading", { name: "Dasar rekomendasi", exact: true })).toHaveCount(0);
  await expect(explanation.getByRole("heading", { name: "Catatan penting", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: /Hemat air/ }).click();
  const recommended = page.getByRole("region", { name: "Mengapa pola ini direkomendasikan?" });
  await expect(recommended).toContainText("Jagung ditempatkan pada Mar 2027 sampai Jun 2027");
  await expect(recommended.getByText("8 dari 9 tahun", { exact: true })).toBeVisible();
  await recommended.getByText("Catatan", { exact: true }).click();
  await expect(recommended).toContainText("Ada 4 bulan lahan terbuka");
  await recommended.screenshot({ path: "/tmp/tani-recommendation-explanation.png" });
});

test("unavailable soil is not listed as a source used for the recommendation", async ({ page }) => {
  const result = JSON.parse(analysis);
  result.context.soil = { status: "unavailable" };
  await page.route("**/api/v1/analyze", (route) => route.fulfill({ json: result }));
  await page.goto(`/hasil?${plan}`);
  const explanation = page.getByRole("region", { name: "Bagaimana pola biasa Anda dinilai?" });
  await expect(explanation).not.toContainText("SoilGrids");
});

test("result sections display the LLM points supplied by the backend", async ({ page }) => {
  const result = JSON.parse(analysis);
  result.strategies[0].explanation = {
    assessment: ["Penilaian AI untuk tanaman pertama.", "Penilaian AI untuk tanaman kedua."],
    basis: ["Dasar AI dari data historis."],
    cautions: ["Catatan AI untuk kondisi lahan."],
  };
  await page.route("**/api/v1/analyze", (route) => route.fulfill({ json: result }));
  await page.goto(`/hasil?${plan}`);
  const section = page.getByRole("region", { name: "Bagaimana pola biasa Anda dinilai?" });
  await expect(section.getByRole("list", { name: "Penilaian per tahap" }).getByRole("listitem")).toHaveText(result.strategies[0].explanation.assessment);
  for (const point of result.strategies[0].explanation.cautions) await expect(section).toContainText(point);
  await expect(section).not.toContainText(result.strategies[0].explanation.basis[0]);
});

test("LLM points are split into a highlighted lead, year counts and short notes", async ({ page }) => {
  const result = JSON.parse(analysis);
  result.strategies[0].explanation = {
    assessment: ["Padi sawah, Agu–Nov 2027: hujan memenuhi batas kebutuhan pada 7 dari 9 tahun acuan; pemeriksaan aturan K5 gagal."],
    basis: ["Sumber iklim: NASA POWER, periode 2016-01-01/2025-12-31; data dari sel grid sekitar 50 km."],
    cautions: ["Frekuensi historis bukan ramalan; hitungan memakai 60% tahun acuan.", "Hujan adalah estimasi area.", "Sesuaikan dengan penyuluh; ini bukan jaminan hasil."],
  };
  await page.route("**/api/v1/analyze", (route) => route.fulfill({ json: result }));
  await page.goto(`/hasil?${plan}`);
  const section = page.getByRole("region", { name: "Bagaimana pola biasa Anda dinilai?" });
  const stage = section.getByRole("list", { name: "Penilaian per tahap" }).getByRole("listitem");
  await expect(stage.getByText("Padi sawah, Agu–Nov 2027", { exact: true })).toBeVisible();
  await expect(stage.getByText("7 dari 9 tahun", { exact: true })).toBeVisible();
  await expect(stage).toContainText("Pemeriksaan aturan K5 gagal.");
  await expect(section).toContainText("Hitungan memakai 60% tahun acuan.");
  await section.getByText("Lihat 2 catatan lain", { exact: true }).click();
  await expect(section).toContainText("Ini bukan jaminan hasil.");
  await section.screenshot({ path: "/tmp/tani-explanation-tidy.png" });
});
