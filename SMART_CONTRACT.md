# Escrow contract (`safexy-guarantee`)

Soroban contract that holds the guarantee in USDC and pays it out only against
an agreed settlement. Source: `contracts/safexy-guarantee/src/lib.rs`.

Roles belong to the guarantee, not to the user: the **guarantor** funds it, the
**landlord** is the beneficiary. The same address can be guarantor in one
guarantee and landlord in another.

## States

```
Pending -> Active -> Closed        (Active stays Active while locked > 0)
Pending -> Cancelled
```

`locked` is the balance still held; `funded` is everything ever deposited
(including extension top-ups). A guarantee closes only when `locked` hits 0.

## Configuration

Set at deploy time through the constructor and mutable by the admin:

| Field | Meaning |
| --- | --- |
| `admin` | Address allowed to change the config |
| `treasury` | Destination of the SAFEXY fee |
| `fee_bps` | Fee in basis points, capped at 500 (5%). SAFEXY uses `5` = 0.05% |

The fee applies **only to the amount returned to the guarantor**, never to the
landlord's share, and is rounded up to the stroop.

## Interface

| Function | Auth | Effect |
| --- | --- | --- |
| `create_guarantee(id, guarantor, landlord, token, amount, end_date)` | guarantor | Registers the guarantee, `Pending` |
| `fund_guarantee(id)` | guarantor | Moves `amount` into the contract, `Active` |
| `cancel_guarantee(id, caller)` | a party | Only while `Pending` |
| `propose_settlement(id, proposer, to_guarantor, to_landlord)` | proposer (a party) | Stores/replaces the open proposal |
| `accept_settlement(id, acceptor)` | the other party | Freezes the agreement |
| `reject_settlement(id, caller)` | a party | Drops the open proposal |
| `execute_settlement(id)` | none needed | Pays the frozen agreement |
| `return_to_guarantor(id, amount)` | landlord | Unilateral return, no negotiation needed |
| `propose_extension(id, new_end_date, new_amount)` | guarantor | Prefunds a top-up if the amount grows |
| `accept_extension(id)` | landlord | Applies the new date/amount, refunds the difference if it shrinks |
| `cancel_extension(id, caller)` | a party | Refunds any prefunded top-up |
| `set_treasury` / `set_fee_bps` | admin | Reconfigure the fee |
| `get_guarantee` / `get_settlement` / `get_agreement` / `get_extension` / `get_config` / `quote_fee` | read-only | Current on-chain truth |

`execute_settlement` needs no signature on purpose: both parties already
authorized the exact amounts, so anybody can push the payout without changing it.

## Partial returns

A settlement may add up to **less** than `locked`; the remainder stays locked and
the guarantee remains `Active`, so parties can settle repeatedly:

```
1000 locked -> return 300 -> guarantor gets 299.85, 700 stays locked
 700 locked -> return 200 -> guarantor gets 199.90, 500 stays locked
 500 locked -> return 500 -> guarantee closes
```

## Errors

`AlreadyExists`, `NotFound`, `InvalidAmount`, `InvalidState`, `NotAParty`,
`InvalidSettlement`, `ExceedsLocked`, `NoSettlement`, `CannotAcceptOwnProposal`,
`NoAgreement`, `NotInitialized`, `AlreadyInitialized`, `FeeTooHigh`,
`NoExtension`.

## Invariants

1. Only the guarantor can fund; only the guarantor and the landlord can act.
2. Funds stay locked while `Active` — there is no withdraw path.
3. No unilateral exit for the guarantor: a payout needs a proposal from one party
   and an acceptance from the other (`CannotAcceptOwnProposal`). The landlord may
   always return funds unilaterally, which only benefits the guarantor.
4. `to_guarantor + to_landlord <= locked`, both non-negative, checked on
   proposal, acceptance and execution (`ExceedsLocked`).
5. The sum of all payouts can never exceed what was funded, because every payout
   writes `locked` down first.
6. Double execution is impossible: the agreement is removed and the balance
   written down before any transfer.
7. The fee is charged on the guarantor's share only and sent to `treasury`.

## Tests

`cd contracts && cargo test` (27 tests) covers creation, duplicates, invalid
amounts, self-dealing, funding, double funding, missing signatures, outsiders,
locked funds, over-releases, self-acceptance, counter-offers, rejection, full
and partial returns, successive partial returns, double execution, unilateral
landlord returns, extensions up and down, extension cancellation and
replacement, admin-only fee/treasury changes, stroop rounding and cancellation.
