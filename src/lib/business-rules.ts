import { toStroops, fromStroops } from "@/lib/money";

/**
 * Every configurable SAFEXY rule lives here — never duplicated in a component
 * or a service. See MD/BUSINESS_RULES.md for the product rationale.
 */

/** 0.05%, i.e. 5 basis points out of 10 000. Matches `fee_bps` on-chain. */
export const FEE_BPS = 5;
const BPS_DENOMINATOR = 10_000n;

/** Fee (in stroops) charged on a return, rounded up to the stroop. */
export function feeForStroops(amountStroops: bigint): bigint {
  if (amountStroops <= 0n) return 0n;
  const bps = BigInt(FEE_BPS);
  return (amountStroops * bps + BPS_DENOMINATOR - 1n) / BPS_DENOMINATOR;
}

export type FeeQuote = {
  amount: string;
  fee: string;
  net: string;
};

/** Same computation as `feeForStroops`, in decimal USDC strings for the UI. */
export function quoteFeeDecimal(amount: string): FeeQuote {
  const amountStroops = toStroops(amount);
  const fee = feeForStroops(amountStroops);
  const net = amountStroops - fee;
  return {
    amount,
    fee: fromStroops(fee),
    net: fromStroops(net),
  };
}

/** A guarantee pending acceptance for longer than this expires automatically. */
export const ACCEPTANCE_EXPIRY_DAYS = 30;

export function acceptanceDeadline(periodStart: Date): Date {
  const deadline = new Date(periodStart);
  deadline.setDate(deadline.getDate() + ACCEPTANCE_EXPIRY_DAYS);
  return deadline;
}

export function isPastAcceptanceDeadline(periodStart: Date, now = new Date()): boolean {
  return now.getTime() > acceptanceDeadline(periodStart).getTime();
}
