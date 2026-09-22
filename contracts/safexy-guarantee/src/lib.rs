#![no_std]

//! SAFEXY guarantee escrow.
//!
//! One deployed instance holds many guarantees, keyed by a numeric id assigned
//! by the application. A guarantee is money that a **guarantor** locks in favour
//! of a **landlord**; the roles belong to the guarantee, not to the account.
//!
//! Money only leaves the contract through a settlement that both parties
//! authorised (one proposes, the other accepts) or through a return that the
//! landlord grants unilaterally to the guarantor. Every payout decreases
//! `locked`, so the sum of all payouts can never exceed the funded amount.
//!
//! Returns to the guarantor pay a platform fee (`fee_bps`, default 5 bps =
//! 0.05%) to a configurable treasury address. Payouts to the landlord are not
//! charged.

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, Address, Env};

const DAY_IN_LEDGERS: u32 = 17_280;
const LIFETIME_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
const BUMP_AMOUNT: u32 = DAY_IN_LEDGERS * 120;

/// Hard ceiling for the configurable fee: 5%.
const MAX_FEE_BPS: u32 = 500;
const BPS_DENOMINATOR: i128 = 10_000;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[contracttype]
pub enum State {
    /// Registered, not funded yet.
    Pending = 0,
    /// Funded: `locked` is held by the contract.
    Active = 1,
    /// Fully paid out: `locked` is zero.
    Closed = 2,
    /// Dropped before funding.
    Cancelled = 3,
}

#[derive(Clone, PartialEq, Eq, Debug)]
#[contracttype]
pub struct Guarantee {
    pub guarantor: Address,
    pub landlord: Address,
    pub token: Address,
    /// Amount currently held by the contract for this guarantee.
    pub locked: i128,
    /// Amount funded so far, including accepted top-ups. Never decreases.
    pub funded: i128,
    pub end_date: u64,
    pub state: State,
}

/// A proposed or agreed payout. `to_guarantor + to_landlord` may be less than
/// `locked`: the remainder stays locked and the guarantee stays active.
#[derive(Clone, PartialEq, Eq, Debug)]
#[contracttype]
pub struct Settlement {
    pub proposer: Address,
    pub to_guarantor: i128,
    pub to_landlord: i128,
}

/// A pending change of amount and/or end date. An increase is pre-funded by the
/// guarantor when proposing, so accepting never needs the guarantor's signature.
#[derive(Clone, PartialEq, Eq, Debug)]
#[contracttype]
pub struct Extension {
    pub new_end_date: u64,
    pub new_amount: i128,
    /// Extra funds already transferred in by the guarantor (increase case).
    pub top_up: i128,
}

#[derive(Clone, PartialEq, Eq, Debug)]
#[contracttype]
pub struct Config {
    pub admin: Address,
    pub treasury: Address,
    pub fee_bps: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Config,
    Guarantee(u64),
    Settlement(u64),
    Agreement(u64),
    Extension(u64),
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
    InvalidSettlement = 6,
    NoSettlement = 7,
    CannotAcceptOwnProposal = 8,
    NoAgreement = 9,
    ExceedsLocked = 10,
    NoExtension = 11,
    FeeTooHigh = 12,
    NotConfigured = 13,
}

#[contract]
pub struct SafexyGuaranteeContract;

#[contractimpl]
impl SafexyGuaranteeContract {
    /// `admin` may later change the treasury address and the fee.
    pub fn __constructor(env: Env, admin: Address, treasury: Address, fee_bps: u32) {
        if fee_bps > MAX_FEE_BPS {
            panic_with_error(&env, Error::FeeTooHigh);
        }
        env.storage().instance().set(
            &DataKey::Config,
            &Config {
                admin,
                treasury,
                fee_bps,
            },
        );
    }

    pub fn set_treasury(env: Env, treasury: Address) -> Result<(), Error> {
        let mut config = config(&env)?;
        config.admin.require_auth();
        config.treasury = treasury;
        env.storage().instance().set(&DataKey::Config, &config);
        Ok(())
    }

