# AGENTS.md: onetouchswitch-bridge

Read-only bridge between onetouchswitch.com (touch.grok.me) and the Blockchains stack. Manifest: [`blocks.json`](blocks.json).

## Setup / test
```bash
npm ci
npm test                       # tsc on types + live node:test (network required, no mocks)
node scripts/build-site.mjs    # writes ./site (Pages artifact)
node bin/ots-mcp.js            # MCP over stdio
```
A test failure can be an upstream outage (RPC, DefiLlama, Pages), so re-run before changing code.

## Rules
- Never add mocked or hard-coded market data. Every number must come from a live source and carry its timestamp.
- Never add keys, signing or sending. Keep `bin/ots-mcp.js` tools read-only.
- Keep `types/bridge.d.ts` in sync with `src/bridge.js` (`npm run typecheck` compiles `test/types-consumer.ts`).
- When adding an MCP tool, add it to `CALLS` in `test/mcp.test.mjs`. The test asserts the exact tool list.
- Chainlink feed addresses must be verified on-chain (`description()`), which `gbpUsd()` does.
- Run gitleaks before pushing.

## Structure
| Path | What |
|---|---|
| `src/bridge.js` | `OTSBridge` client |
| `types/bridge.d.ts` | public types |
| `bin/ots-mcp.js` | MCP server (8 `ots_*` tools) |
| `scripts/build-site.mjs`, `web/` | static API + demo for Pages |
| `docs/INTEGRATION.md` | how touch.grok.me calls it |
| `docs/FIT.md` | audit: which blocks fit OTS |
