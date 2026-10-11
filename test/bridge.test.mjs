// Live tests (org rule: no mocks). A failure can be an upstream outage — re-run before changing code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { OTSBridge, GBP_USD_FEEDS, USDC } from "../src/bridge.js";

const b = new OTSBridge();
const SANCTIONED = "0x0330070FD38Ec3bB94F58FA55D40368271E9e54A"; // first ETH row of the OFAC SDN dataset

test("Chainlink GBP/USD on Ethereum and Base agree and are plausible", async () => {
  const [e, ba] = await Promise.all([b.gbpUsd("ethereum"), b.gbpUsd("base")]);
  for (const r of [e, ba]) { assert.equal(r.pair, "GBP/USD"); assert.ok(r.rate > 0.8 && r.rate < 2.5, `rate ${r.rate}`); assert.ok(r.age_s < 3 * 86400, `stale ${r.age_s}s`); }
  assert.equal(e.feed, GBP_USD_FEEDS.ethereum);
  assert.ok(Math.abs(e.rate - ba.rate) / e.rate < 0.02);
});

test("healthy RPC comes from rpc-health dataset and is verified live", async () => {
  for (const c of ["base", "ethereum"]) { const r = await b.healthyRpc(c); assert.ok(r.url.startsWith("https://")); assert.ok(r.block > 0); assert.ok(r.snapshot_total > 0); }
});

test("payout rails list USDC on Base and GBP-pegged coins", async () => {
  const r = await b.payoutRails();
  const usdc = r.rails.peggedUSD.find((x) => x.symbol === "USDC");
  assert.ok(usdc && usdc.on_base === true && Math.abs(usdc.peg_deviation_pct) < 2);
  assert.ok(r.rails.peggedGBP.length > 0);
});

test("USDC payout cost on Base is real and cheaper than Ethereum", async () => {
  const [base, eth] = await Promise.all([b.payoutCost("base"), b.payoutCost("ethereum")]);
  for (const c of [base, eth]) { assert.ok(c.gas_units > 21000 && c.gas_units < 200000, `gas ${c.gas_units}`); assert.ok(c.total_fee_gbp > 0); assert.match(c.sample_sender, /^0x[0-9a-fA-F]{40}$/); }
  assert.ok(base.total_fee_gbp < eth.total_fee_gbp);
});

test("screening: OFAC-listed address BLOCKs, ENS resolves and PASSes, garbage is invalid", async () => {
  const bad = await b.screenPayoutAddress(SANCTIONED);
  assert.equal(bad.valid && bad.decision, "BLOCK");
  const ok = await b.screenPayoutAddress("vitalik.eth");
  assert.equal(ok.valid && ok.decision, "PASS_OFAC_ONLY");
  const junk = await b.screenPayoutAddress("not-an-address");
  assert.equal(junk.valid, false);
});

test("verify a real recent USDC transfer on Base", async () => {
  const head = Number(await b.rpc("base", "eth_blockNumber"));
  const topic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const logs = await b.rpc("base", "eth_getLogs", [{ address: USDC.base, topics: [topic], fromBlock: "0x" + (head - 20).toString(16), toBlock: "0x" + (head - 5).toString(16) }]);
  assert.ok(logs.length > 0, "no recent USDC transfers on Base");
  const l = logs[0]; const to = "0x" + l.topics[2].slice(26);
  const r = await b.verifyPayoutTx("base", l.transactionHash, { expectTo: to });
  assert.equal(r.status, "success");
  assert.ok(r.usdc_transfers.length >= 1);
  assert.ok(r.links.tx.includes("blockchainlab-tools/tx/"));
});

test("onetouchswitch.com sitemap search", async () => {
  const r = await b.otsPages("guides");
  assert.ok(r.total_urls > 50); assert.ok(r.results.every((x) => x.url.includes("guides")));
});

test("blockchainlab-index knows the AggregatorV3Interface we call", async () => {
  const p = await b.feedInterfaceProvenance();
  assert.ok(p.components.some((c) => c.startsWith("chainlink-evm:")));
});
