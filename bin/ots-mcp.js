#!/usr/bin/env node
// ots-mcp: MCP server (stdio) exposing onetouchswitch.com tools backed by Blockchain Lab blocks. Read-only; never signs or sends.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { OTSBridge, VERSION } from "../src/bridge.js";

export function createServer() {
  const b = new OTSBridge();
  const s = new McpServer({ name: "onetouchswitch", version: VERSION });
  const ro = { readOnlyHint: true, openWorldHint: true };
  const guard = (fn) => async (args) => { try { return { content: [{ type: "text", text: JSON.stringify(await fn(args ?? {}), null, 2) }] }; } catch (e) { return { isError: true, content: [{ type: "text", text: String(e.message || e) }] }; } };
  const payoutChain = z.enum(["ethereum", "base"]);
  s.registerTool("ots_gbp_usd", { title: "GBP/USD (Chainlink)", description: "Live GBP/USD rate read on-chain from the Chainlink aggregator (Ethereum or Base), with round id and update time.", inputSchema: { chain: payoutChain.optional() }, annotations: ro }, guard(({ chain }) => b.gbpUsd(chain)));
  s.registerTool("ots_payout_rails", { title: "Stablecoin payout rails", description: "Top USD-, EUR- and GBP-pegged stablecoins by supply with price, peg deviation (GBP vs Chainlink) and Base availability, for partner/publisher payouts.", inputSchema: { limit_per_peg: z.number().int().min(1).max(20).optional() }, annotations: ro }, guard(({ limit_per_peg }) => b.payoutRails({ limitPerPeg: limit_per_peg })));
  s.registerTool("ots_payout_cost", { title: "USDC payout cost in GBP", description: "Live network cost to send 1 USDC on Base or Ethereum, in ETH, USD and GBP (eth_estimateGas from a real recent sender, fee history, Base L1 fee bound).", inputSchema: { chain: payoutChain.optional() }, annotations: ro }, guard(({ chain }) => b.payoutCost(chain)));
  s.registerTool("ots_healthy_rpc", { title: "Healthy RPC", description: "Pick a healthy public RPC for a chain: candidates from the Blockchain Lab rpc-health dataset, verified live (chain id + block).", inputSchema: { chain: z.enum(["ethereum", "base", "arbitrum", "optimism", "polygon", "bsc", "avalanche"]).optional() }, annotations: ro }, guard(({ chain }) => b.healthyRpc(chain)));
  s.registerTool("ots_screen_payout_address", { title: "Screen payout address", description: "Validate a 0x address or ENS name for a partner payout and check it against the OFAC SDN digital-currency list. Does NOT cover UK OFSI name screening.", inputSchema: { address: z.string().min(3), chain: z.enum(["ethereum", "base"]).optional() }, annotations: ro }, guard(({ address, chain }) => b.screenPayoutAddress(address, { chain })));
  s.registerTool("ots_verify_payout_tx", { title: "Verify payout transaction", description: "Decode a payout transaction and list its USDC transfers (optionally only those to an expected recipient), with tool and explorer links.", inputSchema: { chain: payoutChain, hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/), expect_to: z.string().optional() }, annotations: ro }, guard(({ chain, hash, expect_to }) => b.verifyPayoutTx(chain, hash, { expectTo: expect_to })));
  s.registerTool("ots_site_search", { title: "Search onetouchswitch.com pages", description: "Search the live onetouchswitch.com sitemap by words in the URL (e.g. 'guides', 'blog fibre', 'tools').", inputSchema: { query: z.string().optional(), limit: z.number().int().min(1).max(100).optional() }, annotations: ro }, guard(({ query = "", limit }) => b.otsPages(query, { limit })));
  s.registerTool("ots_snapshot", { title: "OTS on-chain snapshot", description: "Everything at once: GBP/USD on both chains, payout rails, healthy RPCs and USDC payout costs.", inputSchema: {}, annotations: ro }, guard(() => b.snapshot()));
  return s;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("ots-mcp")) {
  await createServer().connect(new StdioServerTransport());
}
