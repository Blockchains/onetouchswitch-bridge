import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const bin = fileURLToPath(new URL("../bin/ots-mcp.js", import.meta.url));
const CALLS = {
  ots_gbp_usd: { chain: "base" },
  ots_payout_rails: { limit_per_peg: 3 },
  ots_payout_cost: { chain: "base" },
  ots_healthy_rpc: { chain: "base" },
  ots_screen_payout_address: { address: "0x0330070FD38Ec3bB94F58FA55D40368271E9e54A" },
  ots_verify_payout_tx: null, // filled from a live log below
  ots_site_search: { query: "blog", limit: 5 },
  ots_snapshot: {},
};

test("stdio MCP server lists and runs every tool against live sources", async () => {
  const client = new Client({ name: "ots-test", version: "0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [bin] }));
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), Object.keys(CALLS).sort());
    const rpc = JSON.parse((await client.callTool({ name: "ots_healthy_rpc", arguments: { chain: "base" } })).content[0].text);
    const head = rpc.block;
    const res = await fetch(rpc.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getLogs", params: [{ address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"], fromBlock: "0x" + (head - 20).toString(16), toBlock: "0x" + (head - 5).toString(16) }] }) });
    const logs = (await res.json()).result;
    CALLS.ots_verify_payout_tx = { chain: "base", hash: logs[0].transactionHash };
    for (const [name, args] of Object.entries(CALLS)) {
      const r = await client.callTool({ name, arguments: args });
      assert.ok(!r.isError, `${name}: ${r.content?.[0]?.text}`);
      const body = JSON.parse(r.content[0].text);
      assert.ok(body && typeof body === "object", name);
      if (name === "ots_screen_payout_address") assert.equal(body.decision, "BLOCK");
    }
  } finally { await client.close(); }
});
