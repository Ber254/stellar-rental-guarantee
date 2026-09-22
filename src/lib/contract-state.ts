import type { ContractStatus } from "@/lib/db/schema";
import { badRequest } from "@/lib/services/errors";

// Partial returns keep the guarantee ACTIVE (the remainder stays locked on
// chain); a settlement only leaves ACTIVE for good once nothing is left
// locked (COMPLETED). RELEASED is kept in the enum for the old all-or-nothing
// flow but is unreachable from here.
const TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: ["PENDING_ACCEPTANCE", "CANCELLED"],
  PENDING_ACCEPTANCE: ["AWAITING_FUNDING", "REJECTED", "EXPIRED", "CANCELLED"],
  AWAITING_FUNDING: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["RETURN_REQUESTED", "EXPIRED", "COMPLETED"],
  RETURN_REQUESTED: ["NEGOTIATION", "AGREED", "ACTIVE", "EXPIRED"],
  NEGOTIATION: ["NEGOTIATION", "AGREED", "ACTIVE", "EXPIRED"],
  AGREED: ["ACTIVE", "COMPLETED"],
  RELEASED: ["COMPLETED"],
  EXPIRED: ["RETURN_REQUESTED", "NEGOTIATION", "ACTIVE", "COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function canTransition(from: ContractStatus, to: ContractStatus) {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ContractStatus, to: ContractStatus) {
  if (!canTransition(from, to)) {
    throw badRequest(
      `Invalid contract transition: ${from} -> ${to}`,
      "invalidTransition",
    );
  }
}
