import { Account, Contract, Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

const ESCROW = "CCAT2N5JSRUO2UJDB7RFSUG2FWUO2X77VJBSVLVTZI2VDZOSOYSH76LV";
const OTHER_CONTRACT = "CDSA3RLXVDMZGV6ZWDZY3HKFDJT2ZSEUCHPMG3OQXQUNU5W64XMHCIIO";
const SOURCE_KP = Keypair.random();
const SOURCE = SOURCE_KP.publicKey();
const PASSPHRASE = "Test SDF Network ; September 2015";

process.env.SOROBAN_CONTRACT_ID = ESCROW;
process.env.STELLAR_USDC_CONTRACT_ID = OTHER_CONTRACT;
process.env.STELLAR_NETWORK_PASSPHRASE = PASSPHRASE;

const { assertMatchesCall, buildFeeBumpXdr, calls, onChainIdFromReference } =
  await import("./guarantee-contract");

type Call = ReturnType<typeof calls.acceptSettlement>;

function envelope(contractId: string, call: Call, sign = false) {
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(new Account(SOURCE, "0"), {
    fee: "1000000",
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(contract.call(call.method, ...call.args))
    .setTimeout(120)
    .build();
  if (sign) tx.sign(SOURCE_KP);
  return tx.toXDR();
}

describe("assertMatchesCall", () => {
  const call = calls.acceptSettlement(2026000001n, SOURCE);

  it("accepts the planned invocation", () => {
    expect(() => assertMatchesCall(envelope(ESCROW, call), call)).not.toThrow();
  });

  it("rejects a call to another contract", () => {
    expect(() =>
      assertMatchesCall(envelope(OTHER_CONTRACT, call), call),
    ).toThrow(/another contract/);
  });

  it("rejects another function of the escrow", () => {
    const execute = calls.executeSettlement(2026000001n);
    expect(() =>
      assertMatchesCall(envelope(ESCROW, execute), call),
    ).toThrow(/another function/);
  });

  it("rejects the right function with different arguments", () => {
    const tampered = calls.acceptSettlement(2026000002n, SOURCE);
    expect(() =>
      assertMatchesCall(envelope(ESCROW, tampered), call),
    ).toThrow(/unexpected arguments/);
  });

  it("rejects a mismatched source account or unsigned tx when expectedSource is provided", () => {
    const otherSource = "GDGZ7E2PJZ33M2X7EDDZ65KJCJWQP5QCZWDEBHSBRNHNQRYCGMHXJGBH";
    expect(() =>
      assertMatchesCall(envelope(ESCROW, call, true), call, otherSource),
    ).toThrow(/unexpected source account/);
    expect(() =>
      assertMatchesCall(envelope(ESCROW, call, false), call, SOURCE),
    ).toThrow(/not been signed/);
    expect(() =>
      assertMatchesCall(envelope(ESCROW, call, true), call, SOURCE),
    ).not.toThrow();
  });

  it("wraps a user-signed XDR into a platform-sponsored FeeBumpTransaction", () => {
    const sponsor = Keypair.random();
    const innerSigned = envelope(ESCROW, call, true);
    const feeBumpXdr = buildFeeBumpXdr(innerSigned, sponsor.secret());
    const parsed = TransactionBuilder.fromXDR(feeBumpXdr, PASSPHRASE);
    expect("innerTransaction" in parsed).toBe(true);
  });
});

describe("onChainIdFromReference", () => {
  it("maps the reference to a stable numeric id", () => {
    expect(onChainIdFromReference("SFX-2026-000001")).toBe(2026000001n);
  });

  it("rejects anything else", () => {
    expect(() => onChainIdFromReference("SFX-26-1")).toThrow();
  });
});
