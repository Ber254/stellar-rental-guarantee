#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

const ID: u64 = 2026000001;
const AMOUNT: i128 = 1_000_0000000; // 1000 USDC with 7 decimals

struct Setup {
    env: Env,
    client: RentalGuaranteeContractClient<'static>,
    token: TokenClient<'static>,
    tenant: Address,
    landlord: Address,
    token_address: Address,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    let asset = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = asset.address();
    StellarAssetClient::new(&env, &token_address).mint(&tenant, &AMOUNT);

    let contract_id = env.register(RentalGuaranteeContract, ());
    let client = RentalGuaranteeContractClient::new(&env, &contract_id);

    Setup {
        env: env.clone(),
        client,
        token: TokenClient::new(&env, &token_address),
        tenant,
        landlord,
        token_address,
    }
}

impl Setup {
    fn create(&self) {
        self.client.create_guarantee(
            &ID,
            &self.tenant,
            &self.landlord,
            &self.token_address,
            &AMOUNT,
            &1893456000,
        );
    }

    fn fund(&self) {
        self.create();
        self.client.fund_guarantee(&ID);
    }

    fn negotiating(&self) {
        self.fund();
        self.client.request_release(&ID, &self.tenant);
    }
}

#[test]
fn creates_a_guarantee_in_created_state() {
    let s = setup();
    s.create();

    let guarantee = s.client.get_guarantee(&ID);
    assert_eq!(guarantee.state, State::Created);
    assert_eq!(guarantee.amount, AMOUNT);
    assert_eq!(guarantee.tenant, s.tenant);
    assert_eq!(guarantee.landlord, s.landlord);
}

