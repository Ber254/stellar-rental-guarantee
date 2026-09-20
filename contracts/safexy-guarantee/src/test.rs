#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

const ID: u64 = 2026000001;
const USDC: i128 = 10_000_000; // 1 USDC with 7 decimals
const AMOUNT: i128 = 1000 * USDC;
const FEE_BPS: u32 = 5; // 0.05%
const END_DATE: u64 = 1893456000;

struct Setup {
    env: Env,
    client: SafexyGuaranteeContractClient<'static>,
    token: TokenClient<'static>,
    minter: StellarAssetClient<'static>,
    guarantor: Address,
    landlord: Address,
    treasury: Address,
    admin: Address,
    token_address: Address,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let guarantor = Address::generate(&env);
    let landlord = Address::generate(&env);

    let asset = env.register_stellar_asset_contract_v2(issuer);
    let token_address = asset.address();
    let minter = StellarAssetClient::new(&env, &token_address);
    minter.mint(&guarantor, &AMOUNT);

    let contract_id = env.register(
        SafexyGuaranteeContract,
        (admin.clone(), treasury.clone(), FEE_BPS),
    );

    Setup {
        env: env.clone(),
        client: SafexyGuaranteeContractClient::new(&env, &contract_id),
        token: TokenClient::new(&env, &token_address),
        minter,
        guarantor,
        landlord,
        treasury,
        admin,
        token_address,
    }
}

impl Setup {
    fn create(&self) {
        self.client.create_guarantee(
            &ID,
            &self.guarantor,
            &self.landlord,
            &self.token_address,
            &AMOUNT,
            &END_DATE,
        );
    }

    fn fund(&self) {
        self.create();
        self.client.fund_guarantee(&ID);
    }

    /// Guarantor asks for `to_guarantor`, landlord accepts, platform executes.
    fn settle(&self, to_guarantor: i128, to_landlord: i128) {
        self.client
            .propose_settlement(&ID, &self.guarantor, &to_guarantor, &to_landlord);
        self.client.accept_settlement(&ID, &self.landlord);
        self.client.execute_settlement(&ID);
    }

    fn locked(&self) -> i128 {
        self.client.get_guarantee(&ID).locked
    }
}

#[test]
fn creates_a_guarantee_pending_funding() {
    let s = setup();
    s.create();

    let guarantee = s.client.get_guarantee(&ID);
    assert_eq!(guarantee.state, State::Pending);
    assert_eq!(guarantee.locked, AMOUNT);
    assert_eq!(guarantee.funded, 0);
    assert_eq!(guarantee.guarantor, s.guarantor);
    assert_eq!(guarantee.landlord, s.landlord);
}

#[test]
fn rejects_duplicate_invalid_and_self_dealing_guarantees() {
    let s = setup();
    s.create();

    assert_eq!(
        s.client.try_create_guarantee(
            &ID,
            &s.guarantor,
            &s.landlord,
            &s.token_address,
            &AMOUNT,
            &END_DATE
        ),
        Err(Ok(Error::AlreadyExists))
    );
    assert_eq!(
        s.client.try_create_guarantee(
            &(ID + 1),
            &s.guarantor,
            &s.landlord,
            &s.token_address,
            &0,
            &END_DATE
        ),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        s.client.try_create_guarantee(
            &(ID + 2),
            &s.guarantor,
            &s.guarantor,
            &s.token_address,
            &AMOUNT,
            &END_DATE
        ),
        Err(Ok(Error::NotAParty))
    );
}

#[test]
fn funding_locks_the_amount_in_the_contract() {
    let s = setup();
    s.fund();

    assert_eq!(s.token.balance(&s.guarantor), 0);
    assert_eq!(s.token.balance(&s.client.address), AMOUNT);
    let guarantee = s.client.get_guarantee(&ID);
    assert_eq!(guarantee.state, State::Active);
    assert_eq!(guarantee.funded, AMOUNT);
}

#[test]
fn cannot_fund_twice() {
    let s = setup();
    s.fund();

    assert_eq!(
        s.client.try_fund_guarantee(&ID),
        Err(Ok(Error::InvalidState))
    );
}

