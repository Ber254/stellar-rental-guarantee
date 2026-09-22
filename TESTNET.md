# Stellar testnet setup

Everything below runs on **testnet**. The MVP never targets mainnet.

Requires [`stellar` CLI](https://developers.stellar.org/docs/tools/cli) 22+ and
the `wasm32v1-none` Rust target.

## 1. Accounts

```bash
for k in platform issuer treasury guarantor landlord; do
  stellar keys generate $k --network testnet --fund
done
```

`platform` submits payouts and administers the contract, `issuer` mints the test
USDC, `treasury` collects the SAFEXY fee, `guarantor`/`landlord` are the demo
parties (real users bring their own Freighter wallet).

## 2. Test USDC

```bash
ISSUER=$(stellar keys address issuer)
stellar contract asset deploy --asset USDC:$ISSUER --source issuer --network testnet
# -> STELLAR_USDC_CONTRACT_ID

for k in guarantor landlord treasury; do
  stellar tx new change-trust --line USDC:$ISSUER --source $k --network testnet
done

stellar contract invoke --id $STELLAR_USDC_CONTRACT_ID --source issuer --network testnet \
  -- mint --to $(stellar keys address guarantor) --amount 20000000000   # 2000 USDC
```

Amounts are in stroops: 7 decimals, so `1 USDC = 10_000_000`.

## 3. Escrow contract

The constructor takes the admin, the fee treasury and the fee in basis points
(`5` = 0.05%).

```bash
cd contracts
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/safexy_guarantee.wasm \
  --source platform --network testnet \
  -- --admin $(stellar keys address platform) \
     --treasury $(stellar keys address treasury) \
     --fee_bps 5
# -> SOROBAN_CONTRACT_ID
```

Current testnet deployment:
`CCAT2N5JSRUO2UJDB7RFSUG2FWUO2X77VJBSVLVTZI2VDZOSOYSH76LV`
(replaces `CB3JG5IKMHKUXRPYSZ6UVOEJ42XXGQQOIBK4UBYEPYSTGBZ6IIAN5LAH`, see
`MD/BLOCKCHAIN.md`). The treasury account needs the USDC trustline to receive
the fee.

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
DEMO_SIGNER_SECRETS=<guarantor secret>,<landlord secret>   # scripted demo only
```

Leaving the three chain variables empty keeps the app in simulated demo mode.

## 5. Run the lifecycle on testnet

```bash
npm run dev
DEMO_GUARANTOR_WALLET=$(stellar keys address guarantor) \
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
