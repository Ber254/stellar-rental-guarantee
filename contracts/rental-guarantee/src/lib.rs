#![no_std]

//! Rental guarantee escrow.
//!
//! One deployed instance holds many guarantees, keyed by a numeric id that the
//! application derives from the rental contract reference (e.g. RG-2026-000001
//! -> 2026000001).
//!
//! Money only leaves the contract through `release_funds`, and only for a
//! distribution that both the tenant and the landlord authorised: one party
//! proposes, the other accepts, and the accepted split is frozen before any
//! transfer happens.

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, Address, Env};

const DAY_IN_LEDGERS: u32 = 17_280;
const LIFETIME_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
const BUMP_AMOUNT: u32 = DAY_IN_LEDGERS * 120;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[contracttype]
pub enum State {
    Created = 0,
    Funded = 1,
    ReturnRequested = 2,
    Negotiation = 3,
    Agreed = 4,
    Released = 5,
    Cancelled = 6,
}

#[derive(Clone, PartialEq, Eq, Debug)]
#[contracttype]
pub struct Guarantee {
    pub tenant: Address,
    pub landlord: Address,
    pub token: Address,
    pub amount: i128,
    pub end_date: u64,
    pub state: State,
}

#[derive(Clone, PartialEq, Eq, Debug)]
#[contracttype]
pub struct Distribution {
    pub proposer: Address,
    pub to_landlord: i128,
    pub to_tenant: i128,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Guarantee(u64),
    Proposal(u64),
    Agreement(u64),
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyExists = 1,
    NotFound = 2,
    InvalidAmount = 3,
    InvalidState = 4,
    NotAParty = 5,
    InvalidDistribution = 6,
    NoProposal = 7,
    CannotAcceptOwnProposal = 8,
    NoAgreement = 9,
    AlreadyReleased = 10,
}

#[contract]
pub struct RentalGuaranteeContract;

#[contractimpl]
impl RentalGuaranteeContract {
    /// Registers a guarantee. Nothing is transferred yet.
    pub fn create_guarantee(
        env: Env,
        id: u64,
        tenant: Address,
        landlord: Address,
        token: Address,
        amount: i128,
        end_date: u64,
    ) -> Result<(), Error> {
        tenant.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if env.storage().persistent().has(&DataKey::Guarantee(id)) {
            return Err(Error::AlreadyExists);
        }

        let guarantee = Guarantee {
            tenant,
            landlord,
            token,
            amount,
            end_date,
            state: State::Created,
        };
        save(&env, id, &guarantee);
        Ok(())
    }

    /// Moves the guarantee amount from the tenant into the contract and locks it.
    pub fn fund_guarantee(env: Env, id: u64) -> Result<(), Error> {
        let mut guarantee = load(&env, id)?;
        guarantee.tenant.require_auth();

        if guarantee.state != State::Created {
            return Err(Error::InvalidState);
        }

        let client = token::Client::new(&env, &guarantee.token);
        client.transfer(
            &guarantee.tenant,
            &env.current_contract_address(),
            &guarantee.amount,
        );

        guarantee.state = State::Funded;
        save(&env, id, &guarantee);
        Ok(())
    }

    /// Either party asks for the guarantee to be settled before the end date.
    pub fn request_release(env: Env, id: u64, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        let mut guarantee = load(&env, id)?;
        require_party(&guarantee, &caller)?;

        if guarantee.state != State::Funded {
            return Err(Error::InvalidState);
        }

        guarantee.state = State::ReturnRequested;
        save(&env, id, &guarantee);
        Ok(())
    }

    /// Proposes (or counter-proposes) how the locked amount should be split.
    pub fn propose_distribution(
        env: Env,
        id: u64,
        proposer: Address,
        to_landlord: i128,
        to_tenant: i128,
    ) -> Result<(), Error> {
        proposer.require_auth();
        let mut guarantee = load(&env, id)?;
        require_party(&guarantee, &proposer)?;

        if guarantee.state != State::ReturnRequested && guarantee.state != State::Negotiation {
            return Err(Error::InvalidState);
        }
        if to_landlord < 0 || to_tenant < 0 || to_landlord + to_tenant != guarantee.amount {
            return Err(Error::InvalidDistribution);
        }

        env.storage().persistent().set(
            &DataKey::Proposal(id),
            &Distribution {
                proposer,
                to_landlord,
                to_tenant,
            },
        );
        extend(&env, &DataKey::Proposal(id));

        guarantee.state = State::Negotiation;
        save(&env, id, &guarantee);
        Ok(())
    }

