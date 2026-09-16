# Escrow contract (`rental-guarantee`)

Soroban contract that holds the deposit in USDC and releases it only to an
accepted distribution. Source: `contracts/rental-guarantee/src/lib.rs`.

## States

```
Created -> Funded -> ReturnRequested -> Negotiation -> Agreed -> Released
Created -> Cancelled
```

## Interface

| Function | Auth | Effect |
| --- | --- | --- |
| `create_guarantee(id, tenant, landlord, token, amount, end_date)` | tenant | Registers the guarantee. Nothing moves yet |
| `fund_guarantee(id)` | tenant | Transfers `amount` from the tenant into the contract, state `Funded` |
| `request_release(id, caller)` | tenant or landlord | Opens the settlement, state `ReturnRequested` |
| `propose_distribution(id, proposer, to_landlord, to_tenant)` | proposer (a party) | Stores/replaces the open proposal, state `Negotiation` |
| `accept_proposal(id, acceptor)` | the other party | Freezes the agreement, state `Agreed` |
| `release_funds(id)` | none needed | Pays the agreed split, state `Released` |
| `cancel_guarantee(id, caller)` | a party | Only while `Created` (nothing funded) |
| `get_guarantee` / `get_proposal` / `get_agreement` | read-only | Current on-chain truth |

`release_funds` needs no signature on purpose: both parties already authorized
the exact split (proposal + acceptance), so anybody — in practice the platform
account — can push the payout without being able to change it.

## Errors

`AlreadyExists`, `NotFound`, `InvalidAmount`, `InvalidState`, `NotAParty`,
`InvalidDistribution`, `NoProposal`, `CannotAcceptOwnProposal`, `NoAgreement`,
`AlreadyReleased`.

## Invariants

1. Only the tenant can fund.
2. Funds stay locked while the guarantee is `Funded` — there is no withdraw path.
3. No unilateral exit: a payout requires a proposal from one party and an
   acceptance from the other (`CannotAcceptOwnProposal`).
4. `to_landlord + to_tenant == amount`, both non-negative, checked on proposal,
   acceptance and release.
5. Double release is impossible: state is set to `Released` before the transfers
   and `release_funds` rejects anything that is not `Agreed`.
6. Outsiders cannot act: `require_party` guards every party-only call.
7. Only the agreed distribution is ever paid — the contract never computes its
   own split and never arbitrates.

## Tests

`cd contracts && cargo test` (16 tests) covers creation, duplicates, invalid
amounts, funding, double funding, missing signatures, outsiders, locked funds,
invalid distributions, self-acceptance, counter-offers, the full 150/850
lifecycle, full return, double release, invalid transitions and cancellation.
