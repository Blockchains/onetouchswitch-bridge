# Fit audit: onetouchswitch.com × Blockchains (2026-10-11)

**What onetouchswitch.com is today** (live crawl, 234 sitemap URLs): an independent UK broadband comparison and switching-guidance site built by Grok Build (touch.grok.me). It has address-based compare/availability pages, provider and city pages, guides, a blog, consumer tools (`/uk/tools/*`), and B2B pages (`/for-partners`, `/for-providers`, `/for-publishers`, `/contact-sales`). It has no `/api`, no `llms.txt`, and no on-chain features.

**Core rule:** consumer broadband pages stay crypto-free. UK cryptoasset financial-promotion rules make crypto content on a consumer comparison site a liability, and it does nothing for broadband users. On-chain blocks only fit **settlement with broadband providers and commercial partners** (OTS's own backend, never customers) and the **agent/MCP** surface. Update 2026-10-11 (Ismail): stablecoin payout is OTS's backend for integrating with PROVIDERS, not customers.

| Block | Fit for OTS | Status in this repo |
|---|---|---|
| blockchainlab-api | Stablecoin rails, RPC health, OFAC addresses | **Wired** (via sdk), live in `/v1/*.json` |
| blockchainlab-sdk | Typed dataset access | **Wired**: `OTSBridge.api` |
| blockchainlab-mcp | Fees, prices, ENS, tx decode, tool links | **Wired**: payout cost, screening, receipts |
| Chainlink price feeds (via starters/index) | GBP/USD for GBP-denominated payouts | **Wired**: on-chain read on Ethereum and Base |
| blockchainlab-tools | Inspect address, tx, approvals | **Wired**: deep links in every result |
| blockchainlab-lens | Paste an explorer URL, get the tool link | **Wired** in the demo receipt checker |
| blockchainlab-index | Provenance of the contract interfaces we call | **Wired**: `feedInterfaceProvenance()`, tested |
| blockchainlab-starters | Chainlink-feed and ERC-4337 contract starters | Referenced. No contract deployed (none is needed yet) |
| blockchainlab-compose / forge-* (membership NFT) | Partner membership NFT | **Not shipped**: no business need found, and deploying one needs a funded key and a decision from Ismail |
| blockchainlab-feeds | X intel / hackathons | Not relevant to broadband users or partners |
| blockchainlab-labs | Solidity training labs | Not relevant |
| sites-monitor | Uptime/TLS/SEO for onetouchswitch.com | Already in place (separate repo) |

**Broadband data:** no Blockchains repo holds UK broadband or Ofcom data, so the compare UX does not get on-chain features. The only OTS-content block here is `ots_site_search` (the live sitemap), which lets AI agents find OTS guides.