    pub fn set_fee_bps(env: Env, fee_bps: u32) -> Result<(), Error> {
        if fee_bps > MAX_FEE_BPS {
            return Err(Error::FeeTooHigh);
        }
        let mut config = config(&env)?;
        config.admin.require_auth();
        config.fee_bps = fee_bps;
        env.storage().instance().set(&DataKey::Config, &config);
        Ok(())
    }

    pub fn get_config(env: Env) -> Result<Config, Error> {
        config(&env)
    }

    /// Registers a guarantee. Nothing is transferred yet.
    pub fn create_guarantee(
        env: Env,
        id: u64,
        guarantor: Address,
        landlord: Address,
        token: Address,
        amount: i128,
        end_date: u64,
    ) -> Result<(), Error> {
        guarantor.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if guarantor == landlord {
            return Err(Error::NotAParty);
        }
        if env.storage().persistent().has(&DataKey::Guarantee(id)) {
            return Err(Error::AlreadyExists);
        }

        save(
            &env,
            id,
            &Guarantee {
                guarantor,
                landlord,
                token,
                locked: amount,
                funded: 0,
                end_date,
                state: State::Pending,
            },
        );
        Ok(())
    }

    /// Moves the guarantee amount from the guarantor into the contract.
    pub fn fund_guarantee(env: Env, id: u64) -> Result<(), Error> {
        let mut guarantee = load(&env, id)?;
        guarantee.guarantor.require_auth();

        if guarantee.state != State::Pending {
            return Err(Error::InvalidState);
        }

        let contract = env.current_contract_address();
        token::Client::new(&env, &guarantee.token).transfer(
            &guarantee.guarantor,
            &contract,
            &guarantee.locked,
        );

        guarantee.funded = guarantee.locked;
        guarantee.state = State::Active;
        save(&env, id, &guarantee);
        Ok(())
    }

    /// Cancels a guarantee that was never funded.
    pub fn cancel_guarantee(env: Env, id: u64, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        let mut guarantee = load(&env, id)?;
        require_party(&guarantee, &caller)?;

        if guarantee.state != State::Pending {
            return Err(Error::InvalidState);
        }

        guarantee.locked = 0;
        guarantee.state = State::Cancelled;
        save(&env, id, &guarantee);
        Ok(())
    }

    /// Proposes (or counter-proposes) a payout out of the locked balance.
    /// The amounts may add up to less than `locked`; the rest stays locked.
    pub fn propose_settlement(
        env: Env,
        id: u64,
        proposer: Address,
        to_guarantor: i128,
        to_landlord: i128,
    ) -> Result<(), Error> {
        proposer.require_auth();
        let guarantee = load(&env, id)?;
        require_party(&guarantee, &proposer)?;

        if guarantee.state != State::Active {
            return Err(Error::InvalidState);
        }
        check_amounts(&guarantee, to_guarantor, to_landlord)?;

        env.storage().persistent().set(
            &DataKey::Settlement(id),
            &Settlement {
                proposer,
                to_guarantor,
                to_landlord,
            },
        );
        extend(&env, &DataKey::Settlement(id));
        Ok(())
    }

    /// The counterparty accepts the open proposal, freezing the payout.
    pub fn accept_settlement(env: Env, id: u64, acceptor: Address) -> Result<(), Error> {
        acceptor.require_auth();
        let guarantee = load(&env, id)?;
        require_party(&guarantee, &acceptor)?;

        if guarantee.state != State::Active {
            return Err(Error::InvalidState);
        }

        let settlement: Settlement = env
            .storage()
            .persistent()
            .get(&DataKey::Settlement(id))
            .ok_or(Error::NoSettlement)?;

        if settlement.proposer == acceptor {
            return Err(Error::CannotAcceptOwnProposal);
        }
        check_amounts(&guarantee, settlement.to_guarantor, settlement.to_landlord)?;

        env.storage()
            .persistent()
            .set(&DataKey::Agreement(id), &settlement);
        extend(&env, &DataKey::Agreement(id));
        env.storage().persistent().remove(&DataKey::Settlement(id));
        Ok(())
    }

