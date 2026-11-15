import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const tile = readFileSync(join(__dirname, "fixtures/flat-dem.png"));

test.beforeEach(async ({ page }) => {
  await page.route("https://clarity.maptiles.arcgis.com/**", (route) => route.fulfill({ contentType: "image/png", body: tile }));
});

test("landing shows the product in Indonesian and English and starts the input flow", async ({ page }) => {
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ status: 401, json: { detail: "Masuk dulu." } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sesuaikan pola tanam dengan iklim dan tanah lahan Anda.");
  await expect(page.getByText("Gambar buatan SI", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dibuat untuk sawah kecil, dari Sabang sampai Merauke" })).toBeVisible();
  await expect(page.getByText("BPS, Sensus Pertanian 2023").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Masuk", exact: true })).toHaveAttribute("href", "/login?lang=id");
  await expect(page.getByRole("link", { name: "Mulai dari lahan Anda" }).first()).toHaveAttribute("href", "/lahan?lang=id");

  await page.getByRole("group", { name: "Bahasa" }).getByRole("button", { name: "EN" }).click();
  await expect(page).toHaveURL(/\/\?lang=en$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Adapt your planting to your field's climate and soil.");
  await expect(page.getByRole("heading", { name: "Built for small farms, from Sabang to Merauke" })).toBeVisible();
  await expect(page.getByText("16.89 million")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/login?lang=en");
  await page.getByRole("link", { name: "Start with your field" }).first().click();
  await expect(page).toHaveURL(/\/lahan\?lang=en$/);
});

test("landing introduces Cropy with its abilities and a sample conversation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Cropy", exact: true }).click();
  const section = page.getByRole("region", { name: "Kenalan dengan Cropy, asisten AI untuk pertanian Anda" });
  await expect(section).toBeInViewport();
  for (const ability of ["Membuka lahan tersimpan", "Tahu tahap tanam sekarang", "Fokus ke pertanian"]) {
    await expect(section.getByText(ability, { exact: true })).toBeVisible();
  }
  const chat = section.locator("ol");
  await expect(chat.getByRole("listitem")).toHaveCount(4);
  await expect(section.locator("[data-cropy-orb]")).toHaveCount(4);
  await expect(chat.getByRole("listitem").last()).toHaveCSS("opacity", "1", { timeout: 10_000 });
  await expect(page.getByRole("status", { name: "Cropy sedang mengetik" })).toHaveCount(0);
  await expect(section).not.toContainText("Kalau Anda masuk");

  await page.goto("/?lang=en");
  await expect(page.getByRole("region", { name: "Meet Cropy, the AI assistant for your farm" })).toContainText("rainfed field");
});

test("a signed-in visitor still sees the landing with a link to saved fields", async ({ page }) => {
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ json: { id: "user", username: "petani" } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sesuaikan pola tanam dengan iklim dan tanah lahan Anda.");
  await expect(page.getByRole("link", { name: "Lahan saya", exact: true })).toHaveAttribute("href", "/akun?lang=id");
  await expect(page.getByRole("link", { name: "Masuk", exact: true })).toHaveCount(0);
});

test("old input links on the root path move to /lahan with the same plan", async ({ page }) => {
  const query = "langkah=2&area=110.892,-7.0915;110.8928,-7.0914;110.8928,-7.092;110.892,-7.0921&pola=kosong&air=tadah_hujan&lang=id";
  await page.goto(`/?${query}`);
  await expect(page).toHaveURL(/\/lahan\?/);
  const url = new URL(page.url());
  for (const [key, value] of new URLSearchParams(query)) expect(url.searchParams.get(key)).toBe(value);
});

for (const width of [390, 1440]) {
  test(`landing fits a ${width}px screen without sideways scrolling`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const header = page.getByRole("banner");
    const expanded = await header.boundingBox();
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect(header).toHaveCSS("position", "fixed");
    await expect(header).toHaveCSS("top", "12px");
    const compact = await header.boundingBox();
    expect(compact!.height).toBeLessThan(expanded!.height);
    expect(compact!.width).toBeLessThan(expanded!.width);
    await expect(header.getByRole("link", { name: "Masuk", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).toHaveCSS("top", "0px");
  });
}
