# Safexy — Rental Guarantee on Stellar

A rental guarantee is money a **guarantor** locks in a Soroban escrow in favor
of a **landlord** — roles belong to the guarantee, not to the account, so the
same user can be guarantor in one guarantee and landlord in another. The
platform custodies nothing, decides nothing and never judges who is right: it
records what both parties agree to and executes it on Stellar. The escrow
supports repeated **partial** returns (the remainder stays locked), a
**0.05% fee** on what is returned, and **extensions** that grow or shrink the
locked amount.

- Money: USDC on **Stellar testnet** (no custom token, no mainnet in the MVP).
- Escrow: Soroban smart contract in `contracts/safexy-guarantee`.
- App: Next.js (App Router) + TypeScript + Tailwind, PostgreSQL/Neon via Drizzle.
- Product model and full context: see [`/MD`](MD/README.md).

## Lifecycle

```
guarantor sends a guarantee by alias -> landlord accepts or rejects (reason)
-> guarantor funds (USDC locked) -> guarantor requests a return (full or
partial) / landlord returns unilaterally -> landlord approves, rejects
(reason) or counters -> execute -> repeat while locked > 0 -> completed
```

A guarantee pending acceptance for more than a month after its period starts
is cancelled automatically. When the period ends it becomes `EXPIRED`, and the
guarantor can return the balance or propose an extension.

Off-chain statuses mirror the on-chain state machine: `DRAFT`,
`PENDING_ACCEPTANCE`, `AWAITING_FUNDING`, `ACTIVE`, `RETURN_REQUESTED`,
`NEGOTIATION`, `AGREED`, `COMPLETED`, `CANCELLED`, `REJECTED`, `EXPIRED`.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full picture and
[SMART_CONTRACT.md](SMART_CONTRACT.md) for the escrow interface and invariants.

```
Next.js app (UI + route handlers)
  |- Drizzle ORM -> PostgreSQL (Neon in production)
  |- Freighter (user signs) / platform key (release only)
  '- Soroban RPC -> safexy-guarantee contract -> USDC SAC
```

## Language and themes

The interface ships in LATAM Spanish (default) and English. Dictionaries live in
`src/lib/i18n/dictionaries.ts`; the choice is stored in the `rg_locale` cookie and
read on the server, so pages render already translated.

Two experiences replace the usual light/dark switch: `modern` (dark, default) and
`retro` (light, monospace). The choice is stored in the `rg_theme` cookie and applied
as `data-theme` on `<html>`; both palettes are defined as CSS variables in
`src/app/globals.css` and exposed to Tailwind as semantic colors (`bg-surface`,
`text-muted`, `border-line`, …).

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
| `CRON_SECRET` | Authenticates the daily `/api/cron/expire` job (see below) |

Demo mode: when `SOROBAN_CONTRACT_ID`, `STELLAR_USDC_CONTRACT_ID` or
`PLATFORM_SECRET_KEY` are missing, every chain step is recorded as `simulated`
and the UI labels it as such. Simulated activity is never presented as a real
Stellar transaction.

## Background expiry job

`vercel.json` schedules Vercel Cron to call `GET /api/cron/expire` once a day.
It sweeps every guarantee still `PENDING_ACCEPTANCE` past its one-month
deadline (cancels it) or `ACTIVE` past its end date (marks it `EXPIRED`) —
the same rule the app already applies lazily whenever someone opens a
guarantee, just guaranteed to run even if nobody does. Requires `CRON_SECRET`
to be set; without it the endpoint refuses every request. Outside Vercel, hit
the same endpoint with `Authorization: Bearer $CRON_SECRET` from any
scheduler (cron, GitHub Actions, etc.).

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
- No unilateral withdrawal in the guarantor's favor: every payout to the
  landlord requires a proposal the guarantor authorized, or is a return the
  landlord grants in the guarantor's favor.
- A settlement can never pay out more than the locked balance (checked
  on-chain and off-chain); the remainder stays locked and the guarantee stays
  active.
- Double execution is blocked on-chain (`locked` is written down before any
  transfer) and off-chain (status transitions are validated).
- Personal data (names, emails, last names, photos) stays in Postgres, never
  on chain; guarantees always reference the immutable `user_id`, never the
  mutable alias.
