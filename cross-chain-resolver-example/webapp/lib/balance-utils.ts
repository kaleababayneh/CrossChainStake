import { ethers } from 'ethers'
import { createProtobufRpcClient, QueryClient } from '@cosmjs/stargate'
import { Tendermint34Client } from '@cosmjs/tendermint-rpc'
import { QueryClientImpl } from 'cosmjs-types/cosmos/bank/v1beta1/query'
import { COSMOS_CHAINS, CosmosChain, ETHEREUM_NETWORKS } from './chain-configs'

// USDC contract address on Ethereum mainnet
const USDC_CONTRACT_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

// ERC20 ABI for balanceOf function
const ERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)'
]

/**
 * Fetch USDC balance from Ethereum network
 */
export async function fetchUSDCBalance(address: string): Promise<string> {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed')
    }

    const provider = new ethers.BrowserProvider(window.ethereum)
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, provider)
    
    const balance = await usdcContract.balanceOf(address)
    const decimals = await usdcContract.decimals()
    
    // Convert from wei to human readable format
    const formattedBalance = ethers.formatUnits(balance, decimals)
    
    // Return formatted balance with max 6 decimal places
    return parseFloat(formattedBalance).toFixed(6)
  } catch (error) {
    console.error('Error fetching USDC balance:', error)
    return '0.000000'
  }
}

/**
 * Fetch balance from any Cosmos chain using CosmJS
 */
export async function fetchCosmosBalance(
  address: string,
  chain: CosmosChain = 'injective'
): Promise<string> {
  try {
    const chainConfig = COSMOS_CHAINS[chain]
    
    // Connect to Tendermint RPC
    const tendermint = await Tendermint34Client.connect(chainConfig.rpc)
    const queryClient = new QueryClient(tendermint)
    const rpcClient = createProtobufRpcClient(queryClient)
    const bankQueryService = new QueryClientImpl(rpcClient)

    // Query balance
    const { balance } = await bankQueryService.Balance({
      address,
      denom: chainConfig.denom,
    })

    if (!balance || !balance.amount) {
      return '0.000000'
    }

    // Convert from atomic units to human readable format
    const formattedBalance = (Number(balance.amount) / Math.pow(10, chainConfig.decimals)).toFixed(6)
    
    // Clean up the connection
    tendermint.disconnect()
    
    return formattedBalance
  } catch (error) {
    console.error(`Error fetching ${chain} balance:`, error)
    return '0.000000'
  }
}

/**
 * Fetch INJ balance from Injective network (backward compatibility)
 */
export async function fetchINJBalance(address: string): Promise<string> {
  return await fetchCosmosBalance(address, 'injective')
}

/**
 * Get the network details for current MetaMask connection
 */
export async function getNetworkInfo(): Promise<{ chainId: string; isSupported: boolean }> {
  try {
    if (!window.ethereum) {
      return { chainId: '0', isSupported: false }
    }

    const provider = new ethers.BrowserProvider(window.ethereum)
    const network = await provider.getNetwork()
    const chainId = network.chainId.toString()
    
    // Support Ethereum mainnet (1) and common testnets
    const supportedChainIds = ['1', '5', '11155111', '27270'] // mainnet, goerli, sepolia, custom testnet
    const isSupported = supportedChainIds.includes(chainId)
    
    return { chainId, isSupported }
  } catch (error) {
    console.error('Error getting network info:', error)
    return { chainId: '0', isSupported: false }
  }
}

/**
 * Format balance for display
 */
export function formatBalance(balance: string, symbol: string): string {
  const num = parseFloat(balance)
  if (num === 0) return `0.000000 ${symbol}`
  if (num < 0.000001) return `< 0.000001 ${symbol}`
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M ${symbol}`
  if (num >= 1000) return `${(num / 1000).toFixed(3)}K ${symbol}`
  return `${num.toFixed(6)} ${symbol}`
}

/**
 * Get token balance based on token symbol and wallet address
 */
export async function getTokenBalance(
  tokenSymbol: string, 
  address: string, 
  network: 'ethereum' | CosmosChain
): Promise<string> {
  if (network === 'ethereum' && tokenSymbol === 'USDC') {
    return await fetchUSDCBalance(address)
  } else if (network !== 'ethereum') {
    // It's a Cosmos chain
    const chainConfig = COSMOS_CHAINS[network as CosmosChain]
    if (chainConfig) {
      return await fetchCosmosBalance(address, network as CosmosChain)
    } else {
      console.warn(`Unsupported Cosmos chain: ${network}`)
      return '0.000000'
    }
  } else {
    console.warn(`Unsupported token: ${tokenSymbol} on ${network}`)
    return '0.000000'
  }
}

// Re-export chain configuration utilities for convenience
export { 
  getAllCosmosChains as getSupportedCosmosChains,
  getCosmosChainConfig as getChainConfig,
  COSMOS_CHAINS,
  type CosmosChain
} from './chain-configs'

 