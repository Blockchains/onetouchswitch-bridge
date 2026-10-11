// onetouchswitch-bridge — Blockchain Lab blocks wired for onetouchswitch.com (touch.grok.me).
// Every value comes from a live public source (Chainlink on-chain, Blockchain Lab Open Data API,
// public RPCs, DefiLlama coins, onetouchswitch.com sitemap). Nothing is mocked or hard-coded data.
// Built by Blockchain Lab — https://blockchainlab.com
import { BlockchainLab as TypedApi } from "blockchainlab-sdk";
import { toolLinks } from "blockchainlab-mcp";
import { CHAINS, evmFees, feeCost, prices, checkAddress, resolveEns, decodeTx, ethers } from "blockchainlab-mcp/onchain";

export const VERSION = "0.1.0";
export const API_BASE = "https://blockchains.github.io/blockchainlab-api";
export const OTS_SITE = "https://onetouchswitch.com";
export const LENS_DETECT = "https://blockchains.github.io/blockchainlab-lens/extension/detect.js";

/** Chainlink GBP/USD aggregator proxies (verified on-chain: description() == "GBP / USD"). */
export const GBP_USD_FEEDS = {
  ethereum: "0x5c0Ab2d9b5a7ed9f470386e82BB36A3613cDd4b5",
  base: "0xCceA6576904C118037695eB71195a5425E69Fa15",
};
/** Native Circle USDC contracts. */
export const USDC = {
  ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};
/** OP-stack GasPriceOracle predeploy (Base L1 data fee). */
const GAS_PRICE_ORACLE = "0x420000000000000000000000000000000000000F";
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
const AGG = new ethers.Interface([
  "function description() view returns (string)",
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);
const ERC20 = new ethers.Interface(["function balanceOf(address) view returns (uint256)", "function transfer(address,uint256) returns (bool)"]);
const GPO = new ethers.Interface(["function getL1FeeUpperBound(uint256) view returns (uint256)"]);
const tfetch = (url, opts = {}, ms = 12000) => fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });

export class OTSBridge {
  /** @param {{ apiBase?: string, otsSite?: string }} [opts] */
  constructor(opts = {}) {
    this.api = new TypedApi({ baseUrl: opts.apiBase ?? process.env.BLOCKCHAINLAB_API ?? API_BASE });
    this.otsSite = (opts.otsSite ?? OTS_SITE).replace(/\/$/, "");
    this._rpcCache = new Map();
  }

  // ---------- RPC: candidates from the rpc-health dataset, verified live ----------
  async healthyRpc(chain = "base") {
    if (!CHAINS[chain]) throw new Error(`Unsupported chain ${chain}`);
    const snap = await this.api.dataset("rpc-health");
    const rows = snap.data.filter((r) => r.chain === chain);
    const candidates = [...new Set([...rows.filter((r) => r.healthy).sort((a, b) => (a.latency_ms ?? 1e9) - (b.latency_ms ?? 1e9)).map((r) => r.url), ...CHAINS[chain].rpcs])];
    const tried = [];
    for (const url of candidates) {
      const t0 = Date.now();
      try {
        const [id, block] = await Promise.all([rawRpc(url, "eth_chainId"), rawRpc(url, "eth_blockNumber")]);
        const ok = Number(id) === CHAINS[chain].id;
        tried.push({ url, ok, latency_ms: Date.now() - t0 });
        if (ok) {
          this._rpcCache.set(chain, url);
          return { chain, chain_id: CHAINS[chain].id, url, block: Number(block), latency_ms: Date.now() - t0, snapshot_generated_at: snap.generated_at, snapshot_healthy: rows.filter((r) => r.healthy).length, snapshot_total: rows.length, tried };
        }
      } catch (e) { tried.push({ url, ok: false, error: String(e.message || e).slice(0, 120) }); }
    }
    throw new Error(`No healthy RPC for ${chain}: ${JSON.stringify(tried)}`);
  }
  /** Candidate URLs: healthy ones from the rpc-health snapshot (fastest first), then blockchainlab-mcp defaults. */
  async rpcCandidates(chain) {
    if (!CHAINS[chain]) throw new Error(`Unsupported chain ${chain}`);
    const snap = await this.api.dataset("rpc-health");
    const rows = snap.data.filter((r) => r.chain === chain && r.healthy).sort((a, b) => (a.latency_ms ?? 1e9) - (b.latency_ms ?? 1e9));
    return [...new Set([...rows.map((r) => r.url), ...CHAINS[chain].rpcs])];
  }
  /** JSON-RPC with failover: preferred URL first, then every other candidate; backs off on 429/5xx. */
  async rpc(chain, method, params = []) {
    const pref = this._rpcCache.get(chain);
    const urls = [...new Set([...(pref ? [pref] : []), ...(await this.rpcCandidates(chain))])];
    let last;
    for (let pass = 0; pass < 2; pass++) {
      for (const url of urls) {
        try { const r = await rawRpc(url, method, params); this._rpcCache.set(chain, url); return r; }
        catch (e) { last = e; if (/execution reverted|invalid argument|insufficient/i.test(String(e.message))) throw e; }
      }
      await new Promise((s) => setTimeout(s, 1500));
    }
    throw last;
  }
  async call(chain, to, data) { return this.rpc(chain, "eth_call", [{ to, data }, "latest"]); }