    /// The counterparty accepts the open proposal, freezing the final split.
    pub fn accept_proposal(env: Env, id: u64, acceptor: Address) -> Result<(), Error> {
        acceptor.require_auth();
        let mut guarantee = load(&env, id)?;
        require_party(&guarantee, &acceptor)?;

        if guarantee.state != State::Negotiation {
            return Err(Error::InvalidState);
        }

        let proposal: Distribution = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(id))
            .ok_or(Error::NoProposal)?;

        if proposal.proposer == acceptor {
            return Err(Error::CannotAcceptOwnProposal);
        }
        if proposal.to_landlord + proposal.to_tenant != guarantee.amount {
            return Err(Error::InvalidDistribution);
        }

        env.storage()
            .persistent()
            .set(&DataKey::Agreement(id), &proposal);
        extend(&env, &DataKey::Agreement(id));
        env.storage().persistent().remove(&DataKey::Proposal(id));

        guarantee.state = State::Agreed;
        save(&env, id, &guarantee);
        Ok(())
    }

    /// Pays out the agreed distribution. Callable by anyone; the amounts are fixed.
    pub fn release_funds(env: Env, id: u64) -> Result<(), Error> {
        let mut guarantee = load(&env, id)?;

        if guarantee.state == State::Released {
            return Err(Error::AlreadyReleased);
        }
        if guarantee.state != State::Agreed {
            return Err(Error::InvalidState);
        }

        let agreement: Distribution = env
            .storage()
            .persistent()
            .get(&DataKey::Agreement(id))
            .ok_or(Error::NoAgreement)?;

        if agreement.to_landlord + agreement.to_tenant != guarantee.amount {
            return Err(Error::InvalidDistribution);
        }

        // State is written before the transfers so a re-entrant call cannot pay twice.
        guarantee.state = State::Released;
        save(&env, id, &guarantee);

        let client = token::Client::new(&env, &guarantee.token);
        let contract = env.current_contract_address();
        if agreement.to_landlord > 0 {
            client.transfer(&contract, &guarantee.landlord, &agreement.to_landlord);
        }
        if agreement.to_tenant > 0 {
            client.transfer(&contract, &guarantee.tenant, &agreement.to_tenant);
        }

        Ok(())
    }

    /// Cancels a guarantee that was never funded.
    pub fn cancel_guarantee(env: Env, id: u64, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        let mut guarantee = load(&env, id)?;
        require_party(&guarantee, &caller)?;

        if guarantee.state != State::Created {
            return Err(Error::InvalidState);
        }

        guarantee.state = State::Cancelled;
        save(&env, id, &guarantee);
        Ok(())
    }

    pub fn get_guarantee(env: Env, id: u64) -> Result<Guarantee, Error> {
        load(&env, id)
    }

    pub fn get_proposal(env: Env, id: u64) -> Result<Distribution, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Proposal(id))
            .ok_or(Error::NoProposal)
    }

    pub fn get_agreement(env: Env, id: u64) -> Result<Distribution, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Agreement(id))
            .ok_or(Error::NoAgreement)
    }
}

fn load(env: &Env, id: u64) -> Result<Guarantee, Error> {
    let key = DataKey::Guarantee(id);
    let guarantee: Guarantee = env.storage().persistent().get(&key).ok_or(Error::NotFound)?;
    extend(env, &key);
    Ok(guarantee)
}

fn save(env: &Env, id: u64, guarantee: &Guarantee) {
    let key = DataKey::Guarantee(id);
    env.storage().persistent().set(&key, guarantee);
    extend(env, &key);
}

fn extend(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
}

fn require_party(guarantee: &Guarantee, caller: &Address) -> Result<(), Error> {
    if *caller != guarantee.tenant && *caller != guarantee.landlord {
        return Err(Error::NotAParty);
    }
    Ok(())
}

#[cfg(test)]
mod test;
