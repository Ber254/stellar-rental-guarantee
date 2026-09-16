import { Account, Contract, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

const ESCROW = "CB3JG5IKMHKUXRPYSZ6UVOEJ42XXGQQOIBK4UBYEPYSTGBZ6IIAN5LAH";
const OTHER_CONTRACT = "CDSA3RLXVDMZGV6ZWDZY3HKFDJT2ZSEUCHPMG3OQXQUNU5W64XMHCIIO";
const SOURCE = "GCKMGALLPD64ZMCQBQIO36AZGKMN3MC4A7KK6Q6SEDYGWLZNJGTYR4PX";
const PASSPHRASE = "Test SDF Network ; September 2015";

process.env.SOROBAN_CONTRACT_ID = ESCROW;
process.env.STELLAR_USDC_CONTRACT_ID = OTHER_CONTRACT;
process.env.STELLAR_NETWORK_PASSPHRASE = PASSPHRASE;

const { assertMatchesCall, calls, onChainIdFromReference } = await import(
  "./guarantee-contract"
);

type Call = ReturnType<typeof calls.releaseFunds>;

function envelope(contractId: string, call: Call) {
  const contract = new Contract(contractId);
  return new TransactionBuilder(new Account(SOURCE, "0"), {
    fee: "1000000",
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(contract.call(call.method, ...call.args))
    .setTimeout(120)
    .build()
    .toXDR();
}

describe("assertMatchesCall", () => {
  const call = calls.acceptProposal(2026000001n, SOURCE);

  it("accepts the planned invocation", () => {
    expect(() => assertMatchesCall(envelope(ESCROW, call), call)).not.toThrow();
  });

  it("rejects a call to another contract", () => {
    expect(() =>
      assertMatchesCall(envelope(OTHER_CONTRACT, call), call),
    ).toThrow(/another contract/);
  });

  it("rejects another function of the escrow", () => {
    const release = calls.releaseFunds(2026000001n);
    expect(() =>
      assertMatchesCall(envelope(ESCROW, release), call),
    ).toThrow(/another function/);
  });

  it("rejects the right function with different arguments", () => {
    const tampered = calls.acceptProposal(2026000002n, SOURCE);
    expect(() =>
      assertMatchesCall(envelope(ESCROW, tampered), call),
    ).toThrow(/unexpected arguments/);
  });
});

describe("onChainIdFromReference", () => {
  it("maps the reference to a stable numeric id", () => {
    expect(onChainIdFromReference("RG-2026-000001")).toBe(2026000001n);
  });

  it("rejects anything else", () => {
    expect(() => onChainIdFromReference("RG-26-1")).toThrow();
  });
});
