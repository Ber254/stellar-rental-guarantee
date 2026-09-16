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

export const STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: "Draft",
  PENDING_ACCEPTANCE: "Waiting for landlord",
  AWAITING_FUNDING: "Waiting for deposit",
  ACTIVE: "Protected",
  RETURN_REQUESTED: "Return requested",
  NEGOTIATION: "In negotiation",
  AGREED: "Agreement reached",
  RELEASED: "Funds released",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function canTransition(from: ContractStatus, to: ContractStatus) {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ContractStatus, to: ContractStatus) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid contract transition: ${from} -> ${to}`);
  }
}
