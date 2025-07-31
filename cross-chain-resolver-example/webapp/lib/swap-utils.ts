import { ethers } from 'ethers'

export interface SwapParams {
  fromAmount: string
  userAddress: string
  injectiveAddress: string
  fromToken?: string
  toToken?: string
}

export interface SwapResponse {
  success: boolean
  swapId: string
  orderHash: string
  secretBytes: string
  order: {
    makingAmount: string
    takingAmount: string
    maker: string
    makerAsset: string
    takerAsset: string
  }
  injectiveContract: string
  injAmount: string
  exchangeRate: number
  message: string
  error?: string
  details?: any
}

// Configuration for cross-chain swap
export const SWAP_CONFIG = {
  source: {
    chainId: 27270,
    rpcUrl: "https://rpc.buildbear.io/appalling-thepunisher-3e7a9d1c",
    escrowFactory: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    resolver: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    tokens: {
      USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    }
  }
}

/**
 * Initiate cross-chain swap by calling the API
 */
export async function initiateSwap(params: SwapParams): Promise<SwapResponse> {
  try {
    const response = await fetch('/api/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    })

    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Swap initiation failed')
    }

    return result
  } catch (error) {
    console.error('Error initiating swap:', error)
    throw error
  }
}

/**
 * Deploy source escrow on EVM using MetaMask
 */
export async function deploySourceEscrow(
  orderHash: string,
  order: any,
  signature: string,
  fillAmount: string
): Promise<string> {
  if (!window.ethereum) {
    throw new Error('MetaMask not found')
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    
    console.log('Deploying source escrow for order:', orderHash)
    console.log('Order details:', order)
    
    // For demo purposes, we'll send a transaction to the resolver address
    // In a real implementation, this would call the actual escrow deployment method
    const tx = await signer.sendTransaction({
      to: SWAP_CONFIG.source.resolver,
      value: ethers.parseEther('0.001'), // Safety deposit
      data: '0x', // This would be the encoded function call
    })

    console.log('Transaction sent:', tx.hash)
    const receipt = await tx.wait()
    console.log('Transaction confirmed:', receipt)
    
    return receipt?.hash || tx.hash
    
  } catch (error) {
    console.error('Error deploying source escrow:', error)
    throw error
  }
}

/**
 * Release funds on Injective (resolver releases to user's Keplr address)
 */
export async function claimInjectiveFunds(
  swapId: string,
  secretBytes: string,
  injectiveAddress: string,
  contractAddress: string
): Promise<string> {
  try {
    console.log('Requesting resolver to release funds to user on Injective...')
    console.log('Swap ID:', swapId)
    console.log('Secret:', secretBytes)
    console.log('Recipient Address (Keplr):', injectiveAddress)
    console.log('Contract:', contractAddress)

    // Call the API to have the resolver claim the funds
    const response = await fetch('/api/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        swapId,
        secretBytes,
        recipientAddress: injectiveAddress,
        contractAddress
      })
    })

    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Claim request failed')
    }

    console.log('Claim transaction result:', result)
    return result.txHash

  } catch (error) {
    console.error('Error claiming Injective funds:', error)
    throw error
  }
}

/**
 * Get swap status and progress
 */
export interface SwapStatus {
  step: 'initiated' | 'source_deployed' | 'destination_funded' | 'claimed' | 'completed' | 'failed'
  message: string
  txHashes: {
    initiation?: string
    sourceEscrow?: string
    destinationFunding?: string
    claim?: string
    withdrawal?: string
  }
}

export function getSwapStatus(
  hasInitiated: boolean,
  sourceEscrowTx?: string,
  destinationFundingTx?: string,
  claimTx?: string,
  withdrawalTx?: string
): SwapStatus {
  if (withdrawalTx) {
    return {
      step: 'completed',
      message: 'Cross-chain swap completed successfully!',
      txHashes: { sourceEscrow: sourceEscrowTx, destinationFunding: destinationFundingTx, claim: claimTx, withdrawal: withdrawalTx }
    }
  }
  
  if (claimTx) {
    return {
      step: 'claimed',
      message: 'Funds claimed on Injective. Waiting for resolver withdrawal...',
      txHashes: { sourceEscrow: sourceEscrowTx, destinationFunding: destinationFundingTx, claim: claimTx }
    }
  }
  
  if (destinationFundingTx && sourceEscrowTx) {
    return {
      step: 'destination_funded',
      message: 'Both escrows funded. You can now claim your funds on Injective.',
      txHashes: { sourceEscrow: sourceEscrowTx, destinationFunding: destinationFundingTx }
    }
  }
  
  if (sourceEscrowTx) {
    return {
      step: 'source_deployed',
      message: 'Source escrow deployed. Waiting for destination funding...',
      txHashes: { sourceEscrow: sourceEscrowTx }
    }
  }
  
  if (hasInitiated) {
    return {
      step: 'initiated',
      message: 'Swap initiated. Please deploy source escrow with MetaMask.',
      txHashes: {}
    }
  }
  
  return {
    step: 'failed',
    message: 'Swap not initiated',
    txHashes: {}
  }
}

// Type declarations for window objects
declare global {
  interface Window {
    ethereum?: any
    keplr?: any
  }
} 