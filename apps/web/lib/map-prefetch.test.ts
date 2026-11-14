import { test } from "node:test";
import assert from "node:assert/strict";
import { prefetchTileUrls } from "./map-prefetch";

test("prefetch is limited to 18 nearby tiles at the next two native levels", () => {
  const urls = prefetchTileUrls({ lng: 110.36, lat: -7.8 }, 15);
  assert.equal(urls.length, 18);
  assert.equal(new Set(urls).size, 18);
  assert.deepEqual(
    [
      ...new Set(
        urls.map((url) =>
          Number(new URL(url).pathname.split("/tile/")[1].split("/")[0]),
        ),
      ),
    ],
    [17, 18],
  );
  assert.ok(
    urls.every((url) => new URL(url).searchParams.get("blankTile") === "false"),
  );
  assert.deepEqual(prefetchTileUrls({ lng: 110, lat: -7 }, 11), []);
  assert.deepEqual(prefetchTileUrls({ lng: 110, lat: -7 }, 18), []);
  assert.equal(prefetchTileUrls({ lng: 110, lat: -7 }, 17).length, 9);
  const fractional = prefetchTileUrls({ lng: 110, lat: -7 }, 15.8);
  assert.deepEqual(
    [
      ...new Set(
        fractional.map((url) =>
          Number(new URL(url).pathname.split("/tile/")[1].split("/")[0]),
        ),
      ),
    ],
    [18, 19],
  );
});
test("prefetch wraps the dateline and keeps polar tile indices valid", () => {
  for (const lat of [-90, 90]) {
    const urls = prefetchTileUrls({ lng: 180, lat }, 15);
    for (const url of urls) {
      const [z, y, x] = new URL(url).pathname
        .split("/tile/")[1]
        .split("/")
        .map(Number);
      assert.ok(x >= 0 && x < 2 ** z && y >= 0 && y < 2 ** z);
    }
  }
  assert.deepEqual(prefetchTileUrls({ lng: NaN, lat: 0 }, 15), []);
});
