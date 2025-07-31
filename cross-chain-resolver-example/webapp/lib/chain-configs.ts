// Chain configurations for cross-chain swap
export const CHAIN_CONFIGS = {
  ethereum: {
    chainId: 27270, // BuildBear testnet - matching test config
    name: 'BuildBear Testnet',
    rpcUrl: 'https://rpc.buildbear.io/appalling-thepunisher-3e7a9d1c',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    blockExplorer: 'https://explorer.buildbear.io/appalling-thepunisher-3e7a9d1c',
    tokens: {
      USDC: {
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin'
      }
    },
    contracts: {
      escrowFactory: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      resolver: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65'
    }
  }
} as const

export const COSMOS_CHAINS = {
  injective: {
    chainId: 'injective-888',
    name: 'Injective Testnet',
    rpc: 'https://testnet.sentry.lcd.injective.network',
    grpc: 'https://testnet.sentry.chain.grpc.injective.network',
    denom: 'inj',
    decimals: 18,
    symbol: 'INJ',
    blockExplorer: 'https://testnet.explorer.injective.network',
    gasPrice: '500000000'
  }
} as const

export type CosmosChain = keyof typeof COSMOS_CHAINS

export function getAllCosmosChains(): CosmosChain[] {
  return Object.keys(COSMOS_CHAINS) as CosmosChain[]
}

export function getCosmosChainConfig(chain: CosmosChain) {
  return COSMOS_CHAINS[chain]
}

// Network detection helper
export async function detectNetwork() {
  if (!window.ethereum) {
    throw new Error('MetaMask not found')
  }

  const chainId = await window.ethereum.request({ method: 'eth_chainId' })
  const chainIdDecimal = parseInt(chainId, 16)
  
  return {
    chainId: chainIdDecimal,
    isSupported: chainIdDecimal === CHAIN_CONFIGS.ethereum.chainId,
    isCorrectNetwork: chainIdDecimal === CHAIN_CONFIGS.ethereum.chainId
  }
}

// Add BuildBear testnet to MetaMask
export async function addBuildBearNetwork() {
  if (!window.ethereum) {
    throw new Error('MetaMask not found')
  }

  const chainParams = {
    chainId: `0x${CHAIN_CONFIGS.ethereum.chainId.toString(16)}`, // Convert to hex
    chainName: CHAIN_CONFIGS.ethereum.name,
    nativeCurrency: CHAIN_CONFIGS.ethereum.nativeCurrency,
    rpcUrls: [CHAIN_CONFIGS.ethereum.rpcUrl],
    blockExplorerUrls: [CHAIN_CONFIGS.ethereum.blockExplorer]
  }

  try {
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [chainParams]
    })
  } catch (error) {
    console.error('Failed to add BuildBear network:', error)
    throw error
  }
}

// Switch to BuildBear testnet
export async function switchToBuildBearNetwork() {
  if (!window.ethereum) {
    throw new Error('MetaMask not found')
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${CHAIN_CONFIGS.ethereum.chainId.toString(16)}` }]
    })
  } catch (error: any) {
    // This error code indicates that the chain has not been added to MetaMask
    if (error.code === 4902) {
      await addBuildBearNetwork()
    } else {
      throw error
    }
  }
}

 