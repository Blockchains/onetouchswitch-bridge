// Browser demo — every number is fetched live; nothing is hard-coded.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const FEEDS = { ethereum: "0x5c0Ab2d9b5a7ed9f470386e82BB36A3613cDd4b5", base: "0xCceA6576904C118037695eB71195a5425E69Fa15" };
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
let SNAP = null, SANC = null;
async function rpc(url, method, params) { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result; }
const word = (hex, i) => BigInt("0x" + hex.slice(2 + 64 * i, 2 + 64 * (i + 1)));
const rpcUrl = (c) => SNAP?.rpc?.[c]?.ok ? SNAP.rpc[c].data.url : (c === "base" ? "https://mainnet.base.org" : "https://ethereum-rpc.publicnode.com");

(async () => {
  SNAP = await (await fetch("v1/ots.json", { cache: "no-store" })).json();
  $("gen").textContent = `Snapshot generated ${new Date(SNAP.generated_at).toLocaleString("en-GB", { timeZone: "Europe/London" })} (UK time)`;
  const fx = SNAP.gbp_usd.ethereum.data;
  $("fx").textContent = `£1 = $${fx.rate.toFixed(4)}`; $("fxm").innerHTML = `Round updated ${esc(fx.updated_at)} · <a href="${esc(fx.explorer)}">feed</a>`;
  $("cost").innerHTML = "<tr><th>Chain</th><th>Gas</th><th>GBP</th></tr>" + ["base", "ethereum"].map((c) => { const s = SNAP.payout_cost[c]; return s.ok ? `<tr><td>${c}</td><td>${s.data.gas_units}</td><td>£${s.data.total_fee_gbp.toFixed(s.data.total_fee_gbp < 0.01 ? 5 : 3)}</td></tr>` : `<tr><td>${c}</td><td colspan=2 class=bad>${esc(s.error)}</td></tr>`; }).join("");
  $("rpc").innerHTML = ["base", "ethereum"].map((c) => { const s = SNAP.rpc[c]; return s.ok ? `<tr><td>${c}</td><td><code>${esc(s.data.url)}</code></td><td>${s.data.snapshot_healthy}/${s.data.snapshot_total} healthy</td></tr>` : `<tr><td>${c}</td><td class=bad colspan=2>${esc(s.error)}</td></tr>`; }).join("");
  const rails = SNAP.payout_rails.data.rails;
  $("rails").innerHTML = "<tr><th>Peg</th><th>Coin</th><th>Supply</th><th>Peg dev.</th><th>On Base</th></tr>" + Object.entries(rails).flatMap(([peg, rows]) => rows.map((r) => `<tr><td>${peg.replace("pegged", "")}</td><td><a href="${esc(r.defillama_url)}">${esc(r.symbol)}</a></td><td>${r.circulating ? (r.circulating / 1e6).toFixed(1) + "m" : "—"}</td><td>${r.peg_deviation_pct == null ? "—" : r.peg_deviation_pct + "%"}</td><td>${r.on_base ? "yes" : "no"}</td></tr>`)).join("");
  const idx = await (await fetch("v1/index.json")).json();
  $("eps").innerHTML = idx.endpoints.map((u) => `<li><a href="${esc(u)}">${esc(u.split("/").pop())}</a></li>`).join("");
})().catch((e) => { $("gen").textContent = "Failed to load snapshot: " + e.message; });

$("fxlive").onclick = async () => {
  $("fxlivev").textContent = "Calling Chainlink…";
  try { const url = rpcUrl("base"); const r = await rpc(url, "eth_call", [{ to: FEEDS.base, data: "0xfeaf968c" }, "latest"]);
    const rate = Number(word(r, 1)) / 1e8, at = new Date(Number(word(r, 3)) * 1000).toISOString();
    $("fxlivev").innerHTML = `Base feed via <code>${esc(url)}</code>: <b>${rate.toFixed(4)}</b> (updated ${esc(at)})`;
  } catch (e) { $("fxlivev").innerHTML = `<span class=bad>${esc(e.message)}</span>`; }
};
$("scr").onclick = async () => {
  const a = $("addr").value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) { $("scrv").innerHTML = "<span class=bad>Not a 0x address (ENS: use the MCP/SDK)</span>"; return; }
  SANC ||= await (await fetch("v1/sanctioned-evm.json")).json();
  const hit = SANC.addresses.includes(a.toLowerCase());
  $("scrv").innerHTML = (hit ? "<b class=bad>BLOCK — on OFAC SDN list</b>" : "<b class=ok>PASS (OFAC only)</b>") + ` · list of ${SANC.count}, built ${esc(SANC.generated_at)} · <a href="${esc(BLLens.fromText(a, "base"))}">inspect</a>`;
};
$("chk").onclick = async () => {
  const t = $("tx").value.trim(); let hash = t;
  try { if (/^https?:/.test(t)) { const d = BLLens.detect(t); if (!d || d.kind !== "tx") throw new Error("Not an explorer tx URL"); if (d.chain !== "base") throw new Error("Only Base receipts here"); hash = d.value; } } catch (e) { $("chkv").innerHTML = `<span class=bad>${esc(e.message)}</span>`; return; }
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) { $("chkv").innerHTML = "<span class=bad>Need a tx hash</span>"; return; }
  $("chkv").textContent = "Fetching receipt…";
  try { const rc = await rpc(rpcUrl("base"), "eth_getTransactionReceipt", [hash]); if (!rc) throw new Error("Not found on Base");
    const xs = rc.logs.filter((l) => l.address.toLowerCase() === USDC_BASE && l.topics[0] === TRANSFER).map((l) => `0x${l.topics[2].slice(26)} ← ${(Number(BigInt(l.data)) / 1e6).toLocaleString("en-GB")} USDC`);
    $("chkv").innerHTML = `Status: <b class=${rc.status === "0x1" ? "ok" : "bad"}>${rc.status === "0x1" ? "success" : "reverted"}</b> · block ${Number(rc.blockNumber)}<br>${xs.length ? xs.map(esc).join("<br>") : "No USDC transfers"}<br><a href="${esc(BLLens.fromText(hash, "base"))}">Decode in Blockchain Lab Tools</a>`;
  } catch (e) { $("chkv").innerHTML = `<span class=bad>${esc(e.message)}</span>`; }
};
