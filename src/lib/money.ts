export const DECIMALS = 7;
const SCALE = 10n ** BigInt(DECIMALS);

/** Converts a decimal amount string (e.g. "1000.5") to Stellar stroops. */
export function toStroops(amount: string | number): bigint {
  const text = typeof amount === "number" ? amount.toString() : amount.trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  if (fraction.length > DECIMALS) {
    throw new Error(`Amount has more than ${DECIMALS} decimals: ${amount}`);
  }
  const padded = fraction.padEnd(DECIMALS, "0");
  const value = BigInt(whole) * SCALE + BigInt(padded || "0");
  return negative ? -value : value;
}

export function fromStroops(value: bigint | string): string {
  const raw = typeof value === "string" ? BigInt(value) : value;
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const whole = abs / SCALE;
  const fraction = (abs % SCALE).toString().padStart(DECIMALS, "0");
  const trimmed = fraction.replace(/0+$/, "");
  const text = trimmed ? `${whole}.${trimmed}` : whole.toString();
  return negative ? `-${text}` : text;
}

export function formatUsdc(amount: string | number): string {
  const value = Number(amount);
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 7,
  })} USDC`;
}

/**
 * A settlement may pay out less than what is locked — the remainder stays
 * locked and the guarantee stays active — but never more.
 */
export function amountsWithinLocked(
  toGuarantor: string,
  toLandlord: string,
  locked: string,
): boolean {
  const total = toStroops(toGuarantor) + toStroops(toLandlord);
  return total >= 0n && total <= toStroops(locked);
}