#[test]
fn rejects_duplicate_and_invalid_guarantees() {
    let s = setup();
    s.create();

    assert_eq!(
        s.client.try_create_guarantee(
            &ID,
            &s.tenant,
            &s.landlord,
            &s.token_address,
            &AMOUNT,
            &1893456000
        ),
        Err(Ok(Error::AlreadyExists))
    );
    assert_eq!(
        s.client.try_create_guarantee(
            &(ID + 1),
            &s.tenant,
            &s.landlord,
            &s.token_address,
            &0,
            &1893456000
        ),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn funding_locks_the_amount_in_the_contract() {
    let s = setup();
    s.fund();

    assert_eq!(s.token.balance(&s.tenant), 0);
    assert_eq!(s.token.balance(&s.client.address), AMOUNT);
    assert_eq!(s.client.get_guarantee(&ID).state, State::Funded);
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
fn funding_requires_the_tenant_signature() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(admin);
    let token_address = asset.address();
    let contract_id = env.register(RentalGuaranteeContract, ());
    let client = RentalGuaranteeContractClient::new(&env, &contract_id);

    env.mock_all_auths();
    StellarAssetClient::new(&env, &token_address).mint(&tenant, &AMOUNT);
    client.create_guarantee(
        &ID,
        &tenant,
        &landlord,
        &token_address,
        &AMOUNT,
        &1893456000,
    );

    // No auth entries are mocked from here on, so require_auth must fail.
    env.set_auths(&[]);
    assert!(client.try_fund_guarantee(&ID).is_err());
    assert_eq!(client.get_guarantee(&ID).state, State::Created);
}

#[test]
fn outsiders_cannot_act_on_a_guarantee() {
    let s = setup();
    s.fund();
    let outsider = Address::generate(&s.env);

    assert_eq!(
        s.client.try_request_release(&ID, &outsider),
        Err(Ok(Error::NotAParty))
    );

    s.client.request_release(&ID, &s.tenant);
    assert_eq!(
        s.client
            .try_propose_distribution(&ID, &outsider, &AMOUNT, &0),
        Err(Ok(Error::NotAParty))
    );
}

#[test]
fn funds_stay_locked_while_active() {
    let s = setup();
    s.fund();

    assert_eq!(
        s.client.try_release_funds(&ID),
        Err(Ok(Error::InvalidState))
    );
    assert_eq!(
        s.client.try_accept_proposal(&ID, &s.landlord),
        Err(Ok(Error::InvalidState))
    );
    assert_eq!(s.token.balance(&s.client.address), AMOUNT);
}

#[test]
fn distribution_must_equal_the_locked_amount() {
    let s = setup();
    s.negotiating();

    assert_eq!(
        s.client
            .try_propose_distribution(&ID, &s.landlord, &(AMOUNT / 2), &(AMOUNT / 2 + 1)),
        Err(Ok(Error::InvalidDistribution))
    );
    assert_eq!(
        s.client
            .try_propose_distribution(&ID, &s.landlord, &(-1), &(AMOUNT + 1)),
        Err(Ok(Error::InvalidDistribution))
    );
}

#[test]
fn a_party_cannot_accept_its_own_proposal() {
    let s = setup();
    s.negotiating();

    s.client
        .propose_distribution(&ID, &s.landlord, &(300 * 10_000_000), &(700 * 10_000_000));

    assert_eq!(
        s.client.try_accept_proposal(&ID, &s.landlord),
        Err(Ok(Error::CannotAcceptOwnProposal))
    );
    assert_eq!(s.client.get_guarantee(&ID).state, State::Negotiation);
}

#[test]
fn counter_offer_replaces_the_open_proposal() {
    let s = setup();
    s.negotiating();

    s.client
        .propose_distribution(&ID, &s.landlord, &(300 * 10_000_000), &(700 * 10_000_000));
    s.client
        .propose_distribution(&ID, &s.tenant, &(150 * 10_000_000), &(850 * 10_000_000));

    let proposal = s.client.get_proposal(&ID);
    assert_eq!(proposal.proposer, s.tenant);
    assert_eq!(proposal.to_landlord, 150 * 10_000_000);
}

#[test]
fn full_lifecycle_distributes_the_agreed_split() {
    let s = setup();
    s.negotiating();

    s.client
        .propose_distribution(&ID, &s.landlord, &(300 * 10_000_000), &(700 * 10_000_000));
    s.client
        .propose_distribution(&ID, &s.tenant, &(150 * 10_000_000), &(850 * 10_000_000));
    s.client.accept_proposal(&ID, &s.landlord);

    assert_eq!(s.client.get_guarantee(&ID).state, State::Agreed);
    let agreement = s.client.get_agreement(&ID);
    assert_eq!(agreement.to_landlord, 150 * 10_000_000);

    s.client.release_funds(&ID);

    assert_eq!(s.token.balance(&s.landlord), 150 * 10_000_000);
    assert_eq!(s.token.balance(&s.tenant), 850 * 10_000_000);
    assert_eq!(s.token.balance(&s.client.address), 0);
    assert_eq!(s.client.get_guarantee(&ID).state, State::Released);
}

#[test]
fn full_return_pays_everything_back_to_the_tenant() {
    let s = setup();
    s.negotiating();

    s.client.propose_distribution(&ID, &s.landlord, &0, &AMOUNT);
    s.client.accept_proposal(&ID, &s.tenant);
    s.client.release_funds(&ID);

    assert_eq!(s.token.balance(&s.tenant), AMOUNT);
    assert_eq!(s.token.balance(&s.landlord), 0);
}

#[test]
fn a_guarantee_cannot_be_released_twice() {
    let s = setup();
    s.negotiating();

    s.client.propose_distribution(&ID, &s.landlord, &0, &AMOUNT);
    s.client.accept_proposal(&ID, &s.tenant);
    s.client.release_funds(&ID);

    assert_eq!(
        s.client.try_release_funds(&ID),
        Err(Ok(Error::AlreadyReleased))
    );
    assert_eq!(s.token.balance(&s.tenant), AMOUNT);
}

#[test]
fn invalid_state_transitions_are_rejected() {
    let s = setup();
    s.create();

    assert_eq!(
        s.client.try_request_release(&ID, &s.tenant),
        Err(Ok(Error::InvalidState))
    );
    assert_eq!(
        s.client
            .try_propose_distribution(&ID, &s.tenant, &0, &AMOUNT),
        Err(Ok(Error::InvalidState))
    );
    assert_eq!(
        s.client.try_get_guarantee(&(ID + 99)),
        Err(Ok(Error::NotFound))
    );
}

#[test]
fn an_unfunded_guarantee_can_be_cancelled() {
    let s = setup();
    s.create();

    s.client.cancel_guarantee(&ID, &s.tenant);
    assert_eq!(s.client.get_guarantee(&ID).state, State::Cancelled);

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