#[test]
fn funding_requires_the_guarantor_signature() {
    let s = setup();
    s.create();

    s.env.set_auths(&[]);
    assert!(s.client.try_fund_guarantee(&ID).is_err());
    assert_eq!(s.client.get_guarantee(&ID).state, State::Pending);
}

#[test]
fn outsiders_cannot_act_on_a_guarantee() {
    let s = setup();
    s.fund();
    let outsider = Address::generate(&s.env);

    assert_eq!(
        s.client.try_propose_settlement(&ID, &outsider, &AMOUNT, &0),
        Err(Ok(Error::NotAParty))
    );
    s.client.propose_settlement(&ID, &s.guarantor, &AMOUNT, &0);
    assert_eq!(
        s.client.try_accept_settlement(&ID, &outsider),
        Err(Ok(Error::NotAParty))
    );
}

#[test]
fn funds_stay_locked_without_an_agreement() {
    let s = setup();
    s.fund();

    assert_eq!(
        s.client.try_execute_settlement(&ID),
        Err(Ok(Error::NoAgreement))
    );
    assert_eq!(
        s.client.try_accept_settlement(&ID, &s.landlord),
        Err(Ok(Error::NoSettlement))
    );
    assert_eq!(s.token.balance(&s.client.address), AMOUNT);
}

#[test]
fn a_settlement_cannot_exceed_the_locked_balance() {
    let s = setup();
    s.fund();

    assert_eq!(
        s.client
            .try_propose_settlement(&ID, &s.guarantor, &(AMOUNT / 2), &(AMOUNT / 2 + 1)),
        Err(Ok(Error::ExceedsLocked))
    );
    assert_eq!(
        s.client
            .try_propose_settlement(&ID, &s.guarantor, &(-1), &(AMOUNT + 1)),
        Err(Ok(Error::InvalidSettlement))
    );
}

#[test]
fn a_party_cannot_accept_its_own_proposal() {
    let s = setup();
    s.fund();

    s.client
        .propose_settlement(&ID, &s.landlord, &(300 * USDC), &(700 * USDC));

    assert_eq!(
        s.client.try_accept_settlement(&ID, &s.landlord),
        Err(Ok(Error::CannotAcceptOwnProposal))
    );
}

#[test]
fn counter_offer_replaces_the_open_proposal_and_rejection_clears_it() {
    let s = setup();
    s.fund();

    s.client
        .propose_settlement(&ID, &s.landlord, &(300 * USDC), &(700 * USDC));
    s.client
        .propose_settlement(&ID, &s.guarantor, &(850 * USDC), &(150 * USDC));

    let proposal = s.client.get_settlement(&ID);
    assert_eq!(proposal.proposer, s.guarantor);
    assert_eq!(proposal.to_guarantor, 850 * USDC);

    s.client.reject_settlement(&ID, &s.landlord);
    assert_eq!(
        s.client.try_get_settlement(&ID),
        Err(Ok(Error::NoSettlement))
    );
}

#[test]
fn full_return_pays_the_guarantor_net_of_the_fee() {
    let s = setup();
    s.fund();

    s.settle(AMOUNT, 0);

    let fee = AMOUNT * i128::from(FEE_BPS) / 10_000; // 0.5 USDC over 1000
    assert_eq!(fee, USDC / 2);
    assert_eq!(s.token.balance(&s.guarantor), AMOUNT - fee);
    assert_eq!(s.token.balance(&s.treasury), fee);
    assert_eq!(s.token.balance(&s.client.address), 0);
    assert_eq!(s.client.get_guarantee(&ID).state, State::Closed);
}

#[test]
fn a_split_settlement_charges_the_fee_only_on_the_returned_part() {
    let s = setup();
    s.fund();

    s.settle(600 * USDC, 400 * USDC);

    let fee = 600 * USDC * i128::from(FEE_BPS) / 10_000; // 0.3 USDC
    assert_eq!(s.token.balance(&s.guarantor), 600 * USDC - fee);
    assert_eq!(s.token.balance(&s.landlord), 400 * USDC);
    assert_eq!(s.token.balance(&s.treasury), fee);
    assert_eq!(s.client.get_guarantee(&ID).state, State::Closed);
}

