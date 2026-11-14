import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "./geocode.js";

test("search endpoint validates input, normalizes results, throttles, and reports provider failures", async (t) => {
  let now = 10000;
  t.mock.method(Date, "now", () => now);
  const upstream = t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      features: [
        {
          geometry: { type: "Point", coordinates: [110.36, -7.8] },
          properties: {
            name: "Yogyakarta",
            country: "Indonesia",
            type: "city",
          },
        },
      ],
    }),
  );
  const empty = await GET(new Request("http://localhost/api/geocode?q="));
  assert.equal(empty.status, 400);
  assert.equal(upstream.mock.callCount(), 0);
  const good = await GET(
    new Request("http://localhost/api/geocode?q=Yogyakarta"),
  );
  assert.equal(good.status, 200);
  assert.deepEqual((await good.json()).results[0].center, [110.36, -7.8]);
  const rapid = await GET(
    new Request("http://localhost/api/geocode?q=Jakarta"),
  );
  assert.equal(rapid.status, 429);
  assert.equal(rapid.headers.get("Retry-After"), "1");
  assert.equal(upstream.mock.callCount(), 1);
  now += 1100;
  const cached = await GET(new Request("http://localhost/api/geocode?q=Yogyakarta"));
  assert.equal(cached.status, 200);
  assert.equal(upstream.mock.callCount(), 1);
  now += 86401000;
  await GET(new Request("http://localhost/api/geocode?q=Yogyakarta"));
  assert.equal(upstream.mock.callCount(), 2);
  now += 1100;
  upstream.mock.mockImplementation(
    async () => new Response("", { status: 503 }),
  );
  const failed = await GET(
    new Request("http://localhost/api/geocode?q=Jakarta"),
  );
  assert.equal(failed.status, 502);
  assert.match((await failed.json()).error, /unavailable/);
  now += 1100;
  upstream.mock.mockImplementation(async () => Response.json({ invalid: true }));
  const malformed = await GET(new Request("http://localhost/api/geocode?q=Jakarta"));
  assert.equal(malformed.status, 502);
});