    /// Rejects the open proposal without paying anything.
    pub fn reject_settlement(env: Env, id: u64, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        let guarantee = load(&env, id)?;
        require_party(&guarantee, &caller)?;

        if !env.storage().persistent().has(&DataKey::Settlement(id)) {
            return Err(Error::NoSettlement);
        }
        env.storage().persistent().remove(&DataKey::Settlement(id));
        Ok(())
    }

    /// Pays out the agreed amounts. Callable by anyone; the amounts are frozen.
    /// The guarantee closes only when nothing is left locked.
    pub fn execute_settlement(env: Env, id: u64) -> Result<(), Error> {
        let guarantee = load(&env, id)?;

        if guarantee.state != State::Active {
            return Err(Error::InvalidState);
        }

        let agreement: Settlement = env
            .storage()
            .persistent()
            .get(&DataKey::Agreement(id))
            .ok_or(Error::NoAgreement)?;

        check_amounts(&guarantee, agreement.to_guarantor, agreement.to_landlord)?;

        // The agreement is consumed and the balance written down before any
        // transfer, so a re-entrant call cannot pay twice.
        env.storage().persistent().remove(&DataKey::Agreement(id));
        pay_out(
            &env,
            id,
            guarantee,
            agreement.to_guarantor,
            agreement.to_landlord,
        )
    }

    /// The landlord returns part or all of the locked balance to the guarantor.
    /// No acceptance is needed: it can only favour the guarantor.
    pub fn return_to_guarantor(env: Env, id: u64, amount: i128) -> Result<(), Error> {
        let guarantee = load(&env, id)?;
        guarantee.landlord.require_auth();

        if guarantee.state != State::Active {
            return Err(Error::InvalidState);
        }
        check_amounts(&guarantee, amount, 0)?;
        if amount == 0 {
            return Err(Error::InvalidAmount);
        }

        pay_out(&env, id, guarantee, amount, 0)
    }

    /// The guarantor proposes a new end date and/or a new total amount.
    /// An increase is transferred in right away and refunded if the extension
    /// is cancelled or replaced.
    pub fn propose_extension(
        env: Env,
        id: u64,
        new_end_date: u64,
        new_amount: i128,
    ) -> Result<(), Error> {
        let guarantee = load(&env, id)?;
        guarantee.guarantor.require_auth();

        if guarantee.state != State::Active {
            return Err(Error::InvalidState);
        }
        if new_amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        refund_pending_extension(&env, id, &guarantee);

        let top_up = if new_amount > guarantee.locked {
            new_amount - guarantee.locked
        } else {
            0
        };
        if top_up > 0 {
            let contract = env.current_contract_address();
            token::Client::new(&env, &guarantee.token).transfer(
                &guarantee.guarantor,
                &contract,
                &top_up,
            );
        }

        env.storage().persistent().set(
            &DataKey::Extension(id),
            &Extension {
                new_end_date,
                new_amount,
                top_up,
            },
        );
        extend(&env, &DataKey::Extension(id));
        Ok(())
    }

    /// The landlord accepts the extension. A decrease is returned to the
    /// guarantor (minus the fee) as part of the same call.
    pub fn accept_extension(env: Env, id: u64) -> Result<(), Error> {
        let mut guarantee = load(&env, id)?;
        guarantee.landlord.require_auth();

        if guarantee.state != State::Active {
            return Err(Error::InvalidState);
        }

        let extension: Extension = env
            .storage()
            .persistent()
            .get(&DataKey::Extension(id))
            .ok_or(Error::NoExtension)?;

        env.storage().persistent().remove(&DataKey::Extension(id));

        let refund = if extension.new_amount < guarantee.locked {
            guarantee.locked - extension.new_amount
        } else {
            0
        };

        guarantee.end_date = extension.new_end_date;
        guarantee.locked += extension.top_up;
        guarantee.funded += extension.top_up;

        if refund > 0 {
            // `pay_out` writes the guarantee, fee included.
            return pay_out(&env, id, guarantee, refund, 0);
        }
        save(&env, id, &guarantee);
        Ok(())
    }

