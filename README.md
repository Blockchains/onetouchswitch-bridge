# onetouchswitch-bridge

Live [Blockchain Lab](https://blockchainlab.com) blocks wired for **[onetouchswitch.com](https://onetouchswitch.com)** (built on touch.grok.me). Shipped as a typed JS client, an MCP server and a CORS static JSON API on GitHub Pages.

**Live demo and API:** https://blockchains.github.io/onetouchswitch-bridge/ · catalogue: [`/v1/index.json`](https://blockchains.github.io/onetouchswitch-bridge/v1/index.json)

| Feature | Source (live) | Client | MCP tool | Static API |
|---|---|---|---|---|
| GBP/USD | Chainlink aggregator, Ethereum + Base | `gbpUsd()` | `ots_gbp_usd` | `/v1/gbp-usd.json` |
| Stablecoin payout rails (USD/EUR/GBP) | blockchainlab-api `stablecoins` + Chainlink | `payoutRails()` | `ots_payout_rails` | `/v1/payout-rails.json` |
| 1 USDC payout cost in GBP | `eth_estimateGas` + fee history + Base L1 fee + DefiLlama ETH/USD | `payoutCost()` | `ots_payout_cost` | `/v1/payout-cost.json` |
| Healthy RPC | blockchainlab-api `rpc-health`, checked live | `healthyRpc()` | `ots_healthy_rpc` | `/v1/rpc.json` |
| Payout address screening (OFAC) | blockchainlab-api `sanctioned-addresses`, ENS | `screenPayoutAddress()` | `ots_screen_payout_address` | `/v1/sanctioned-evm.json` |
| Payout receipt check | RPC receipt decode (blockchainlab-mcp), tools + lens links | `verifyPayoutTx()` | `ots_verify_payout_tx` | demo |
| OTS page search | onetouchswitch.com sitemap | `otsPages()` | `ots_site_search` | `/v1/ots-pages.json` |
| Interface provenance | blockchainlab-index | `feedInterfaceProvenance()` | — | `/v1/provenance.json` |

```bash
npm i github:Blockchains/onetouchswitch-bridge
node -e "import('onetouchswitch-bridge').then(async m=>console.log(await new m.OTSBridge().gbpUsd()))"
npx -y github:Blockchains/onetouchswitch-bridge   # MCP server over stdio
```

- How to call it from the site: [docs/INTEGRATION.md](docs/INTEGRATION.md)
- Which blocks fit OTS and why: [docs/FIT.md](docs/FIT.md)
- Tests: `npm test` (typecheck plus live tests, no mocks: Chainlink, RPCs, API, MCP stdio round-trip of all 8 tools)

Read-only: nothing here signs, holds keys or moves funds. Screening covers OFAC only (not UK OFSI). Not financial advice. MIT. Built by Blockchain Lab.
