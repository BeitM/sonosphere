import assert from "node:assert/strict";
import test from "node:test";
import { bindRuntimeFetch } from "../lib/providers/runtime-fetch.ts";

test("binds external fetch calls to the runtime global instead of a provider instance", async () => {
  const observed = { context: null };
  const fetcher = function () {
    "use strict";
    observed.context = this;
    return Promise.resolve(Response.json({ ok: true }));
  };

  const response = await bindRuntimeFetch(fetcher)("https://lrclib.test/search");

  assert.equal(observed.context, globalThis);
  assert.deepEqual(await response.json(), { ok: true });
});