    /// Withdraws a pending extension and refunds any pre-funded top-up.
    pub fn cancel_extension(env: Env, id: u64, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        let guarantee = load(&env, id)?;
        require_party(&guarantee, &caller)?;

        if !env.storage().persistent().has(&DataKey::Extension(id)) {
            return Err(Error::NoExtension);
        }
        refund_pending_extension(&env, id, &guarantee);
        Ok(())
    }

    pub fn get_guarantee(env: Env, id: u64) -> Result<Guarantee, Error> {
        load(&env, id)
    }

    pub fn get_settlement(env: Env, id: u64) -> Result<Settlement, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Settlement(id))
            .ok_or(Error::NoSettlement)
    }

    pub fn get_agreement(env: Env, id: u64) -> Result<Settlement, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Agreement(id))
            .ok_or(Error::NoAgreement)
    }

    pub fn get_extension(env: Env, id: u64) -> Result<Extension, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Extension(id))
            .ok_or(Error::NoExtension)
    }

    /// Fee charged on `amount` when it is returned to a guarantor.
    pub fn quote_fee(env: Env, amount: i128) -> Result<i128, Error> {
        Ok(fee_for(config(&env)?.fee_bps, amount))
    }
}

/// Writes the balance down first, then transfers: guarantor net of fee,
/// landlord in full, fee to the treasury.
fn pay_out(
    env: &Env,
    id: u64,
    mut guarantee: Guarantee,
    to_guarantor: i128,
    to_landlord: i128,
) -> Result<(), Error> {
    let config = config(env)?;
    let fee = fee_for(config.fee_bps, to_guarantor);
    let net_to_guarantor = to_guarantor - fee;

    guarantee.locked -= to_guarantor + to_landlord;
    if guarantee.locked == 0 && !env.storage().persistent().has(&DataKey::Extension(id)) {
        guarantee.state = State::Closed;
    }
    save(env, id, &guarantee);

    let client = token::Client::new(env, &guarantee.token);
    let contract = env.current_contract_address();
    if net_to_guarantor > 0 {
        client.transfer(&contract, &guarantee.guarantor, &net_to_guarantor);
    }
    if to_landlord > 0 {
        client.transfer(&contract, &guarantee.landlord, &to_landlord);
    }
    if fee > 0 {
        client.transfer(&contract, &config.treasury, &fee);
    }
    Ok(())
}

/// Rounded up to the stroop so the payout never exceeds the locked balance.
fn fee_for(fee_bps: u32, amount: i128) -> i128 {
    if amount <= 0 || fee_bps == 0 {
        return 0;
    }
    let bps = i128::from(fee_bps);
    (amount * bps + BPS_DENOMINATOR - 1) / BPS_DENOMINATOR
}

fn check_amounts(
    guarantee: &Guarantee,
    to_guarantor: i128,
    to_landlord: i128,
) -> Result<(), Error> {
    if to_guarantor < 0 || to_landlord < 0 {
        return Err(Error::InvalidSettlement);
    }
    if to_guarantor + to_landlord > guarantee.locked {
        return Err(Error::ExceedsLocked);
    }
    Ok(())
}

fn refund_pending_extension(env: &Env, id: u64, guarantee: &Guarantee) {
    let Some(pending) = env
        .storage()
        .persistent()
        .get::<DataKey, Extension>(&DataKey::Extension(id))
    else {
        return;
    };
    env.storage().persistent().remove(&DataKey::Extension(id));
    if pending.top_up > 0 {
        token::Client::new(env, &guarantee.token).transfer(
            &env.current_contract_address(),
            &guarantee.guarantor,
            &pending.top_up,
        );
    }
}

fn config(env: &Env) -> Result<Config, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Config)
        .ok_or(Error::NotConfigured)
}

fn load(env: &Env, id: u64) -> Result<Guarantee, Error> {
    let key = DataKey::Guarantee(id);
    let guarantee: Guarantee = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::NotFound)?;
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
    if *caller != guarantee.guarantor && *caller != guarantee.landlord {
        return Err(Error::NotAParty);
    }
    Ok(())
}

fn panic_with_error(env: &Env, error: Error) -> ! {
    soroban_sdk::panic_with_error!(env, error)
}

#[cfg(test)]
mod test;
