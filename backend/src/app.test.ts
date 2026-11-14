import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createServer } from "node:http";
import { createApiServer } from "./app.js";

test("standalone API serves health and search over HTTP, validates input, and rejects unknown routes and methods", async (t) => {
  let upstreamQuery = "";
  const photon = createServer((request, response) => {
    upstreamQuery = request.url!;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ features: [{
      geometry: { type: "Point", coordinates: [110.36, -7.8] },
      properties: { name: "Yogyakarta", country: "Indonesia", type: "city" },
    }] }));
  });
  await new Promise<void>((resolve) => photon.listen(0, "127.0.0.1", resolve));
  const previousPhoton = process.env.PHOTON_API_URL;
  process.env.PHOTON_API_URL = `http://127.0.0.1:${(photon.address() as AddressInfo).port}/api/`;
  t.after(() => {
    if (previousPhoton === undefined) delete process.env.PHOTON_API_URL;
    else process.env.PHOTON_API_URL = previousPhoton;
    photon.close();
    photon.closeAllConnections();
  });
  const server = createApiServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  }));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  const chatMethod = await fetch(`${base}/api/v1/agent/chat`);
  assert.equal(chatMethod.status, 405);
  assert.equal(chatMethod.headers.get("Allow"), "POST");
  const chatInvalid = await fetch(`${base}/api/v1/agent/chat`, { method: "POST", body: "{}" });
  assert.equal(chatInvalid.status, 400);
  const oversized = await fetch(`${base}/api/v1/agent/chat`, { method: "POST", body: JSON.stringify({ message: "a".repeat(70_000) }) });
  assert.equal(oversized.status, 413);
  assert.deepEqual(await health.json(), { status: "ok", service: "field-atlas-api" });
  const invalid = await fetch(`${base}/api/geocode?q=x`);
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /between 2 and 120/);
  const unknown = await fetch(`${base}/missing`);
  assert.equal(unknown.status, 404);
  const method = await fetch(`${base}/api/geocode`, { method: "POST" });
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("Allow"), "GET");
  const found = await fetch(`${base}/api/geocode?q=Yogyakarta`);
  assert.equal(found.status, 200);
  assert.deepEqual((await found.json()).results[0].center, [110.36, -7.8]);
  assert.equal(new URL(upstreamQuery, "http://photon").searchParams.get("limit"), "5");
  assert.equal(new URL(upstreamQuery, "http://photon").searchParams.get("q"), "Yogyakarta");
});
