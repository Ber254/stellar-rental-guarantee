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
(`50` = 0.5%).

```bash
cd contracts
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/safexy_guarantee.wasm \
  --source platform --network testnet \
  -- --admin $(stellar keys address platform) \
     --treasury $(stellar keys address treasury) \
     --fee_bps 50
# -> SOROBAN_CONTRACT_ID
```

Current testnet deployment (`fee_bps = 50`, used by the public app):
`CCR3OY2DAFWFQAWHOI3XCSDRYFENUQKR5RXSLI7FB5JOEWU7S5CPJZ53`
(replaces `CCAT2N5JSRUO2UJDB7RFSUG2FWUO2X77VJBSVLVTZI2VDZOSOYSH76LV`, same code
with `fee_bps = 5`, which in turn replaced
`CB3JG5IKMHKUXRPYSZ6UVOEJ42XXGQQOIBK4UBYEPYSTGBZ6IIAN5LAH`; see
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

To run the **Week 1 successive partial returns** flow (two consecutive partial
settlements leaving a verified remaining locked balance on-chain):

```bash
npm run dev
npx tsx scripts/partial-returns-flow.ts
```

To run the **Week 2 unilateral return and extensions (increase & decrease)** flow:

```bash
npm run dev
npx tsx scripts/unilateral-and-extensions-flow.ts
```

For the consolidated verification report (all 24 transaction hashes, `stellar.expert`
links, and the UI reviewer walkthrough for `https://rental-guarantee-stellar.vercel.app`),
see [`MD/VERIFICATION.md`](MD/VERIFICATION.md).

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

## 7. Verification evidence (Instaward sprint)

Key transaction per mechanic. The first five come from the scripted runs
(Weeks 1–2, `fee_bps = 5`); the last five from the run driven only through the
public UI on 2026-11-16 (`fee_bps = 50`). Every step of every run (create,
fund, proposals, acceptances), the final on-chain state and the balance checks
are in [`MD/VERIFICATION.md`](MD/VERIFICATION.md).

| Mechanic | Contract | Transaction | Locked USDC |
| --- | --- | --- | --- |
| Partial return #1 | `CCAT2N5J…76LV` | [`a024210adc…`](https://stellar.expert/explorer/testnet/tx/a024210adc300cec65af8716fa190d0146f5e3786f47b9692256d1b6af45f637) | 1000 → 700 locked |
| Partial return #2 | `CCAT2N5J…76LV` | [`fcac62ed1c…`](https://stellar.expert/explorer/testnet/tx/fcac62ed1c2b6cae23108a08ac2881c18294504b8c666339d384788195e88b49) | 700 → 400 locked |
| Landlord unilateral return | `CCAT2N5J…76LV` | [`ba2bd381ec…`](https://stellar.expert/explorer/testnet/tx/ba2bd381ec8568a17a430d2429d30a8a2300f6b1f90b1260d67a242573b61076) | 600 → 400 locked |
| Extension with amount increase | `CCAT2N5J…76LV` | [`92b8a4a591…`](https://stellar.expert/explorer/testnet/tx/92b8a4a591e8ab30baaa2817fa41e8fc75027f45b7ae9d69acd396f4d6197ef1) | 400 → 700 locked |
| Extension with amount decrease | `CCAT2N5J…76LV` | [`24ba11152c…`](https://stellar.expert/explorer/testnet/tx/24ba11152cb342ef7b4ed678dc480046ed8f1da8d5999d5f1d0891d70cee397c) | 700 → 500 locked |
| Partial return #1 (UI) | `CCR3OY2D…JZ53` | [`99c01353c8…`](https://stellar.expert/explorer/testnet/tx/99c01353c89c4ca7adc21036da1b2048f8d34df1e3b445cde026faae2693f9af) | 100 → 70 locked |
| Partial return #2 (UI) | `CCR3OY2D…JZ53` | [`7d3779db5b…`](https://stellar.expert/explorer/testnet/tx/7d3779db5baf02a4462c6c235e36a7b95c10fc2f7f17f882d78fe3980a62791c) | 70 → 50 locked |
| Landlord unilateral return (UI) | `CCR3OY2D…JZ53` | [`3dc37ce300…`](https://stellar.expert/explorer/testnet/tx/3dc37ce3009077c084c657c334869d325a6c95d5df9ea68e731fd035c72510af) | 50 → 40 locked |
| Extension with amount increase (UI) | `CCR3OY2D…JZ53` | [`bb4d2aceea…`](https://stellar.expert/explorer/testnet/tx/bb4d2aceea5e6fa8419396ecae63ddd1f3009dd62dac6765c4b378d817ba0a8d) | 40 → 60 locked |
| Extension with amount decrease (UI) | `CCR3OY2D…JZ53` | [`dbfee3fb2e…`](https://stellar.expert/explorer/testnet/tx/dbfee3fb2e7cd6b63c27e5782296a6c7312e564eb0004568534d07e9fd7a5d1e) | 60 → 30 locked |

| Resource | Address |
| --- | --- |
| Escrow contract (live app) | [`CCR3OY2DAFWFQAWHOI3XCSDRYFENUQKR5RXSLI7FB5JOEWU7S5CPJZ53`](https://stellar.expert/explorer/testnet/contract/CCR3OY2DAFWFQAWHOI3XCSDRYFENUQKR5RXSLI7FB5JOEWU7S5CPJZ53) |
| Escrow contract (Weeks 1–2) | [`CCAT2N5JSRUO2UJDB7RFSUG2FWUO2X77VJBSVLVTZI2VDZOSOYSH76LV`](https://stellar.expert/explorer/testnet/contract/CCAT2N5JSRUO2UJDB7RFSUG2FWUO2X77VJBSVLVTZI2VDZOSOYSH76LV) |
| USDC asset contract | [`CDSA3RLXVDMZGV6ZWDZY3HKFDJT2ZSEUCHPMG3OQXQUNU5W64XMHCIIO`](https://stellar.expert/explorer/testnet/contract/CDSA3RLXVDMZGV6ZWDZY3HKFDJT2ZSEUCHPMG3OQXQUNU5W64XMHCIIO) |
| Demo guarantor (`@alice.guarantor`) | [`GDGZ7E2PJZ33M2X7EDDZ65KJCJWQP5QCZWDEBHSBRNHNQRYCGMHXJGBH`](https://stellar.expert/explorer/testnet/account/GDGZ7E2PJZ33M2X7EDDZ65KJCJWQP5QCZWDEBHSBRNHNQRYCGMHXJGBH) |
| Demo landlord (`@bob.landlord`) | [`GBYME6KARFMF4GX62SOH6WWJJXBOUKZNBJN3XOPOYQUOG3RGF4A3HX5A`](https://stellar.expert/explorer/testnet/account/GBYME6KARFMF4GX62SOH6WWJJXBOUKZNBJN3XOPOYQUOG3RGF4A3HX5A) |
| Fee treasury | [`GCBM7PFRWJ2OKMPI26FK22ZKBNLR4UUSR76NY52FU2JWOAEV4LNKUZUB`](https://stellar.expert/explorer/testnet/account/GCBM7PFRWJ2OKMPI26FK22ZKBNLR4UUSR76NY52FU2JWOAEV4LNKUZUB) |
| Public demo | https://rental-guarantee-stellar.vercel.app |
