// Chain configurations for easy extensibility
export interface ChainConfig {
  chainId: string
  rpc: string // LCD REST API endpoint (not RPC)
  prefix: string
  denom: string
  decimals: number
  name: string
  explorer?: string
  symbol: string
}

export const ETHEREUM_NETWORKS = {
  mainnet: {
    chainId: '1',
    name: 'Ethereum Mainnet',
    rpc: 'https://ethereum.blockpi.network/v1/rpc/public',
    symbol: 'ETH',
    explorer: 'https://etherscan.io'
  },
  sepolia: {
    chainId: '11155111',
    name: 'Ethereum Sepolia',
    rpc: 'https://ethereum-sepolia.blockpi.network/v1/rpc/public',
    symbol: 'ETH',
    explorer: 'https://sepolia.etherscan.io'
  }
} as const

// Cosmos chain configurations using LCD REST API endpoints
// Note: 'rpc' field actually contains LCD REST endpoint URLs, not RPC endpoints
// LCD endpoints follow format: https://lcd.example.com (without /26657 suffix)
export const COSMOS_CHAINS: Record<string, ChainConfig> = {
  injective: {
    chainId: 'injective-888',
    rpc: 'https://testnet.sentry.lcd.injective.network',
    prefix: 'inj',
    denom: 'inj',
    decimals: 18,
    name: 'Injective Protocol',
    symbol: 'INJ',
    explorer: 'https://explorer.injective.network'
  },
  // neutron testnet
  netron: {
   chainId: 'pion-1',
   rpc: 'https://neutron-testnet-rpc.polkachu.com',
   prefix: 'neutron',
   denom: 'untrn',
   decimals: 6,
   name: 'Neutron Protocol',
   symbol: 'NTRN',
   }
}

export type CosmosChain = keyof typeof COSMOS_CHAINS
export type EthereumNetwork = keyof typeof ETHEREUM_NETWORKS

// Helper functions
export function getCosmosChainConfig(chain: CosmosChain): ChainConfig {
  return COSMOS_CHAINS[chain]
}

export function getAllCosmosChains(): Array<{
  key: CosmosChain;
  config: ChainConfig;
}> {
  return Object.entries(COSMOS_CHAINS).map(([key, config]) => ({
    key: key as CosmosChain,
    config,
  }))
}

export function getEthereumNetworkConfig(network: EthereumNetwork) {
  return ETHEREUM_NETWORKS[network]
} 