  // ---------- Chainlink GBP/USD ----------
  async gbpUsd(chain = "ethereum") {
    const feed = GBP_USD_FEEDS[chain]; if (!feed) throw new Error(`No GBP/USD feed for ${chain}`);
    const [d, dec, r] = await Promise.all([
      this.call(chain, feed, AGG.encodeFunctionData("description")),
      this.call(chain, feed, AGG.encodeFunctionData("decimals")),
      this.call(chain, feed, AGG.encodeFunctionData("latestRoundData")),
    ]);
    const description = AGG.decodeFunctionResult("description", d)[0];
    if (description !== "GBP / USD") throw new Error(`Feed ${feed} reports ${description}`);
    const decimals = Number(AGG.decodeFunctionResult("decimals", dec)[0]);
    const round = AGG.decodeFunctionResult("latestRoundData", r);
    const updatedAt = new Date(Number(round.updatedAt) * 1000).toISOString();
    return { pair: "GBP/USD", rate: Number(ethers.formatUnits(round.answer, decimals)), decimals, round_id: round.roundId.toString(), updated_at: updatedAt, age_s: Math.round((Date.now() - Number(round.updatedAt) * 1000) / 1000), chain, feed, source: "Chainlink Data Feeds (on-chain)", explorer: `${CHAINS[chain].explorer}/address/${feed}` };
  }

  // ---------- Stablecoin payout rails (USD / EUR / GBP pegs) ----------
  async payoutRails({ limitPerPeg = 5 } = {}) {
    const [doc, fx] = await Promise.all([this.api.dataset("stablecoins"), this.gbpUsd("ethereum")]);
    const pegs = { peggedUSD: 1, peggedEUR: null, peggedGBP: fx.rate };
    const out = {};
    for (const peg of Object.keys(pegs)) {
      out[peg] = doc.data.filter((s) => s.peg_type === peg && (s.circulating ?? 0) > 0).sort((a, b) => (b.circulating ?? 0) - (a.circulating ?? 0)).slice(0, limitPerPeg).map((s) => ({
        symbol: s.symbol, name: s.name, peg_mechanism: s.peg_mechanism ?? null, price_usd: s.price ?? null, circulating: s.circulating ?? null,
        change_7d_pct: s.change_7d_pct ?? null,
        peg_deviation_pct: pegs[peg] && s.price ? round((s.price / pegs[peg] - 1) * 100, 3) : null,
        on_base: Array.isArray(s.chains) ? s.chains.includes("Base") : null,
        defillama_url: s.defillama_url ?? null,
      }));
    }
    return { generated_at: doc.generated_at, source: doc.source, gbp_usd: fx.rate, gbp_usd_updated_at: fx.updated_at, rails: out, note: "Peg deviation for GBP coins uses the Chainlink GBP/USD rate; EUR coins have no EUR reference here (null). Data snapshot, not advice." };
  }

