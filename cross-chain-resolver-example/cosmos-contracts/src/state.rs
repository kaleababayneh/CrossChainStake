use cosmwasm_schema::cw_serde;

use cosmwasm_std::{Addr, Binary, BlockInfo, Order, StdResult, Storage};
use cw_storage_plus::{Bound, Map};

use cw20::{Balance, Expiration};

#[cw_serde]
pub struct AtomicSwap {
    /// This is the sha-256 hash of the preimage
    pub hash: Binary,
    pub recipient: Addr,
    pub source: Addr,
    pub expires: Expiration,
    /// Balance in native tokens, or cw20 token
    pub balance: Balance,
}

impl AtomicSwap {
    pub fn is_expired(&self, block: &BlockInfo) -> bool {
        self.expires.is_expired(block)
    }
}

pub const SWAPS: Map<&str, AtomicSwap> = Map::new("atomic_swap");

/// This returns the list of ids for all active swaps
pub fn all_swap_ids<'a>(
    storage: &dyn Storage,
    start: Option<Bound<'a, &'a str>>,
    limit: usize,
) -> StdResult<Vec<String>> {
    SWAPS
        .keys(storage, start, None, Order::Ascending)
        .take(limit)
        .collect()
}
