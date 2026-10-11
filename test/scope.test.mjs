// Scope guard: this repo is the provider/partner settlement backend, never part of the consumer journey.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const R = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
test("docs, demo and MCP describe provider/partner settlement, not customers", () => {
  assert.match(R("README.md"), /not for customers/i);
  assert.match(R("llms.txt"), /not customers/i);
  assert.match(R("web/index.html"), /data-scope="provider-settlement"/);
  assert.match(R("docs/INTEGRATION.md"), /never calls it:\*\* the consumer comparison app/);
  assert.match(R("scripts/build-site.mjs"), /scope: "provider\/partner settlement backend/);
  for (const f of ["README.md", "web/index.html", "llms.txt", "bin/ots-mcp.js"]) assert.doesNotMatch(R(f), /pay(ing)? customers|customer payouts?|cashback in crypto/i, f);
});
