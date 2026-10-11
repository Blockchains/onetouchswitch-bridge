# onetouchswitch-bridge

Provider and partner **settlement backend** for **[onetouchswitch.com](https://onetouchswitch.com)**, built from live [Blockchain Lab](https://blockchainlab.com) blocks. It ships as a typed JS client, an MCP server and a static JSON API on GitHub Pages.

**Scope: this is One Touch Switch's back-office settlement backend for broadband PROVIDERS and commercial partners. It is not for customers.** It covers GBP/USD FX, stablecoin settlement rails, settlement network cost, OFAC screening of provider/partner payout addresses, and settlement receipt checks. The consumer comparison app ([Blockchains/onetouchswitch](https://github.com/Blockchains/onetouchswitch)) never loads, fetches or mentions it. The only link is an optional operator link in the app footer. Customers never pay or get paid in crypto, and nothing here appears in the consumer journey.

**Operator demo and API:** https://blockchains.github.io/onetouchswitch-bridge/ · catalogue: [`/v1/index.json`](https://blockchains.github.io/onetouchswitch-bridge/v1/index.json)

| Feature | Source (live) | Client | MCP tool | Static API |
|---|---|---|---|---|
| GBP/USD | Chainlink aggregator, Ethereum + Base | `gbpUsd()` | `ots_gbp_usd` | `/v1/gbp-usd.json` |
| Stablecoin settlement rails for providers/partners (USD/EUR/GBP) | blockchainlab-api `stablecoins` + Chainlink | `payoutRails()` | `ots_payout_rails` | `/v1/payout-rails.json` |
| Network cost of a 1 USDC provider settlement, in GBP | `eth_estimateGas` + fee history + Base L1 fee + DefiLlama ETH/USD | `payoutCost()` | `ots_payout_cost` | `/v1/payout-cost.json` |
| Healthy RPC | blockchainlab-api `rpc-health`, checked live | `healthyRpc()` | `ots_healthy_rpc` | `/v1/rpc.json` |
| Provider/partner payout address screening (OFAC) | blockchainlab-api `sanctioned-addresses`, ENS | `screenPayoutAddress()` | `ots_screen_payout_address` | `/v1/sanctioned-evm.json` |
| Settlement receipt check | RPC receipt decode (blockchainlab-mcp), tools + lens links | `verifyPayoutTx()` | `ots_verify_payout_tx` | demo |
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

Read-only: nothing here signs, holds keys or moves funds. Partners are onboarded only with Ismail's approval. The consumer app's `config/handoff.json` stays empty until he approves a partner. Partner terms and settlement contracts are business decisions and are not in this repo. Screening covers OFAC only (not UK OFSI). Not financial advice. MIT. Built by Blockchain Lab.
