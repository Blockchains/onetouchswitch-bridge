# Calling onetouchswitch-bridge from touch.grok.me / onetouchswitch.com

Everything is public and keyless, and served from GitHub Pages with `Access-Control-Allow-Origin: *`. GitHub Actions rebuilds the snapshot every 3 hours. If a build fails, the last good one stays live.

## Env vars (optional)

| Var | Default | Use |
|---|---|---|
| `VITE_OTS_BRIDGE_BASE` | `https://blockchains.github.io/onetouchswitch-bridge` | static JSON API root |
| `BLOCKCHAINLAB_API` | `https://blockchains.github.io/blockchainlab-api` | Node client only: dataset mirror |

No secrets are needed. Never put a private key or RPC key in the site.

## Endpoints

| URL | What |
|---|---|
| `/v1/ots.json` | everything below in one call (each part is `{ok,data}` or `{ok:false,error}`) |
| `/v1/gbp-usd.json` | Chainlink GBP/USD on Ethereum and Base (`rate`, `updated_at`, `feed`, `explorer`) |
| `/v1/payout-cost.json` | live cost of a 1 USDC payout on Base and Ethereum, in GBP |
| `/v1/payout-rails.json` | top USD/EUR/GBP stablecoins: supply, peg deviation, on Base |
| `/v1/rpc.json` | healthy public RPC per chain (from the rpc-health dataset, checked live) |
| `/v1/sanctioned-evm.json` | OFAC SDN 0x addresses, lowercased, for client-side screening |
| `/v1/ots-pages.json` | onetouchswitch.com sitemap grouped by section |
| `/v1/provenance.json` | where the Chainlink interface comes from (blockchainlab-index) |
| `/v1/index.json` | catalogue |

## Example (browser, React)

```js
const BASE = import.meta.env.VITE_OTS_BRIDGE_BASE ?? "https://blockchains.github.io/onetouchswitch-bridge";
export async function loadPayoutData() {
  const r = await fetch(`${BASE}/v1/ots.json`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`bridge ${r.status}`);
  const s = await r.json();
  return {
    generatedAt: s.generated_at,
    fx: s.gbp_usd.ethereum.ok ? s.gbp_usd.ethereum.data : null,          // { rate, updated_at, explorer }
    base: s.payout_cost.base.ok ? s.payout_cost.base.data : null,        // { total_fee_gbp, gas_units, checked_at }
    eth: s.payout_cost.ethereum.ok ? s.payout_cost.ethereum.data : null,
    rails: s.payout_rails.ok ? s.payout_rails.data.rails : null,
  };
}
// Screening (client-side, OFAC only):
export async function isOfacListed(addr) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;
  const l = await (await fetch(`${BASE}/v1/sanctioned-evm.json`)).json();
  return l.addresses.includes(addr.toLowerCase());
}
```

**Rendering rules (no fake data):** if a field is `null` or a fetch fails, hide that widget or show "Live data unavailable". Never fall back to a hard-coded number. Always show `generated_at` / `updated_at` and the source line ("Chainlink GBP/USD · DefiLlama · OFAC SDN via 0xB10C · Blockchain Lab").

## Server / agents

- Node: `npm i github:Blockchains/onetouchswitch-bridge`, then `new OTSBridge().screenPayoutAddress("name.eth")` (ENS + OFAC + code check), `.verifyPayoutTx("base", hash, { expectTo })`, `.payoutCost("base")`.
- MCP (Grok, Cursor, Claude): `{"mcpServers":{"onetouchswitch":{"command":"npx","args":["-y","github:Blockchains/onetouchswitch-bridge"]}}}`. It exposes 8 read-only tools (`ots_*`).

## Compliance notes

- Screening covers the **OFAC SDN** digital-currency addresses only. UK payouts also need **OFSI** consolidated-list (name-based) screening of the payee, which this does not do.
- Keep this on the **B2B pages** (`/for-partners`, `/for-publishers`). Do not put crypto content on consumer broadband pages.
