import { expect, test } from "@playwright/test";

test("frontend forwards API requests to the standalone backend", async ({ request }) => {
  const health = await request.get("/api/v1/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
  const invalid = await request.get("/api/v1/geocode?q=");
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).detail[0].loc).toContain("q");
  const unknown = await request.get("/api/missing");
  expect(unknown.status()).toBe(404);
  expect(await unknown.json()).toEqual({ detail: "Not Found" });
  const method = await request.post("/api/v1/geocode");
  expect(method.status()).toBe(405);
  expect(method.headers().allow).toBe("GET");
  const invalidChat = await request.post("/api/v1/agent/chat", { data: {} });
  expect(invalidChat.status()).toBe(400);
  expect((await invalidChat.json()).detail).toContain("2.000");
});
