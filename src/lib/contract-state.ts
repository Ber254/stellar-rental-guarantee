import type { ContractStatus } from "@/lib/db/schema";

const TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: ["PENDING_ACCEPTANCE", "CANCELLED"],
  PENDING_ACCEPTANCE: ["AWAITING_FUNDING", "CANCELLED"],
  AWAITING_FUNDING: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["NEGOTIATION", "AGREED"],
  NEGOTIATION: ["NEGOTIATION", "AGREED"],
  AGREED: ["RELEASED"],
  RELEASED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: ContractStatus, to: ContractStatus) {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ContractStatus, to: ContractStatus) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid contract transition: ${from} -> ${to}`);
  }
}
