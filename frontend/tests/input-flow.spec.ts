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
  await page.goto("/lahan?lang=id");

  const draw = page.getByRole("button", { name: "Mulai gambar" });
  await expect(draw).toBeDisabled();
  const guidance = page.locator("#drawing-guidance");
  await expect(guidance).toContainText("Perbesar peta untuk menggambar lahan.");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.locator('main [data-panel="left"]')).toHaveAttribute("aria-busy", "false");
  await expect(page.locator('main [data-panel="left"]')).toHaveCSS("background-color", "rgb(13, 25, 44)");
  await expect(page.locator('main [data-panel="left"]')).toHaveCSS("background-image", /radial-gradient/);
  await page.screenshot({ path: "/tmp/field-selection-globe.png" });
  await page.getByLabel("Cari desa atau koordinat").fill("-7.0918, 110.8924");
  await page.getByRole("button", { name: "Cari", exact: true }).click();
  await expect(draw).toBeEnabled({ timeout: 15000 });
  await expect(guidance).toContainText("Siap menggambar");
  await draw.click();
  await expect(guidance).toContainText("Ketuk sudut lahan");

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
  await page.goto(`/lahan?langkah=2&area=${area}&pola=kosong&air=tadah_hujan`);
  await expect(page.getByRole("link", { name: "Bandingkan strategi" })).toBeVisible();

  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What is the plan for this field?" })).toBeVisible();
  await expect(page).toHaveURL(/lang=en/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  const launcher = page.getByRole("button", { name: "Ask Cropy" });
  await launcher.click();
  const panel = page.getByRole("dialog", { name: "Cropy", exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel("Your question", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(launcher).toBeFocused();
});

const planUrl = "/lahan?area=110.892,-7.0915;110.8928,-7.0914;110.8928,-7.092;110.892,-7.0921&pola=kosong&air=tadah_hujan";

test("drawing allows undo and only closes by pressing its first point", async ({ page }) => {
  test.setTimeout(60000);
  await mockNetwork(page);
  await page.goto("/lahan?lang=id");
  await page.getByLabel("Cari desa atau koordinat").fill("-7.0918, 110.8924");
  await page.getByRole("button", { name: "Cari", exact: true }).click();
  const draw = page.getByRole("button", { name: "Mulai gambar", exact: true });
  await expect(draw).toBeEnabled({ timeout: 15000 });
  await draw.click();
  const box = (await page.locator(".maplibregl-canvas").boundingBox())!;
  const x = box.x + box.width / 2 + 150;
  const y = box.y + box.height / 2;
  for (const [dx, dy] of [[-60, -50], [60, -50], [10, 80]]) {
    await page.mouse.click(x + dx, y + dy);
  }
  await expect(page.getByText("Luas lahan", { exact: true })).toHaveCount(0);
  await page.mouse.move(x - 60, y - 50);
  await expect(page.getByText("Klik titik pertama untuk menutup batas", { exact: true })).toBeVisible();
  await page.mouse.move(x - 140, y - 100);
  await expect(page.getByText("Klik titik pertama untuk menutup batas", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "/tmp/field-open-draft.png" });
  await page.getByRole("button", { name: "Urungkan titik", exact: true }).click();
  await page.mouse.click(x - 60, y - 50);
  await expect(page.getByText("Luas lahan", { exact: true })).toHaveCount(0);
  await page.mouse.click(x + 60, y + 50);
  await page.mouse.click(x - 40, y + 100);
  await page.keyboard.press("Backspace");
  await page.mouse.click(x - 60, y + 50);
  await page.mouse.click(x - 60, y + 50);
  await expect(page.getByText("Luas lahan", { exact: true })).toHaveCount(0);
  await page.mouse.click(x - 60, y - 50);
  await expect(page.getByText("Luas lahan", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/area=/);
  const area = new URL(page.url()).searchParams.get("area")!;
  expect(area.split(";")).toHaveLength(4);
  await page.mouse.move(x + 60, y + 50);
  await expect(page.getByText("Geser untuk memperbaiki. Klik kanan untuk menghapus", { exact: true })).toBeVisible();
  await page.mouse.click(x + 60, y + 50, { button: "right" });
  await expect.poll(() => new URL(page.url()).searchParams.get("area")?.split(";").length).toBe(3);
});
type MotionFrame = {
  left: number; top: number; width: number; height: number; radius: number;
  opacity: number; fontSize: string; transform: string; time: number;
  mapLeft: number; mapWidth: number; summaryLeft: number; summaryTop: number;
};

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`one card morphs between land and plan with motion preference ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await mockNetwork(page);
    await page.goto(planUrl);
    const next = page.getByRole("link", { name: "Lanjut isi rencana" });
    await expect(next).toBeVisible();
    await expect(page.getByRole("button", { name: "Gambar ulang" })).toBeEnabled();
    const originalCard = await page.locator('section[aria-labelledby="lahan-judul"]').elementHandle();
    const start = (await originalCard!.boundingBox())!;
    await page.evaluate(() => {
      const state = window as typeof window & { planFrames: MotionFrame[]; finishedAt: number };
      state.planFrames = [];
      state.finishedAt = 0;
      const card = document.querySelector<HTMLElement>('section[aria-labelledby="lahan-judul"]')!;
      const map = document.querySelector("main")!.firstElementChild!;
      new MutationObserver(() => {
        if (!card.style.width) {
          if (state.planFrames.length) state.finishedAt = performance.now();
          return;
        }
        const bounds = card.getBoundingClientRect();
        const mapBounds = map.getBoundingClientRect();
        const summary = document.querySelector("main > .surface")?.getBoundingClientRect();
        const style = getComputedStyle(card);
        state.planFrames.push({
          left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height,
          radius: parseFloat(style.borderTopLeftRadius), opacity: Number(style.opacity),
          fontSize: getComputedStyle(card.querySelector("h1")!).fontSize,
          transform: style.transform, time: performance.now(),
          mapLeft: mapBounds.left, mapWidth: mapBounds.width,
          summaryLeft: summary?.left ?? 0, summaryTop: summary?.top ?? 0,
        });
      }).observe(card, { attributes: true, attributeFilter: ["style"], subtree: true });
    });
    await next.click();
    const card = page.getByRole("complementary", { name: "Apa rencana di lahan ini?" });
    await expect(card).toBeVisible();
    expect(await card.evaluate((element, original) => element === original, originalCard)).toBe(true);
    await expect(card).not.toHaveAttribute("style", /overflow/);
    await expect(card).toHaveCSS("width", "560px");
    await expect(card).toHaveCSS("border-radius", "0px");
    const frames = await page.evaluate(() => (window as typeof window & { planFrames: MotionFrame[] }).planFrames);
    if (reducedMotion === "reduce") expect(frames).toEqual([]);
    else {
      expect(frames.length, JSON.stringify(frames)).toBeGreaterThanOrEqual(3);
      expect(frames[0].width).toBeCloseTo(start.width, 0);
      expect(frames[0].left).toBeCloseTo(start.x, 0);
      expect(frames[0].top).toBeCloseTo(start.y, 0);
      expect(frames[0].height).toBeCloseTo(start.height, 0);
      expect(frames[0].radius).toBe(16);
      expect(frames.every(frame => frame.opacity === 1 && frame.transform === "none" && frame.fontSize === "26px")).toBe(true);
      expect(frames.some(frame => frame.width > 380.5 && frame.width < 559.5)).toBe(true);
      expect(frames.every((frame, index) => index === 0 || frame.width >= frames[index - 1].width - 0.1)).toBe(true);
      expect(frames.every(frame => frame.mapLeft === 0 && frame.mapWidth === 1440)).toBe(true);
      expect(frames.every(frame => frame.summaryLeft === 580 && frame.summaryTop === 88)).toBe(true);
      const finishedAt = await page.evaluate(() => (window as typeof window & { finishedAt: number }).finishedAt);
      expect(finishedAt - frames[0].time).toBeGreaterThan(750);
      expect(finishedAt - frames[0].time).toBeLessThan(2500);
    }
    await expect(page).toHaveURL(/langkah=2/);
    await expect(page.getByRole("heading", { name: "Apa rencana di lahan ini?" })).not.toBeFocused();
    await page.screenshot({ path: `/tmp/plan-card-${reducedMotion}.png` });

    await page.evaluate(() => { (window as typeof window & { planFrames: MotionFrame[] }).planFrames = []; });
    const back = page.getByRole("link", { name: "Kembali", exact: true });
    await back.focus();
    await back.press("Enter");
    await expect(next).toBeVisible();
    const landCard = page.locator('section[aria-labelledby="lahan-judul"]');
    await expect(landCard).not.toHaveAttribute("style", /overflow/);
    await expect(landCard).toHaveCSS("width", "380px");
    await expect(landCard).toHaveCSS("border-radius", "16px");
    expect(await landCard.evaluate((element, original) => element === original, originalCard)).toBe(true);
    await expect(landCard.getByRole("heading")).toBeFocused();
    const reverse = await page.evaluate(() => (window as typeof window & { planFrames: MotionFrame[] }).planFrames);
    if (reducedMotion === "reduce") expect(reverse).toEqual([]);
    else {
      expect(reverse[0].width).toBeCloseTo(560, 0);
      expect(reverse.some(frame => frame.width > 380.5 && frame.width < 559.5)).toBe(true);
      expect(reverse.every((frame, index) => frame.opacity === 1 && (index === 0 || frame.width <= reverse[index - 1].width + 0.1))).toBe(true);
    }
  });
}

test("step URLs render immediately and browser history preserves the form", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await mockNetwork(page);
  await page.goto(`${planUrl}&langkah=2`);
  const card = page.locator('section[aria-labelledby="rencana-judul"]');
  await expect(card).toBeVisible();
  await expect(card).not.toHaveAttribute("style", /width/);
  await page.getByRole("button", { name: "18 bulan" }).click();
  await expect(page).toHaveURL(/horizon=18/);
  await page.getByRole("link", { name: "Ubah lahan" }).click();
  await expect(page.locator('section[aria-labelledby="lahan-judul"]')).not.toHaveAttribute("style", /overflow/);
  await page.goBack();
  await expect(card).toBeVisible();
  await expect(card).not.toHaveAttribute("style", /overflow/);
  await expect(page.getByRole("button", { name: "18 bulan" })).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await expect(page.getByRole("link", { name: "Lanjut isi rencana" })).toBeVisible();
});

test("rapid navigation, resize and motion changes settle the card without stale styles", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await mockNetwork(page);
  await page.goto(planUrl);
  const next = page.getByRole("link", { name: "Lanjut isi rencana" });
  const back = page.getByRole("link", { name: "Kembali", exact: true });
  await next.dispatchEvent("click");
  await back.dispatchEvent("click");
  const landCard = page.locator('section[aria-labelledby="lahan-judul"]');
  await expect(landCard).not.toHaveAttribute("style", /overflow/);
  await expect(landCard).toHaveCSS("width", "380px");
  await next.dispatchEvent("click");
  await expect(page.locator('section[aria-labelledby="rencana-judul"]')).toHaveAttribute("style", /width/);
  await page.setViewportSize({ width: 360, height: 740 });
  const card = page.locator('section[aria-labelledby="rencana-judul"]');
  await expect(card).not.toHaveAttribute("style", /overflow/);
  await expect(card).toHaveCSS("width", "360px");
  await back.click();
  await expect(landCard).toHaveAttribute("style", /width/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(landCard).not.toHaveAttribute("style", /overflow/);
  expect(await landCard.evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(360);
});

for (const width of [320, 360, 768, 1024]) {
  test(`card transitions stay within a ${width}px viewport`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await mockNetwork(page);
    await page.setViewportSize({ width, height: 740 });
    await page.goto(planUrl);
    await page.getByRole("link", { name: "Lanjut isi rencana" }).click();
    const card = page.locator('section[aria-labelledby="rencana-judul"]');
    await expect(card).not.toHaveAttribute("style", /overflow/);
    expect(await card.evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(width);
    expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const compare = page.getByRole("link", { name: "Bandingkan strategi" });
    await compare.scrollIntoViewIfNeeded();
    await expect(compare).toBeInViewport();
    await compare.click({ trial: true });
    const canvas = page.locator(".maplibregl-canvas");
    const mapSize = await canvas.evaluate(element => ({ width: element.clientWidth, frameWidth: element.closest("main")!.firstElementChild!.clientWidth }));
    expect(mapSize.width).toBe(mapSize.frameWidth);
    await page.screenshot({ path: `/tmp/plan-card-${width}.png` });
    await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>('section[aria-labelledby="rencana-judul"]')!;
      const map = document.querySelector("main")!.firstElementChild!;
      const heights: number[] = [];
      (window as typeof window & { mapHeights: number[] }).mapHeights = heights;
      new MutationObserver(() => { if (card.style.width) heights.push(map.getBoundingClientRect().height); })
        .observe(card, { attributes: true, attributeFilter: ["style"] });
    });
    await page.getByRole("link", { name: "Kembali", exact: true }).click();
    await expect(page.locator('section[aria-labelledby="lahan-judul"]')).not.toHaveAttribute("style", /overflow/);
    const mapHeights = await page.evaluate(() => (window as typeof window & { mapHeights: number[] }).mapHeights);
    expect(new Set(mapHeights).size).toBe(1);
  });
}