  // ---------- Live cost of a USDC payout in GBP ----------
  async payoutCost(chain = "base") {
    const token = USDC[chain]; if (!token) throw new Error(`No USDC for ${chain}`);
    const head = Number(await this.rpc(chain, "eth_blockNumber"));
    const span = chain === "ethereum" ? 10 : 30;
    const logs = await this.rpc(chain, "eth_getLogs", [{ address: token, topics: [TRANSFER_TOPIC], fromBlock: ethers.toQuantity(head - span), toBlock: ethers.toQuantity(head) }]);
    const recipient = ethers.Wallet.createRandom().address; // fresh address = worst-case (new balance slot)
    let sender = null, gas = null;
    const seen = new Set();
    for (const l of logs.slice().reverse()) {
      const from = ethers.getAddress("0x" + l.topics[1].slice(26)); if (seen.has(from)) continue; seen.add(from);
      if (seen.size > 40) break;
      try {
        if ((await this.rpc(chain, "eth_getCode", [from, "latest"])) !== "0x") continue;
        const bal = BigInt(await this.call(chain, token, ERC20.encodeFunctionData("balanceOf", [from])));
        if (bal < 1_000_000n) continue;
        gas = BigInt(await this.rpc(chain, "eth_estimateGas", [{ from, to: token, data: ERC20.encodeFunctionData("transfer", [recipient, 1_000_000n]) }]));
        sender = from; break;
      } catch { /* try next sender */ }
    }
    if (!gas) throw new Error(`Could not estimate a USDC transfer on ${chain} from ${seen.size} recent senders`);
    const [fees, px, fx] = await Promise.all([evmFees(chain), prices(["ethereum"]), this.gbpUsd(chain === "base" ? "base" : "ethereum")]);
    const l2 = feeCost(fees, gas, "mid").totalWei;
    let l1 = 0n;
    if (chain === "base") l1 = BigInt(GPO.decodeFunctionResult("getL1FeeUpperBound", await this.call(chain, GAS_PRICE_ORACLE, GPO.encodeFunctionData("getL1FeeUpperBound", [120n])))[0]);
    const totalWei = l2 + l1;
    const eth = Number(ethers.formatEther(totalWei));
    const usd = eth * px.ethereum;
    return {
      chain, token: "USDC", token_address: token, amount: "1 USDC", gas_units: Number(gas), sample_sender: sender, block: head,
      execution_fee_wei: l2.toString(), l1_data_fee_wei_upper_bound: chain === "base" ? l1.toString() : null,
      total_fee_eth: eth, eth_usd: px.ethereum, gbp_usd: fx.rate, total_fee_usd: round(usd, 6), total_fee_gbp: round(usd / fx.rate, 6),
      checked_at: new Date().toISOString(),
      sources: ["eth_estimateGas on a live RPC (real recent USDC sender, fresh recipient)", "eth_feeHistory (median tip)", "DefiLlama coins (ETH/USD)", "Chainlink GBP/USD", ...(chain === "base" ? ["Base GasPriceOracle.getL1FeeUpperBound(120 bytes)"] : [])],
    };
  }

  // ---------- Payout address screening ----------
  /** Accepts 0x address or ENS name. OFAC SDN only — UK OFSI is NOT covered. */
  async screenPayoutAddress(input, { chain = "base" } = {}) {
    let address = input.trim(), ens = null;
    if (/\.eth$/i.test(address)) { ens = address; address = await resolveEns(address); if (!address) return { input, valid: false, reason: "ENS name does not resolve" }; }
    const chk = checkAddress(address);
    if (!chk.valid) return { input, valid: false, reason: "Not a 20-byte 0x address" };
    const doc = await this.api.dataset("sanctioned-addresses");
    const hit = doc.data.find((x) => x.address.toLowerCase() === chk.checksum.toLowerCase()) ?? null;
    const code = await this.rpc(chain, "eth_getCode", [chk.checksum, "latest"]);
    return {
      input, valid: true, address: chk.checksum, ens, checksum_ok: chk.inputChecksumValid,
      ofac_sanctioned: !!hit, ofac_list_asset: hit?.chain ?? null, list_generated_at: doc.generated_at, list_source: doc.source_url, list_count: doc.count,
      has_code: { chain, has_code: code !== "0x", eip7702_delegated: code.startsWith("0xef0100") },
      decision: hit ? "BLOCK" : "PASS_OFAC_ONLY",
      caveat: "OFAC SDN digital-currency addresses only. UK payouts also need OFSI consolidated-list screening of the payee (name-based); this does not do that.",
      links: { address: toolLinks.address(chk.checksum, chain), approvals: toolLinks.approvals(chain, chk.checksum) },
    };
  }

