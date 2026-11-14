import { expect, test } from "@playwright/test";

test("frontend forwards API requests to the standalone backend", async ({ request }) => {
  const invalid = await request.get("/api/geocode?q=x");
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).error).toContain("between 2 and 120");
  const unknown = await request.get("/api/missing");
  expect(unknown.status()).toBe(404);
  expect(await unknown.json()).toEqual({ error: "Not found." });
  const method = await request.post("/api/geocode");
  expect(method.status()).toBe(405);
  expect(method.headers().allow).toBe("GET");
});
