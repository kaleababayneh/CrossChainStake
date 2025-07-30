// Chain configurations for easy extensibility
export interface ChainConfig {
  chainId: string
  rpc: string
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

export const COSMOS_CHAINS: Record<string, ChainConfig> = {
  injective: {
    chainId: 'injective-1',
    rpc: 'https://injective-rpc.polkachu.com',
    prefix: 'inj',
    denom: 'inj',
    decimals: 18,
    name: 'Injective Protocol',
    symbol: 'INJ',
    explorer: 'https://explorer.injective.network'
  },
  cosmos: {
    chainId: 'cosmoshub-4',
    rpc: 'https://cosmos-rpc.polkachu.com',
    prefix: 'cosmos',
    denom: 'uatom',
    decimals: 6,
    name: 'Cosmos Hub',
    symbol: 'ATOM',
    explorer: 'https://mintscan.io/cosmos'
  },
  osmosis: {
    chainId: 'osmosis-1',
    rpc: 'https://osmosis-rpc.polkachu.com',
    prefix: 'osmo',
    denom: 'uosmo',
    decimals: 6,
    name: 'Osmosis',
    symbol: 'OSMO',
    explorer: 'https://mintscan.io/osmosis'
  },
  juno: {
    chainId: 'juno-1',
    rpc: 'https://juno-rpc.polkachu.com',
    prefix: 'juno',
    denom: 'ujuno',
    decimals: 6,
    name: 'Juno',
    symbol: 'JUNO',
    explorer: 'https://mintscan.io/juno'
  },
  stargaze: {
    chainId: 'stargaze-1',
    rpc: 'https://stargaze-rpc.polkachu.com',
    prefix: 'stars',
    denom: 'ustars',
    decimals: 6,
    name: 'Stargaze',
    symbol: 'STARS',
    explorer: 'https://mintscan.io/stargaze'
  },
  terra: {
    chainId: 'phoenix-1',
    rpc: 'https://terra-rpc.polkachu.com',
    prefix: 'terra',
    denom: 'uluna',
    decimals: 6,
    name: 'Terra',
    symbol: 'LUNA',
    explorer: 'https://finder.terra.money'
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