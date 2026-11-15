import { expect, test } from "@playwright/test";

test("Cinunuk Bandung can be searched and selected through the real backend", async ({ page }) => {
  test.setTimeout(45000);
  await page.route(/https:\/\/(clarity\.maptiles\.arcgis\.com|services\.arcgisonline\.com)\//, (route) => route.abort());
  await page.goto("/lahan?lang=id");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  const response = page.waitForResponse((res) => res.url().includes("/api/v1/geocode?q=Cinunuk"));
  await page.getByLabel("Cari desa atau koordinat").fill("Cinunuk");
  await page.getByRole("button", { name: "Cari", exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  expect((await result.json()).results.some((place: { name: string }) => place.name.includes("Cileunyi"))).toBe(true);
  await page.getByRole("button", { name: /Cinunuk, Cileunyi/ }).click();
  await expect(page.getByLabel("Cari desa atau koordinat")).toHaveValue(/Cinunuk, Cileunyi/);
  await expect(page.getByRole("button", { name: "Mulai gambar", exact: true })).toBeEnabled({ timeout: 15000 });
});
