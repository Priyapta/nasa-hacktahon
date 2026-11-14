import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const resultUrl = "/hasil?lahan=field-1&area=110.9,-7.1;110.901,-7.1;110.901,-7.099&pola=kosong&mulai=2026-11&horizon=12&air=irigasi&lang=id";
const analysis = readFileSync(join(__dirname, "fixtures/analyze.json"), "utf8");

test("navbar is global and a logged-in sidebar stays on details and the planting form", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-14T10:00:00Z"));
  let signedIn = true;
  await page.route("**/api/v1/auth/**", (route) => {
    if (route.request().method() === "POST") { signedIn = false; return route.fulfill({ json: { ok: true } }); }
    return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { id: "user", username: "petani" } : { detail: "Masuk dulu." } });
  });
  await page.route("**/api/v1/fields**", (route) => route.fulfill({ json: { id: "field-1", name: "Sawah utara", fields: [] } }));
  await page.route("**/api/v1/analyze", (route) => route.fulfill({ contentType: "application/json", body: analysis }));
  await page.route("**/api/v1/crops**", (route) => route.fulfill({ contentType: "application/json", body: readFileSync(join(__dirname, "fixtures/crops.json"), "utf8") }));

  await page.goto(resultUrl);
  await expect(page.getByRole("banner")).toHaveCount(1);
  const nav = page.getByRole("navigation", { name: "Navigasi utama" });
  await expect(nav).toBeVisible();
  await expect(page.getByRole("list", { name: "Langkah" })).toHaveCount(0);
  await page.getByRole("link", { name: "Ubah rencana", exact: true }).click();
  await expect(page).toHaveURL(/langkah=2/);
  await expect(nav).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByLabel("Bahasa")).toHaveCount(1);
  await nav.getByRole("link", { name: "Tambah lahan" }).click();
  await expect(page).toHaveURL(/\/\?lang=id$/);
  await expect(nav.getByRole("link", { name: "Tambah lahan" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("list", { name: "Langkah" })).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(1);

  await page.goto(resultUrl);
  await expect(nav).toBeVisible();
  await page.screenshot({ path: "/tmp/tani-global-shell-detail.png", fullPage: true });
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?lang=id$/);
  await expect(page.getByRole("heading", { name: "Masuk akun" })).toBeVisible();
  await expect(nav).toHaveCount(0);
  await expect(page.getByRole("banner")).toHaveCount(1);
});

test("mobile sidebar can open from details without replacing the global navbar", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ json: { id: "user", username: "petani" } }));
  await page.route("**/api/v1/fields/**", (route) => route.fulfill({ json: { id: "field-1", name: "Sawah utara" } }));
  await page.route("**/api/v1/analyze", (route) => route.fulfill({ contentType: "application/json", body: analysis }));
  await page.goto(resultUrl);
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await menu.click();
  await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(1);
  await page.getByRole("link", { name: "Lahan saya", exact: true }).press("Escape");
  await expect(menu).toBeFocused();
  await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeHidden();
  const name = page.getByLabel("Nama lahan", { exact: true });
  await expect(name).toHaveValue("Sawah utara");
  const inputBox = await name.boundingBox();
  const saveBox = await page.getByRole("button", { name: "Simpan perubahan" }).boundingBox();
  expect(inputBox!.width).toBeGreaterThan(250);
  expect(saveBox!.y).toBeGreaterThanOrEqual(inputBox!.y + inputBox!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/tani-global-shell-mobile.png", fullPage: true });
});
