// Builds the static JSON API + demo into ./site (deployed to GitHub Pages by .github/workflows/pages.yml).
// Fails (keeping the last good deployment live) if the core Chainlink read fails.
import { mkdirSync, writeFileSync, copyFileSync, readdirSync } from "node:fs";
import { OTSBridge, VERSION, API_BASE } from "../src/bridge.js";

const BASE = "https://blockchains.github.io/onetouchswitch-bridge";
const out = new URL("../site/", import.meta.url).pathname;
mkdirSync(out + "v1", { recursive: true });
const b = new OTSBridge();
const w = (name, obj) => writeFileSync(`${out}v1/${name}`, JSON.stringify(obj, null, 1) + "\n");

const snap = await b.snapshot();
if (!snap.gbp_usd.ethereum.ok) { console.error("Chainlink GBP/USD read failed:", snap.gbp_usd.ethereum.error); process.exit(1); }
w("ots.json", snap);
const pick = (s) => (s.ok ? s.data : { error: s.error });
w("gbp-usd.json", { generated_at: snap.generated_at, ethereum: pick(snap.gbp_usd.ethereum), base: pick(snap.gbp_usd.base) });
w("payout-rails.json", pick(snap.payout_rails));
w("payout-cost.json", { generated_at: snap.generated_at, base: pick(snap.payout_cost.base), ethereum: pick(snap.payout_cost.ethereum) });
w("rpc.json", { generated_at: snap.generated_at, base: pick(snap.rpc.base), ethereum: pick(snap.rpc.ethereum) });

const sanc = await b.api.dataset("sanctioned-addresses");
const evm = [...new Set(sanc.data.filter((x) => /^0x[0-9a-fA-F]{40}$/.test(x.address)).map((x) => x.address.toLowerCase()))].sort();
w("sanctioned-evm.json", { generated_at: sanc.generated_at, source: sanc.source_url, upstream: `${API_BASE}/v1/sanctioned-addresses.json`, scope: "OFAC SDN digital-currency addresses with EVM (0x) format, lowercased. Not UK OFSI.", count: evm.length, addresses: evm });

const pages = await b.otsPages("", { limit: 1000 });
const sections = {}; for (const r of pages.results) sections[r.section] = (sections[r.section] || 0) + 1;
w("ots-pages.json", { generated_at: snap.generated_at, ...pages, sections });
w("provenance.json", await b.feedInterfaceProvenance());

const files = readdirSync(out + "v1").filter((f) => f.endsWith(".json") && f !== "index.json");
w("index.json", { name: "onetouchswitch-bridge static API", version: VERSION, generated_at: snap.generated_at, cors: "GitHub Pages serves Access-Control-Allow-Origin: *", refresh: "every 3 hours via GitHub Actions", endpoints: files.map((f) => `${BASE}/v1/${f}`), docs: "https://github.com/Blockchains/onetouchswitch-bridge/blob/main/docs/INTEGRATION.md" });
for (const f of ["index.html", "demo.js"]) copyFileSync(new URL(`../web/${f}`, import.meta.url), out + f);
writeFileSync(out + ".nojekyll", "");
console.log("built", files.length + 1, "endpoints;", snap.generated_at);
