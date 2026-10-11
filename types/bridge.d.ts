// Type declarations for onetouchswitch-bridge (src/bridge.js). Checked by `npm run typecheck` (test/types-consumer.ts).
export declare const VERSION: string;
export declare const API_BASE: "https://blockchains.github.io/blockchainlab-api";
export declare const OTS_SITE: "https://onetouchswitch.com";
export declare const LENS_DETECT: string;
export declare const GBP_USD_FEEDS: { ethereum: string; base: string };
export declare const USDC: { ethereum: string; base: string };

export type Chain = "ethereum" | "base" | "arbitrum" | "optimism" | "polygon" | "bsc" | "avalanche";
export type PayoutChain = "ethereum" | "base";
export type Settled<T> = { ok: true; data: T } | { ok: false; error: string };

export interface GbpUsd { pair: "GBP/USD"; rate: number; decimals: number; round_id: string; updated_at: string; age_s: number; chain: PayoutChain; feed: string; source: string; explorer: string }
export interface HealthyRpc { chain: Chain; chain_id: number; url: string; block: number; latency_ms: number; snapshot_generated_at: string; snapshot_healthy: number; snapshot_total: number; tried: { url: string; ok: boolean; latency_ms?: number; error?: string }[] }
export interface Rail { symbol: string; name: string; peg_mechanism: string | null; price_usd: number | null; circulating: number | null; change_7d_pct: number | null; peg_deviation_pct: number | null; on_base: boolean | null; defillama_url: string | null }
export interface PayoutRails { generated_at: string; source: string; gbp_usd: number; gbp_usd_updated_at: string; rails: { peggedUSD: Rail[]; peggedEUR: Rail[]; peggedGBP: Rail[] }; note: string }
export interface PayoutCost { chain: PayoutChain; token: "USDC"; token_address: string; amount: string; gas_units: number; sample_sender: string; block: number; execution_fee_wei: string; l1_data_fee_wei_upper_bound: string | null; total_fee_eth: number; eth_usd: number; gbp_usd: number; total_fee_usd: number; total_fee_gbp: number; checked_at: string; sources: string[] }
export type Screen =
  | { input: string; valid: false; reason: string }
  | { input: string; valid: true; address: string; ens: string | null; checksum_ok: boolean | null; ofac_sanctioned: boolean; ofac_list_asset: string | null; list_generated_at: string; list_source: string; list_count: number; has_code: { chain: Chain; has_code: boolean; eip7702_delegated: boolean }; decision: "BLOCK" | "PASS_OFAC_ONLY"; caveat: string; links: { address: string; approvals: string } };
export interface UsdcTransfer { token: string; is_usdc: boolean; from: string; to: string; raw_amount: string; amount: string | null }
export interface PayoutReceipt { chain: Chain; hash: string; status: "success" | "reverted" | "pending"; block: number | null; timestamp: string | null; from: string; to: string | null; fee_wei: string | null; usdc_transfers: UsdcTransfer[]; all_transfers: number; links: { tx: string; explorer: string } }
export interface OtsPages { site: string; total_urls: number; matches: number; results: { url: string; section: string; slug: string }[] }
export interface Provenance { symbol: string; interface: string; components: string[]; source: string; starter: string }
export interface Snapshot { generated_at: string; version: string; gbp_usd: Record<PayoutChain, Settled<GbpUsd>>; payout_rails: Settled<PayoutRails>; rpc: Record<PayoutChain, Settled<HealthyRpc>>; payout_cost: Record<PayoutChain, Settled<PayoutCost>> }

export declare class OTSBridge {
  constructor(opts?: { apiBase?: string; otsSite?: string });
  healthyRpc(chain?: Chain): Promise<HealthyRpc>;
  rpc(chain: Chain, method: string, params?: unknown[]): Promise<any>;
  call(chain: Chain, to: string, data: string): Promise<string>;
  gbpUsd(chain?: PayoutChain): Promise<GbpUsd>;
  payoutRails(opts?: { limitPerPeg?: number }): Promise<PayoutRails>;
  payoutCost(chain?: PayoutChain): Promise<PayoutCost>;
  screenPayoutAddress(input: string, opts?: { chain?: Chain }): Promise<Screen>;
  verifyPayoutTx(chain: Chain, hash: string, opts?: { expectTo?: string }): Promise<PayoutReceipt>;
  otsPages(query?: string, opts?: { limit?: number }): Promise<OtsPages>;
  feedInterfaceProvenance(): Promise<Provenance>;
  snapshot(): Promise<Snapshot>;
}
export default OTSBridge;