#[test]
fn successive_partial_returns_keep_the_rest_locked() {
    let s = setup();
    s.fund();

    // 1000 -> return 300, then 200, then release the remaining 500.
    s.settle(300 * USDC, 0);
    assert_eq!(s.locked(), 700 * USDC);
    assert_eq!(s.client.get_guarantee(&ID).state, State::Active);

    s.settle(200 * USDC, 0);
    assert_eq!(s.locked(), 500 * USDC);
    assert_eq!(s.client.get_guarantee(&ID).state, State::Active);

    s.settle(500 * USDC, 0);
    assert_eq!(s.locked(), 0);
    assert_eq!(s.client.get_guarantee(&ID).state, State::Closed);

    let fee = AMOUNT * i128::from(FEE_BPS) / 10_000;
    assert_eq!(s.token.balance(&s.guarantor), AMOUNT - fee);
    assert_eq!(s.token.balance(&s.treasury), fee);
    assert_eq!(s.token.balance(&s.client.address), 0);
}

#[test]
fn releases_can_never_exceed_the_funded_amount() {
    let s = setup();
    s.fund();

    s.settle(800 * USDC, 0);

    assert_eq!(
        s.client
            .try_propose_settlement(&ID, &s.guarantor, &(300 * USDC), &0),
        Err(Ok(Error::ExceedsLocked))
    );
    s.settle(200 * USDC, 0);
    assert_eq!(s.token.balance(&s.client.address), 0);

    // Closed guarantees take no further settlements.
    assert_eq!(
        s.client
            .try_propose_settlement(&ID, &s.guarantor, &USDC, &0),
        Err(Ok(Error::InvalidState))
    );
}

#[test]
fn an_agreement_cannot_be_executed_twice() {
    let s = setup();
    s.fund();

    s.settle(400 * USDC, 0);

    assert_eq!(
        s.client.try_execute_settlement(&ID),
        Err(Ok(Error::NoAgreement))
    );
    assert_eq!(s.locked(), 600 * USDC);
    assert_eq!(s.token.balance(&s.client.address), 600 * USDC);
}

#[test]
fn the_landlord_can_return_funds_unilaterally() {
    let s = setup();
    s.fund();

    s.client.return_to_guarantor(&ID, &(250 * USDC));

    let fee = 250 * USDC * i128::from(FEE_BPS) / 10_000;
    assert_eq!(s.token.balance(&s.guarantor), 250 * USDC - fee);
    assert_eq!(s.token.balance(&s.treasury), fee);
    assert_eq!(s.locked(), 750 * USDC);

    assert_eq!(
        s.client.try_return_to_guarantor(&ID, &(800 * USDC)),
        Err(Ok(Error::ExceedsLocked))
    );
}

#[test]
fn a_unilateral_return_requires_the_landlord_signature() {
    let s = setup();
    s.fund();

    s.env.set_auths(&[]);
    assert!(s
        .client
        .try_return_to_guarantor(&ID, &(100 * USDC))
        .is_err());
    assert_eq!(s.token.balance(&s.client.address), AMOUNT);
}

#[test]
fn extending_with_a_larger_amount_takes_the_difference_upfront() {
    let s = setup();
    s.fund();
    s.minter.mint(&s.guarantor, &(500 * USDC));

    s.client
        .propose_extension(&ID, &(END_DATE + 86400), &(1500 * USDC));
    assert_eq!(s.token.balance(&s.guarantor), 0);
    assert_eq!(s.locked(), AMOUNT); // not counted until accepted

    s.client.accept_extension(&ID);

    let guarantee = s.client.get_guarantee(&ID);
    assert_eq!(guarantee.locked, 1500 * USDC);
    assert_eq!(guarantee.funded, 1500 * USDC);
    assert_eq!(guarantee.end_date, END_DATE + 86400);
    assert_eq!(s.token.balance(&s.client.address), 1500 * USDC);
}

#[test]
fn extending_with_a_smaller_amount_returns_the_difference_net_of_fee() {
    let s = setup();
    s.fund();

    s.client
        .propose_extension(&ID, &(END_DATE + 86400), &(600 * USDC));
    s.client.accept_extension(&ID);

    let refund = 400 * USDC;
    let fee = refund * i128::from(FEE_BPS) / 10_000; // 0.2 USDC
    assert_eq!(fee, 2 * USDC / 10);
    assert_eq!(s.token.balance(&s.guarantor), refund - fee);
    assert_eq!(s.token.balance(&s.treasury), fee);

    let guarantee = s.client.get_guarantee(&ID);
    assert_eq!(guarantee.locked, 600 * USDC);
    assert_eq!(guarantee.end_date, END_DATE + 86400);
    assert_eq!(guarantee.state, State::Active);
}

