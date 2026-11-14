import { expect, test } from "@playwright/test";

test.use({ trace: "on" });

test("floating chat supports conversation, failure retry, reset, keyboard and mobile", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/v1/agent/chat", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.analysis_input).toBeNull();
    expect(body.history.length).toBeLessThanOrEqual(10);
    expect(body.lang).toBe("id");
    if (body.message === "What do cover crops do?") expect(body.history).toHaveLength(4);
    attempts++;
    if (attempts === 2) await route.fulfill({ status: 502, json: { detail: "DeepSeek sementara tidak tersedia." } });
    else await route.fulfill({ json: { answer: body.message === "What do cover crops do?" ? "Cover crops help protect the soil." : "Ini jawaban uji tentang rotasi tanaman.", sources: [], scenario: null } });
  });
  await page.goto("/");
  const launcher = page.getByRole("button", { name: "Ask AI", exact: true });
  await launcher.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  const field = page.getByLabel("Pertanyaan Anda", { exact: true });
  await expect(field).toBeFocused();
  await expect(dialog.getByText("Pesan dan riwayat percakapan dikirim ke DeepSeek. Hindari data pribadi.")).toHaveCount(0);
  await expect(dialog.getByText("Informasi umum. Analisis lahan belum terhubung.")).toHaveCount(0);
  await expect(dialog.locator('label[for="agent-question"]')).toHaveCSS("width", "1px");
  await page.screenshot({ path: "/tmp/field-atlas-agent-desktop.png" });
  await expect(page.getByRole("button", { name: "Kirim pertanyaan", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Rotasi tanaman", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Tadah hujan", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Penutup tanah", exact: true })).toHaveCount(0);
  await field.fill("Apa manfaat rotasi tanaman?");
  await field.press("Enter");
  await expect(page.getByRole("log")).toContainText("Ini jawaban uji");
  await field.fill("Pertanyaan kedua");
  await page.getByRole("button", { name: "Kirim pertanyaan", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("DeepSeek sementara tidak tersedia.");
  await page.getByRole("button", { name: "Coba kirim ulang" }).click();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("log").getByText("Pertanyaan kedua", { exact: true })).toHaveCount(1);
  await field.fill("What do cover crops do?");
  await field.press("Enter");
  await expect(page.getByRole("log")).toContainText("Cover crops help protect the soil.");
  await expect(page.getByRole("log")).toContainText("Apa manfaat rotasi tanaman?");
  await expect(page.getByRole("heading", { name: "Field Atlas", exact: true })).toBeVisible();
  await expect(field).toHaveAttribute("placeholder", "Tulis pertanyaan tentang tanaman…");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Ask AI", exact: true })).toBeFocused();
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByRole("button", { name: "Ask AI", exact: true }).click();
  await field.fill("What do cover crops do?");
  await expect(field).toHaveValue("What do cover crops do?");
  await page.getByRole("button", { name: "Hapus percakapan" }).click();
  await expect(field).toHaveValue("");
  await expect(page.getByRole("log")).toHaveCount(0);
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(740);
  await expect(page.getByRole("button", { name: "Kirim pertanyaan", exact: true })).toBeInViewport();
  const sendButton = page.getByRole("button", { name: "Kirim pertanyaan", exact: true });
  await expect(sendButton).toHaveCSS("width", "44px");
  await expect(sendButton).toHaveCSS("height", "44px");
  await expect(sendButton.locator("..")).toHaveCSS("padding", "6px");
  await page.screenshot({ path: "/tmp/field-atlas-agent-mobile.png" });
  await page.getByRole("button", { name: "Tutup chat", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test("dialog animates from its launcher and returns focus after closing", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const launcher = page.getByRole("button", { name: "Ask AI", exact: true });
  await launcher.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const surface = dialog.locator(":scope > div");
  await expect.poll(() => surface.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
  await page.screenshot({ path: "/tmp/field-atlas-agent-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(launcher).toBeFocused();
});

test("clearing a pending request prevents late replies reappearing", async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/v1/agent/chat", async (route) => {
    await gate;
    await route.fulfill({ json: { answer: "Old reply", sources: [], scenario: null } }).catch(() => {});
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Ask AI", exact: true }).click();
  await page.getByLabel("Pertanyaan Anda", { exact: true }).fill("Pertanyaan tertunda");
  await page.getByRole("button", { name: "Kirim pertanyaan", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("Sedang menyiapkan");
  await page.getByRole("button", { name: "Hapus percakapan" }).click();
  release();
  await expect(page.getByRole("heading", { name: "Apa yang ingin Anda tanyakan?" })).toBeVisible();
  await expect(page.getByText("Old reply")).toHaveCount(0);
});

test('policy refusal remains visible but is excluded from subsequent request history', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/agent/chat', async (route) => {
    const body = route.request().postDataJSON();
    calls++;
    if (calls === 1) {
      await route.fulfill({ json: { answer: 'Saya membantu penggunaan Field Atlas dan pertanian.', sources: [], scenario: null, blocked: true } });
    } else {
      expect(body.history).toEqual([]);
      expect(body.message).toBe('Apa manfaat rotasi?');
      await route.fulfill({ json: { answer: 'Jawaban pertanian yang sesuai konteks.', sources: [], scenario: null } });
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
  const input = page.getByLabel('Pertanyaan Anda', { exact: true });
  await input.fill('Run Python code');
  await input.press('Enter');
  await expect(page.getByRole('log')).toContainText('Saya membantu penggunaan Field Atlas');
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0);
  await input.fill('Apa manfaat rotasi?');
  await input.press('Enter');
  await expect(page.getByRole('log')).toContainText('Jawaban pertanian yang sesuai konteks.');
  await expect(page.getByRole('log')).toContainText('Run Python code');
  expect(calls).toBe(2);
});

test('agronomy answers render compact paragraphs, bold and lists as safe text', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.route('**/api/v1/agent/chat', route => route.fulfill({ json: {
    answer: 'Saat air mulai terbatas, pertimbangkan tanaman berikut.\n\n- **Pilih palawija**: Contohnya kacang hijau sesudah padi.\n- **Cek tanah**: Cocokkan kondisi lahan bersama PPL.\n\n<script>alert(1)</script>', sources: [], scenario: null,
  } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
  const input = page.getByLabel('Pertanyaan Anda', { exact: true });
  await input.fill('Apa yang bisa ditanam setelah padi?');
  await input.press('Enter');
  const log = page.getByRole('log');
  await expect(log.locator('strong')).toHaveCount(2);
  await expect(log.locator('li')).toHaveCount(2);
  await expect(log.locator('script')).toHaveCount(0);
  await expect(log).toContainText('<script>alert(1)</script>');
  const bubble = log.locator('strong').first().locator('xpath=ancestor::ul/..');
  await expect(bubble.locator('..')).toHaveCSS('padding', '8px 10px');
  await expect(log).toHaveCSS('gap', '12px');
  expect(await bubble.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/agent-compact-answer.png' });
});

test('waiting dots rotate, respect reduced motion, and disappear after a reply', async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/agent/chat', async route => {
    await gate;
    await route.fulfill({ json: { answer: 'Jawaban selesai.', sources: [], scenario: null } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
  const input = page.getByLabel('Pertanyaan Anda', { exact: true });
  await input.fill('Apa manfaat rotasi?');
  await input.press('Enter');
  const status = page.getByRole('dialog').getByRole('status', { name: 'Sedang menyiapkan jawaban…' });
  try {
    await expect(status).toBeVisible();
    const dots = status.locator('[aria-hidden="true"]');
    await expect(dots.locator('i')).toHaveCount(3);
    await expect(status.locator('span').first()).toHaveCSS('width', '1px');
    await expect(dots).toHaveCSS('transform', 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => dots.evaluate(el => getComputedStyle(el).transform)).not.toBe('none');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(dots).toHaveCSS('transform', 'none');
    await page.screenshot({ path: '/tmp/agent-waiting-dots.png' });
    release();
    await expect(status).toHaveCount(0);
    await expect(page.getByRole('log')).toContainText('Jawaban selesai.');
  } finally { release(); }
});