  // ---------- Payout receipt verification ----------
  async verifyPayoutTx(chain, hash, { expectTo } = {}) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("Bad tx hash");
    const tx = await decodeTx(chain, hash);
    const usdc = USDC[chain]?.toLowerCase();
    const transfers = tx.logs.filter((l) => l.event === "Transfer(address,address,uint256)" && l.args?.length === 3).map((l) => ({
      token: l.address, is_usdc: l.address.toLowerCase() === usdc, from: l.args[0], to: l.args[1], raw_amount: String(l.args[2]),
      amount: l.address.toLowerCase() === usdc ? ethers.formatUnits(BigInt(l.args[2]), 6) : null,
    }));
    const matched = expectTo ? transfers.filter((t) => t.is_usdc && t.to.toLowerCase() === expectTo.toLowerCase()) : transfers.filter((t) => t.is_usdc);
    return { chain, hash, status: tx.status ?? "pending", block: tx.block, timestamp: tx.timestamp ?? null, from: tx.from, to: tx.to, fee_wei: tx.feeWei?.toString() ?? null, usdc_transfers: matched, all_transfers: transfers.length, links: { tx: toolLinks.tx(chain, hash), explorer: `${CHAINS[chain].explorer}/tx/${hash}` } };
  }

  // ---------- onetouchswitch.com content (live sitemap) ----------
  async otsPages(query = "", { limit = 20 } = {}) {
    const r = await tfetch(`${this.otsSite}/sitemap.xml`);
    if (!r.ok) throw new Error(`OTS sitemap HTTP ${r.status}`);
    const urls = [...(await r.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    const q = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = urls.filter((u) => q.every((w) => u.toLowerCase().includes(w)));
    const section = (u) => (new URL(u).pathname.split("/").filter(Boolean).slice(0, 2).join("/") || "home");
    return { site: this.otsSite, total_urls: urls.length, matches: hits.length, results: hits.slice(0, limit).map((u) => ({ url: u, section: section(u), slug: new URL(u).pathname.split("/").pop() || "/" })) };
  }

  // ---------- Provenance via blockchainlab-index ----------
  async feedInterfaceProvenance() {
    const r = await tfetch("https://raw.githubusercontent.com/Blockchains/blockchainlab-index/main/search/symbols-l.json", {}, 20000);
    const rows = await r.json();
    const hits = rows.filter(([sym, ref]) => sym === "latestRoundData" && /AggregatorV3Interface/.test(ref)).map(([, ref]) => ref);
    return { symbol: "latestRoundData", interface: "AggregatorV3Interface", components: hits, source: "Blockchains/blockchainlab-index (search/symbols-l.json)", starter: "https://github.com/Blockchains/blockchainlab-starters/tree/main/starters/chainlink-price-feed" };
  }

  /** Everything touch.grok.me needs in one object (what the Pages build publishes as /v1/ots.json). */
  async snapshot() {
    const settle = async (p) => { try { return { ok: true, data: await p }; } catch (e) { return { ok: false, error: String(e.message || e) }; } };
    const [fxEth, fxBase, rails, rpcBase, rpcEth, costBase, costEth] = await Promise.all([
      settle(this.gbpUsd("ethereum")), settle(this.gbpUsd("base")), settle(this.payoutRails()),
      settle(this.healthyRpc("base")), settle(this.healthyRpc("ethereum")), settle(this.payoutCost("base")), settle(this.payoutCost("ethereum")),
    ]);
    return { generated_at: new Date().toISOString(), version: VERSION, gbp_usd: { ethereum: fxEth, base: fxBase }, payout_rails: rails, rpc: { base: rpcBase, ethereum: rpcEth }, payout_cost: { base: costBase, ethereum: costEth } };
  }
}

async function rawRpc(url, method, params = []) {
  const r = await tfetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  const j = await r.json(); if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  return j.result;
}
function round(n, dp) { const f = 10 ** dp; return Math.round(n * f) / f; }
export default OTSBridge;
