/**
 * Examples of how to use the new CosmJS-based balance fetching
 * This demonstrates the multi-chain capabilities
 */

import { 
  fetchCosmosBalance, 
  fetchUSDCBalance, 
  getSupportedCosmosChains, 
  getChainConfig,
  type CosmosChain 
} from './balance-utils'

// Example 1: Fetch INJ balance (Injective)
export async function getInjectiveBalance(address: string) {
  return await fetchCosmosBalance(address, 'injective')
}

// Example 2: Fetch ATOM balance (Cosmos Hub)
export async function getCosmosHubBalance(address: string) {
  return await fetchCosmosBalance(address, 'cosmos')
}

// Example 3: Fetch OSMO balance (Osmosis)
export async function getOsmosisBalance(address: string) {
  return await fetchCosmosBalance(address, 'osmosis')
}

// Example 4: Fetch balance from any supported chain
export async function getBalanceFromChain(address: string, chain: CosmosChain) {
  const config = getChainConfig(chain)
  console.log(`Fetching ${config.symbol} balance from ${config.name}...`)
  return await fetchCosmosBalance(address, chain)
}

// Example 5: Get balances from multiple chains
export async function getMultiChainBalances(address: string) {
  const supportedChains = getSupportedCosmosChains()
  const balances: Record<string, string> = {}
  
  for (const { key, config } of supportedChains) {
    try {
      const balance = await fetchCosmosBalance(address, key)
      balances[config.symbol] = balance
      console.log(`${config.symbol}: ${balance}`)
    } catch (error) {
      console.error(`Failed to fetch ${config.symbol} balance:`, error)
      balances[config.symbol] = '0.000000'
    }
  }
  
  return balances
}

// Example 6: Complete portfolio balance (Ethereum + Cosmos chains)
export async function getCompletePortfolio(ethAddress: string, cosmosAddress: string) {
  const portfolio: Record<string, string> = {}
  
  // Fetch USDC from Ethereum
  try {
    portfolio.USDC = await fetchUSDCBalance(ethAddress)
  } catch (error) {
    console.error('Failed to fetch USDC balance:', error)
    portfolio.USDC = '0.000000'
  }
  
  // Fetch balances from all Cosmos chains
  const cosmosBalances = await getMultiChainBalances(cosmosAddress)
  
  return { ...portfolio, ...cosmosBalances }
}

// Example usage:
/*
const injectiveAddress = 'inj1...'
const ethereumAddress = '0x...'

// Single chain balance
const injBalance = await getInjectiveBalance(injectiveAddress)
console.log('INJ Balance:', injBalance)

// Multi-chain portfolio
const portfolio = await getCompletePortfolio(ethereumAddress, injectiveAddress)
console.log('Complete Portfolio:', portfolio)
*/ 