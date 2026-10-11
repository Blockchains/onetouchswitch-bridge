import { OTSBridge, GBP_USD_FEEDS, type Screen, type PayoutCost } from "onetouchswitch-bridge";
const b = new OTSBridge();
async function demo(): Promise<number> {
  const fx = await b.gbpUsd("ethereum");
  const c: PayoutCost = await b.payoutCost("base");
  const s: Screen = await b.screenPayoutAddress("0x0000000000000000000000000000000000000001");
  if (s.valid && s.decision === "BLOCK") return -1;
  return fx.rate * c.total_fee_usd + GBP_USD_FEEDS.base.length;
}
void demo;
