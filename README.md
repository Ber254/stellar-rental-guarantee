# Rental Guarantee on Stellar

A rental deposit is locked in a Soroban escrow and can only leave it when tenant
and landlord agree on how to split it. The platform custodies nothing, decides
nothing and never judges who is right: it records the agreement and executes it
on Stellar.

- Money: USDC on **Stellar testnet** (no custom token, no mainnet in the MVP).
- Escrow: Soroban smart contract in `contracts/safexy-guarantee`.
- App: Next.js (App Router) + TypeScript + Tailwind, PostgreSQL/Neon via Drizzle.

## Lifecycle

```
create contract -> invite landlord -> accept -> fund guarantee (USDC locked)
-> request return -> propose / counter-propose -> accept -> release -> completed
```

Off-chain statuses mirror the on-chain state machine: `DRAFT`,
`PENDING_ACCEPTANCE`, `AWAITING_FUNDING`, `ACTIVE`, `RETURN_REQUESTED`,
`NEGOTIATION`, `AGREED`, `RELEASED`, `COMPLETED`, `CANCELLED`.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full picture and
[SMART_CONTRACT.md](SMART_CONTRACT.md) for the escrow interface and invariants.

```
Next.js app (UI + route handlers)
  |- Drizzle ORM -> PostgreSQL (Neon in production)
  |- Freighter (user signs) / platform key (release only)
  '- Soroban RPC -> safexy-guarantee contract -> USDC SAC
```

## Local development

```bash
nvm use 22
npm install
cp .env.example .env.local     # fill DATABASE_URL and AUTH_SECRET
npm run db:migrate
npm run db:seed                # optional demo users (alice/bob, demo1234)
npm run dev
```

Quality gates:

```bash
npm run lint
npm run typecheck
npm test                       # vitest
cd contracts && cargo test     # Soroban contract tests
```

End-to-end walkthrough against a running server:

```bash
npx tsx scripts/demo-flow.ts
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon in production) |
| `AUTH_SECRET` | Signs the session cookie (32+ random chars) |
| `STELLAR_NETWORK` | `testnet` |
| `STELLAR_RPC_URL` | Soroban RPC endpoint |
| `STELLAR_HORIZON_URL` | Horizon endpoint |
| `STELLAR_NETWORK_PASSPHRASE` | Network passphrase |
| `STELLAR_USDC_CODE` / `STELLAR_USDC_ISSUER` | USDC asset |
| `STELLAR_USDC_CONTRACT_ID` | USDC Stellar Asset Contract address |
| `SOROBAN_CONTRACT_ID` | Deployed escrow contract |
| `PLATFORM_SECRET_KEY` | Account that submits the release transaction |
| `DEMO_SIGNER_SECRETS` | Testnet-only throwaway keys for the scripted demo |
| `NEXT_PUBLIC_DEMO_MODE` | Shows the demo banner in the UI |

Demo mode: when `SOROBAN_CONTRACT_ID`, `STELLAR_USDC_CONTRACT_ID` or
`PLATFORM_SECRET_KEY` are missing, every chain step is recorded as `simulated`
and the UI labels it as such. Simulated activity is never presented as a real
Stellar transaction.

## Neon

1. Create a **new** project in the Neon console (existing projects are untouched).
2. Copy the pooled connection string into `DATABASE_URL`.
3. `npm run db:migrate` applies `drizzle/` to that database.

## Stellar testnet

Deploying the escrow, the USDC asset contract and funding accounts is documented
step by step in [TESTNET.md](TESTNET.md).

## Vercel

1. Import the repository as a **new** Vercel project.
2. Add every variable above as an environment variable (Production + Preview).
3. Deploy. Migrations run from your machine or CI with `npm run db:migrate`
   against the Neon `DATABASE_URL`.

## Security notes

- Private keys are never stored in the database, the repo or the browser bundle.
  Users sign with Freighter; only the platform release key lives in server env.
- No unilateral withdrawal: the contract only pays out an accepted distribution.
- Distributions must add up exactly to the locked amount (7-decimal integer math).
- Double release is blocked on-chain (state flips to `Released` before transfers)
  and off-chain (status transitions are validated).
- Personal data (names, emails, addresses) stays in Postgres, never on chain.
