import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const plan = {
  location: { type: "Polygon", coordinates: [[[110.9, -7.1], [110.901, -7.1], [110.901, -7.099], [110.9, -7.1]]] },
  rotation: { has_pattern: false, stages: [] },
  time: { start_month: "2026-01", horizon_months: 12 }, water_source: "irigasi", lang: "id",
};
const analysis = readFileSync(join(__dirname, "fixtures/analyze.json"), "utf8");
const tile = readFileSync(join(__dirname, "fixtures/flat-dem.png"));
const resultUrl = "/hasil?area=110.9,-7.1;110.901,-7.1;110.901,-7.099&pola=kosong&mulai=2026-11&horizon=12&air=irigasi&lang=id";

test("register, reopen saved land, analyze again, delete, and logout on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.clock.setFixedTime(new Date("2026-11-14T10:00:00Z"));
  let signedIn = false;
  let fields = [{ id: "field-1", name: "Sawah utara", plan, created_at: "2026-01-01" }];
  let analyses = 0;
  await page.route("**/api/v1/auth/**", async (route) => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1);
    if (action === "logout") { signedIn = false; return route.fulfill({ json: { ok: true } }); }
    if (action === "register" || action === "login") {
      expect(route.request().headers()["x-field-request"]).toBe("1");
      expect(route.request().postDataJSON()).toEqual({ username: "petani", password: "password-test" });
      signedIn = true;
    }
    return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { id: "user-1", username: "petani" } : { detail: "Masuk terlebih dahulu." } });
  });
  await page.route("**/api/v1/fields**", (route) => {
    if (route.request().method() === "DELETE") { fields = []; return route.fulfill({ json: { ok: true } }); }
    if (new URL(route.request().url()).pathname.endsWith("/field-1")) return route.fulfill({ json: fields[0] });
    return route.fulfill({ json: { fields } });
  });
  await page.route("https://clarity.maptiles.arcgis.com/**", (route) => route.fulfill({ contentType: "image/png", body: tile }));
  await page.route("**/api/v1/analyze", (route) => {
    analyses++;
    expect(route.request().postDataJSON().time.start_month).toBe("2026-11");
    return route.fulfill({ contentType: "application/json", body: analysis });
  });
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Masuk akun" })).toBeVisible();
  await page.getByRole("button", { name: "Belum punya akun? Daftar" }).click();
  await page.getByLabel("Username", { exact: true }).fill("petani");
  await page.getByLabel("Password", { exact: true }).fill("password-test");
  await page.getByRole("button", { name: "Buat akun", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sawah utara" })).toBeVisible();
  await expect(page).toHaveURL(/\/akun$/);
  await expect(page.getByRole("link", { name: "Tambah lahan", exact: true })).toHaveAttribute("href", "/?lang=id");
  await expect(page.getByText("Jadwal lewat, dihitung dari Nov 2026")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/tani-account-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "Lihat hasil", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("pilihan lain");
  expect(analyses).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("link", { name: "Lahan saya", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Hapus Sawah utara" }).click();
  await expect(page.getByText(/Belum ada lahan tersimpan/)).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Navigasi utama" });
  await expect(nav.getByRole("link", { name: "Tambah lahan", exact: true })).toBeVisible();
  await nav.getByRole("link", { name: "Tambah lahan", exact: true }).press("Escape");
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Masuk akun" })).toBeVisible();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("link", { name: "Tambah lahan", exact: true })).toHaveCount(0);
});

test("save errors, sign-in return link, and successful save preserve the plan", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-14T10:00:00Z"));
  await page.route("**/api/v1/analyze", (route) => route.fulfill({ contentType: "application/json", body: analysis }));
  let authenticated = false;
  const fields: unknown[] = [];
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ json: { id: "user-1", username: "petani" } }));
  await page.route("**/api/v1/fields", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { fields } });
    expect(route.request().headers()["x-field-request"]).toBe("1");
    const data = route.request().postDataJSON();
    expect(data.name).toBe("Sawah barat");
    expect(data.plan).toMatchObject({ water_source: "irigasi", rotation: { has_pattern: false, stages: [] } });
    const saved = { ...data, id: "field-2", created_at: "2026-11-14" };
    if (authenticated) fields.push(saved);
    return route.fulfill({ status: authenticated ? 201 : 401, json: authenticated ? saved : { detail: "Masuk terlebih dahulu." } });
  });
  await page.goto(resultUrl);
  await expect(page.getByRole("list", { name: "Langkah", exact: true })).toBeVisible();
  await page.getByLabel("Nama lahan", { exact: true }).fill("Sawah barat");
  await page.getByRole("button", { name: "Simpan lahan", exact: true }).click();
  const login = page.getByRole("link", { name: "Masuk / daftar" });
  await expect(login).toBeVisible();
  const href = new URL((await login.getAttribute("href"))!, "http://localhost");
  expect(href.pathname).toBe("/login");
  expect(href.searchParams.get("kembali")).toBe(resultUrl);
  authenticated = true;
  await page.getByRole("button", { name: "Simpan lahan", exact: true }).click();
  await expect(page).toHaveURL(/\/akun\?lang=id&tersimpan=field-2$/);
  await expect(page.getByRole("heading", { name: "Sawah barat" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("sudah tersimpan");
  expect(fields).toHaveLength(1);
});

test("account errors can retry; login works with keyboard and returns to the field", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  let fail = true;
  let signedIn = false;
  await page.route("**/api/v1/auth/**", (route) => {
    if (fail) return route.fulfill({ status: 503, json: { detail: "Penyimpanan sedang tidak tersedia." } });
    if (route.request().method() === "POST") signedIn = true;
    return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { id: "user", username: "petani" } : { detail: "Masuk dulu." } });
  });
  await page.route("**/api/v1/fields", (route) => route.fulfill({ json: { fields: [] } }));
  await page.goto(`/akun?kembali=${encodeURIComponent(resultUrl)}`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Penyimpanan sedang tidak tersedia.");
  fail = false;
  await page.getByRole("button", { name: "Coba lagi" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page.getByLabel("Username", { exact: true }).focus();
  await page.keyboard.type("petani");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.type("password-test");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Lahan saya" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("link", { name: "Kembali ke lahan" })).toHaveAttribute("href", resultUrl);
});

test("login and account pages follow the active session and preserve the return link", async ({ page }) => {
  let signedIn = false;
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({
    status: signedIn ? 200 : 401,
    json: signedIn ? { id: "user", username: "petani" } : { detail: "Masuk dulu." },
  }));
  await page.route("**/api/v1/fields", (route) => route.fulfill({ json: { fields: [] } }));
  const query = `?lang=id&kembali=${encodeURIComponent(resultUrl)}`;
  await page.goto(`/akun${query}`);
  await expect(page).toHaveURL(`/login${query}`);
  await expect(page.getByRole("heading", { name: "Masuk akun" })).toBeVisible();
  signedIn = true;
  await page.goto(`/login${query}`);
  await expect(page).toHaveURL(`/akun${query}`);
  await expect(page.getByRole("heading", { name: "Lahan saya" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kembali ke lahan" })).toHaveAttribute("href", resultUrl);
});

test("opening and editing an existing field returns to the dashboard without a duplicate", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-14T10:00:00Z"));
  let field = { id: "field-3", name: "Sawah timur", plan, created_at: "2026-11-14" };
  let updates = 0;
  let creates = 0;
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ json: { id: "user", username: "petani" } }));
  await page.route("**/api/v1/fields**", (route) => {
    const request = route.request();
    if (request.method() === "PUT") {
      expect(new URL(request.url()).pathname).toBe("/api/v1/fields/field-3");
      updates++;
      field = { ...field, ...request.postDataJSON() };
      return route.fulfill({ json: field });
    }
    if (request.method() === "POST") creates++;
    return route.fulfill({ json: new URL(request.url()).pathname.endsWith("/field-3") ? field : { fields: [field] } });
  });
  await page.route("**/api/v1/analyze", (route) => route.fulfill({ contentType: "application/json", body: analysis }));
  await page.route("**/api/v1/crops**", (route) => route.fulfill({ contentType: "application/json", body: readFileSync(join(__dirname, "fixtures/crops.json"), "utf8") }));
  await page.route("https://clarity.maptiles.arcgis.com/**", (route) => route.fulfill({ contentType: "image/png", body: tile }));
  await page.goto("/akun");
  await page.getByRole("link", { name: "Lihat hasil", exact: true }).click();
  await expect(page.getByLabel("Nama lahan", { exact: true })).toHaveValue("Sawah timur");
  await expect(page.getByRole("list", { name: "Langkah", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Perbarui lahan ini" })).toHaveCount(0);
  await expect(page.getByText("Simpan batas lahan dan pengaturan tanam.", { exact: false })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("lahan")).toBe("field-3");
  await page.getByRole("link", { name: "Ubah rencana", exact: true }).click();
  await expect(page).toHaveURL(/langkah=2/);
  expect(new URL(page.url()).searchParams.get("lahan")).toBe("field-3");
  await page.getByRole("link", { name: "Bandingkan strategi", exact: true }).click();
  await expect(page.getByLabel("Nama lahan", { exact: true })).toHaveValue("Sawah timur");
  await page.getByLabel("Nama lahan", { exact: true }).fill("Sawah timur baru");
  await page.getByRole("button", { name: "Simpan perubahan", exact: true }).click();
  await expect(page).toHaveURL(/\/akun\?lang=id&tersimpan=field-3$/);
  await expect(page.getByRole("heading", { name: "Sawah timur baru" })).toBeVisible();
  await expect(page.getByRole("term").filter({ hasText: "Lahan tersimpan" })).toBeVisible();
  await expect(page.getByRole("definition").first()).toHaveText("1");
  expect(updates).toBe(1);
  expect(creates).toBe(0);
  await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();
  await page.screenshot({ path: "/tmp/tani-dashboard-desktop.png", fullPage: true });
});
