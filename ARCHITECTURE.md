# Architecture

## Components

| Layer | Implementation |
| --- | --- |
| UI | Next.js App Router, server components + a few client components |
| API | Route handlers under `src/app/api` |
| Domain | `src/lib/services` (contracts, chain steps), `src/lib/contract-state.ts` |
| Persistence | Drizzle ORM over PostgreSQL (Neon in production) |
| Chain | `src/lib/stellar` (network, contract bindings, demo signer) |
| Escrow | Soroban contract in `contracts/safexy-guarantee` |

## Request flow for a chain action

1. The browser posts `{ step }` to `/api/contracts/[id]/chain`.
2. `startStep` loads the contract, resolves the caller's role, validates the
   transition, and builds the Soroban call **only** if the chain is configured.
3. If the user must sign, the server returns `{ mode: "sign", xdr }`; the client
   signs with Freighter and posts back `{ signedXdr }` to `completeStep`.
4. The server submits, waits for the transaction, then writes the domain change
   (guarantee, proposals, agreement, notifications) plus a row in
   `blockchain_transactions` with the hash, ledger and `simulated` flag.
5. `release` is the only step signed by the platform key, because both parties
   already authorized the distribution on chain.

When the chain is not configured the same domain change is applied with
`simulated = true` and no hash, so demo runs are always distinguishable.

## Data model

`users`, `properties`, `rental_contracts`, `guarantees`, `proposals`,
`proposal_actions`, `agreements`, `blockchain_transactions`, `notifications`
and `contract_counters` (for the `RG-2026-000001` reference sequence).

All primary keys are UUIDs. Amounts are stored as `numeric(20,7)` and converted
to `bigint` stroops before touching Stellar (`src/lib/money.ts`), so no split is
ever off by a rounding error.

## State machine

`src/lib/contract-state.ts` owns the allowed transitions and is the single place
that decides whether an action is legal off chain; the Soroban contract enforces
the same order on chain. A contract cannot skip funding, release twice or reopen
after `COMPLETED`/`CANCELLED`.

## Authentication

Email + password (bcrypt) with a JWT (HS256, `jose`) in an HTTP-only cookie
`rg_session` valid for 7 days. Every route handler calls `requireUser()` and
every contract query is scoped to the caller being tenant or landlord.

## Keys

- Tenant/landlord keys never reach the server: they sign in Freighter.
- `PLATFORM_SECRET_KEY` only submits `release_funds`, whose outcome is already
  fixed by the accepted on-chain agreement.
- `DEMO_SIGNER_SECRETS` is an explicit opt-in for throwaway testnet accounts
  used by `scripts/demo-flow.ts`; it is empty by default.
