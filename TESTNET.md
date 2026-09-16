# Stellar testnet setup

Everything below runs on **testnet**. The MVP never targets mainnet.

Requires [`stellar` CLI](https://developers.stellar.org/docs/tools/cli) 22+ and
the `wasm32v1-none` Rust target.

## 1. Accounts

```bash
for k in platform issuer tenant landlord; do
  stellar keys generate $k --network testnet --fund
done
```

`platform` submits releases, `issuer` mints the test USDC, `tenant`/`landlord`
are the demo parties (real users bring their own Freighter wallet).

## 2. Test USDC

```bash
ISSUER=$(stellar keys address issuer)
stellar contract asset deploy --asset USDC:$ISSUER --source issuer --network testnet
# -> STELLAR_USDC_CONTRACT_ID

for k in tenant landlord; do
  stellar tx new change-trust --line USDC:$ISSUER --source $k --network testnet
done

stellar contract invoke --id $STELLAR_USDC_CONTRACT_ID --source issuer --network testnet \
  -- mint --to $(stellar keys address tenant) --amount 20000000000   # 2000 USDC
```

Amounts are in stroops: 7 decimals, so `1 USDC = 10_000_000`.

## 3. Escrow contract

```bash
cd contracts
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/rental_guarantee.wasm \
  --source platform --network testnet
# -> SOROBAN_CONTRACT_ID
```

## 4. App configuration

In `.env.local` (and in Vercel for a deployed environment):

```
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_USDC_CODE=USDC
STELLAR_USDC_ISSUER=<issuer address>
STELLAR_USDC_CONTRACT_ID=<asset contract address>
SOROBAN_CONTRACT_ID=<escrow contract address>
PLATFORM_SECRET_KEY=<platform secret>
DEMO_SIGNER_SECRETS=<tenant secret>,<landlord secret>   # scripted demo only
```

Leaving the three chain variables empty keeps the app in simulated demo mode.

## 5. Run the lifecycle on testnet

```bash
npm run dev
DEMO_TENANT_WALLET=$(stellar keys address tenant) \
DEMO_LANDLORD_WALLET=$(stellar keys address landlord) \
npx tsx scripts/demo-flow.ts
```

Expected output ends with `Submitted on Stellar testnet.` and a 150/850 split.
Verify the balances:

```bash
stellar contract invoke --id $STELLAR_USDC_CONTRACT_ID --source platform \
  --network testnet --send=no -- balance --id $(stellar keys address landlord)
```

## 6. Browser flow

Install [Freighter](https://www.freighter.app/), switch it to testnet, add the
USDC trustline for your account and use "Connect wallet" in the app. Each step
that needs a party signature opens Freighter; the transaction hash is stored and
linked to stellar.expert from the contract page.