#[test]
fn cancelling_an_extension_refunds_the_prefunded_top_up() {
    let s = setup();
    s.fund();
    s.minter.mint(&s.guarantor, &(500 * USDC));

    s.client.propose_extension(&ID, &END_DATE, &(1500 * USDC));
    s.client.cancel_extension(&ID, &s.landlord);

    assert_eq!(s.token.balance(&s.guarantor), 500 * USDC);
    assert_eq!(s.token.balance(&s.client.address), AMOUNT);
    assert_eq!(s.locked(), AMOUNT);
    assert_eq!(
        s.client.try_accept_extension(&ID),
        Err(Ok(Error::NoExtension))
    );
}

#[test]
fn replacing_an_extension_refunds_the_previous_top_up() {
    let s = setup();
    s.fund();
    s.minter.mint(&s.guarantor, &(500 * USDC));

    s.client.propose_extension(&ID, &END_DATE, &(1500 * USDC));
    s.client.propose_extension(&ID, &END_DATE, &(1200 * USDC));

    assert_eq!(s.token.balance(&s.guarantor), 300 * USDC);
    assert_eq!(s.client.get_extension(&ID).top_up, 200 * USDC);
    assert_eq!(s.token.balance(&s.client.address), AMOUNT + 200 * USDC);
}

#[test]
fn the_fee_is_configurable_by_the_admin_only() {
    let s = setup();
    s.fund();
    let new_treasury = Address::generate(&s.env);

    s.client.set_fee_bps(&100); // 1%
    s.client.set_treasury(&new_treasury);
    assert_eq!(s.client.get_config().admin, s.admin);
    assert_eq!(
        s.client.try_set_fee_bps(&(MAX_FEE_BPS + 1)),
        Err(Ok(Error::FeeTooHigh))
    );

    s.settle(100 * USDC, 0);
    assert_eq!(s.token.balance(&new_treasury), USDC);
    assert_eq!(s.token.balance(&s.treasury), 0);
    assert_eq!(s.token.balance(&s.guarantor), 99 * USDC);
}

#[test]
fn changing_the_fee_requires_the_admin_signature() {
    let s = setup();

    s.env.set_auths(&[]);
    assert!(s.client.try_set_fee_bps(&50).is_err());
    assert_eq!(s.client.get_config().fee_bps, FEE_BPS);
}

#[test]
fn the_fee_is_rounded_up_to_the_stroop() {
    let s = setup();
    s.fund();

    // 1 stroop * 5bps = 0.0005 -> rounds up to 1 stroop, all of it fee.
    s.settle(1, 0);
    assert_eq!(s.token.balance(&s.treasury), 1);
    assert_eq!(s.token.balance(&s.guarantor), 0);
    assert_eq!(s.locked(), AMOUNT - 1);
}

#[test]
fn an_unfunded_guarantee_can_be_cancelled() {
    let s = setup();
    s.create();

    s.client.cancel_guarantee(&ID, &s.guarantor);
    let guarantee = s.client.get_guarantee(&ID);
    assert_eq!(guarantee.state, State::Cancelled);
    assert_eq!(guarantee.locked, 0);

    assert_eq!(
        s.client.try_fund_guarantee(&ID),
        Err(Ok(Error::InvalidState))
    );
}

#[test]
fn a_funded_guarantee_cannot_be_cancelled() {
    let s = setup();
    s.fund();

    assert_eq!(
        s.client.try_cancel_guarantee(&ID, &s.landlord),
        Err(Ok(Error::InvalidState))
    );
    assert_eq!(s.token.balance(&s.client.address), AMOUNT);
}

#[test]
fn unknown_guarantees_are_reported_as_missing() {
    let s = setup();

    assert_eq!(
        s.client.try_get_guarantee(&(ID + 99)),
        Err(Ok(Error::NotFound))
    );
    assert_eq!(
        s.client.try_fund_guarantee(&(ID + 99)),
        Err(Ok(Error::NotFound))
    );
}
