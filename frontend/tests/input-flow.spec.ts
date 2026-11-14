import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const crops = readFileSync(join(__dirname, "fixtures/crops.json"), "utf8");
const geocode = readFileSync(join(__dirname, "fixtures/geocode.json"), "utf8");
const tile = readFileSync(join(__dirname, "fixtures/flat-dem.png"));

async function mockNetwork(page: Page) {
  await page.route("**/api/v1/crops**", (route) =>
    route.fulfill({ contentType: "application/json", body: crops }),
  );
  await page.route("**/api/v1/geocode**", (route) =>
    route.fulfill({ contentType: "application/json", body: geocode }),
  );
  await page.route("https://clarity.maptiles.arcgis.com/**", (route) =>
    route.fulfill({ contentType: "image/png", body: tile }),
  );
  await page.route("https://services.arcgisonline.com/**", (route) =>
    route.fulfill({ contentType: "image/png", body: tile }),
  );
}

test("draw a field, fill the plan and reach a results link with every input", async ({ page }) => {
  test.setTimeout(60000);
  await mockNetwork(page);
  await page.goto("/");

  const draw = page.getByRole("button", { name: "Mulai gambar" });
  await expect(draw).toBeDisabled();
  await page.getByLabel("Cari desa atau koordinat").fill("-7.0918, 110.8924");
  await page.getByRole("button", { name: "Cari", exact: true }).click();
  await expect(draw).toBeEnabled({ timeout: 15000 });
  await draw.click();

  const map = page.locator(".maplibregl-canvas");
  const box = (await map.boundingBox())!;
  const cx = box.x + box.width / 2 + 150;
  const cy = box.y + box.height / 2;
  for (const [dx, dy] of [
    [-60, -50],
    [60, -50],
    [60, 50],
    [-60, 50],
    [-60, -50],
  ]) {
    await page.mouse.click(cx + dx, cy + dy);
    await page.waitForTimeout(150);
  }

  await expect(page.getByText("Luas lahan")).toBeVisible();
  await expect(page).toHaveURL(/area=/);
  await page.getByRole("link", { name: "Lanjut isi rencana" }).click();

  await expect(page.getByRole("heading", { name: "Apa rencana di lahan ini?" })).toBeVisible();
  const compare = page.getByRole("button", { name: "Bandingkan strategi" });
  await expect(compare).toBeDisabled();
  await page.getByRole("button", { name: "Padi sawah" }).click();
  await page.getByRole("button", { name: "Bera" }).click();
  await page.getByRole("button", { name: "Tambah bulan bera" }).click();
  await page.getByRole("radio", { name: /Irigasi/ }).click();
  await page.getByRole("button", { name: "18 bulan" }).click();

  const link = page.getByRole("link", { name: "Bandingkan strategi" });
  await expect(link).toBeVisible();
  const href = new URL((await link.getAttribute("href"))!, "http://x");
  expect(href.pathname).toBe("/hasil");
  expect(href.searchParams.get("pola")).toBe("padi_sawah,bera:2");
  expect(href.searchParams.get("air")).toBe("irigasi");
  expect(href.searchParams.get("horizon")).toBe("18");
  expect(href.searchParams.get("area")?.split(";").length).toBe(4);
  expect(href.searchParams.has("langkah")).toBe(false);
});

test("language toggle and Ask AI panel", async ({ page }) => {
  await mockNetwork(page);
  const area = "110.892,-7.0915;110.8928,-7.0914;110.8928,-7.092;110.892,-7.0921";
  await page.goto(`/?langkah=2&area=${area}&pola=kosong&air=tadah_hujan`);
  await expect(page.getByRole("link", { name: "Bandingkan strategi" })).toBeVisible();

  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What is the plan for this field?" })).toBeVisible();
  await expect(page).toHaveURL(/lang=en/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  const launcher = page.getByRole("button", { name: "Ask AI" });
  await launcher.click();
  const panel = page.getByRole("dialog", { name: "Ask AI" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("not connected in this version")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(launcher).toBeFocused();
});
