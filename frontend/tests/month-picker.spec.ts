import { expect, test } from "@playwright/test";

const url = "/?langkah=2&area=110.892,-7.0915;110.8928,-7.0914;110.8928,-7.092;110.892,-7.0921&pola=kosong&air=tadah_hujan";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-14T05:00:00Z"));
});

test("month picker has two year buttons, twelve months and closes after selection", async ({ page }) => {
  await page.goto(url);
  const field = page.getByRole("button", { name: /^Mulai tanam/ });
  await expect(field).toContainText("November 2026");
  await expect(page).toHaveURL(/horizon=12/);
  await expect(page.getByRole("button", { name: /Bulan sebelumnya|Bulan berikutnya/ })).toHaveCount(0);
  const before = new URL(page.url()).searchParams;
  await field.click();
  const picker = page.getByRole("dialog", { name: "Mulai tanam", exact: true });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("combobox")).toHaveCount(0);
  const years = picker.getByRole("group", { name: "Tahun", exact: true });
  await expect(years.getByRole("button")).toHaveText(["2026", "2027"]);
  await expect(years.getByRole("button", { name: "2026" })).toHaveAttribute("aria-pressed", "true");
  const months = picker.getByRole("group", { name: "Bulan", exact: true });
  await expect(months.getByRole("button")).toHaveCount(12);
  expect(await months.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(3);
  await expect(months.getByRole("button", { name: "November 2026", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(months.getByRole("button", { name: "Januari 2026", exact: true })).toBeDisabled();
  await years.getByRole("button", { name: "2027" }).click();
  await expect(years.getByRole("button", { name: "2027" })).toHaveAttribute("aria-pressed", "true");
  await months.getByRole("button", { name: "Januari 2027", exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(field).toContainText("Januari 2027");
  await expect(field).toBeFocused();
  await expect(page).toHaveURL(/mulai=2027-01/);
  const after = new URL(page.url()).searchParams;
  for (const key of ["area", "pola", "horizon", "air"]) expect(after.get(key)).toBe(before.get(key));
  await field.click();
  await page.keyboard.press("Escape");
  await expect(picker).toBeHidden();
  await expect(field).toBeFocused();
  await field.press("Space");
  await expect(picker).toBeVisible();
  await page.getByRole("heading", { name: "Apa rencana di lahan ini?" }).click();
  await expect(picker).toBeHidden();
  await page.reload();
  await expect(field).toContainText("Januari 2027");
});

for (const width of [320, 1440]) {
  test(`month picker stays below the field at ${width}px and respects reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${url}&lang=en`);
    const field = page.getByRole("button", { name: /^Planting starts/ });
    await field.click();
    const picker = page.getByRole("dialog", { name: "Planting starts", exact: true });
    await expect(picker).toBeVisible();
    const bounds = (await picker.boundingBox())!;
    const fieldBounds = (await field.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y).toBeGreaterThanOrEqual(fieldBounds.y + fieldBounds.height);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
    await expect(picker.getByRole("group", { name: "Year", exact: true }).getByRole("button")).toHaveText(["2026", "2027"]);
    await expect(picker).toHaveCSS("animation-name", "none");
    await page.keyboard.press("Escape");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await field.click();
    await expect(picker).toHaveCSS("animation-duration", "0.2s");
    await expect(picker).toHaveCSS("opacity", "1");
    await page.screenshot({ path: `/tmp/month-year-picker-${width}.png` });
  });
}
