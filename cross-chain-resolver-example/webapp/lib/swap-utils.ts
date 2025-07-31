import { ethers } from 'ethers'
import * as Sdk from '@1inch/cross-chain-sdk'
import { uint8ArrayToHex, UINT_40_MAX } from '@1inch/byte-utils'

const { Address } = Sdk

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
  order: Sdk.CrossChainOrder
  signature: string
  fillAmount: string
  injAmount: string
  exchangeRate: number
  message: string
  error?: string
  details?: any
}

// Configuration matching the test setup
export const SWAP_CONFIG = {
  source: {
    chainId: 27270, // BuildBear testnet
    rpcUrl: "https://rpc.buildbear.io/appalling-thepunisher-3e7a9d1c",
    escrowFactory: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    resolver: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
    wrappedNative: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    tokens: {
      USDC: {
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        decimals: 6
      }
    }
  },
  destination: {
    chainId: 'injective-888',
    rpcUrl: 'https://testnet.sentry.lcd.injective.network',
    contractAddress: 'inj1rxrklxvejj93j7zqfpsd8a3c8n2xf4nakuwc6w'
  }
}

// Hardcoded exchange rate: 1000 USDC = 1 INJ
const EXCHANGE_RATE = 1000

/**
 * Create and sign a real CrossChainOrder following the test pattern
 */
export async function createCrossChainOrder(
  userAddress: string,
  fromAmount: string,
  injAmount: string,
  secretBytes: string
): Promise<{ order: Sdk.CrossChainOrder, signature: string, orderHash: string }> {
  if (!window.ethereum) {
    throw new Error('MetaMask not found')
  }

  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  
  // Get current timestamp like in the test
  const currentBlock = await provider.getBlock('latest')
  if (!currentBlock) {
    throw new Error('Could not get current block')
  }
  const srcTimestamp = BigInt(currentBlock.timestamp)

  console.log('Creating CrossChainOrder with parameters:', {
    userAddress,
    fromAmount,
    injAmount,
    secretBytes,
    srcTimestamp: srcTimestamp.toString()
  })

  // Create the order exactly like in the test, but use NetworkEnum for SDK compatibility
  const order = Sdk.CrossChainOrder.new(
    new Address(SWAP_CONFIG.source.escrowFactory),
    {
      salt: Sdk.randBigInt(1000n),
      maker: new Address(userAddress),
      makingAmount: ethers.parseUnits(fromAmount, 6), // USDC amount
      takingAmount: ethers.parseUnits(injAmount, 18), // INJ amount (18 decimals)
      makerAsset: new Address(SWAP_CONFIG.source.tokens.USDC.address),
      takerAsset: new Address(SWAP_CONFIG.source.tokens.USDC.address) // Placeholder for destination token
    },
    {
      hashLock: Sdk.HashLock.forSingleFill(secretBytes),
      timeLocks: Sdk.TimeLocks.new({
        srcWithdrawal: 10n, // 10sec finality lock for test
        srcPublicWithdrawal: 120n, // 2m for private withdrawal
        srcCancellation: 121n, // 1sec public withdrawal
        srcPublicCancellation: 122n, // 1sec private cancellation
        dstWithdrawal: 10n, // 10sec finality lock for test
        dstPublicWithdrawal: 100n, // 100sec private withdrawal
        dstCancellation: 101n // 1sec public withdrawal
      }),
      srcChainId: Sdk.NetworkEnum.ETHEREUM, // Use ETHEREUM NetworkEnum instead of 27270
      dstChainId: Sdk.NetworkEnum.COINBASE, // Placeholder - will use Injective in backend
      srcSafetyDeposit: ethers.parseEther('0.001'),
      dstSafetyDeposit: ethers.parseEther('0.001')
    },
    {
      auction: new Sdk.AuctionDetails({
        initialRateBump: 0,
        points: [],
        duration: 120n,
        startTime: srcTimestamp
      }),
      whitelist: [
        {
          address: new Address(SWAP_CONFIG.source.resolver),
          allowFrom: 0n
        }
      ],
      resolvingStartTime: 0n
    },
    {
      nonce: Sdk.randBigInt(UINT_40_MAX),
      allowPartialFills: false,
      allowMultipleFills: false
    }
  )

  console.log('Created CrossChainOrder:', order)

  // Sign the order like in the test - use real chain ID (27270) for signing
  const realChainId = SWAP_CONFIG.source.chainId // 27270
  const typedData = order.getTypedData(realChainId)
  const signature = await signer.signTypedData(
    typedData.domain,
    { Order: typedData.types[typedData.primaryType] },
    typedData.message
  )

  const orderHash = order.getOrderHash(realChainId)

  console.log('Order signed:', {
    orderHash,
    signature: signature.substring(0, 20) + '...'
  })

  return { order, signature, orderHash }
}

/**
 * Initiate cross-chain swap with real CrossChainOrder
 */
export async function initiateSwap(params: SwapParams): Promise<SwapResponse> {
  try {
    const { fromAmount, userAddress, injectiveAddress } = params
    
    // Calculate INJ amount using hardcoded rate
    const injAmount = (parseFloat(fromAmount) / EXCHANGE_RATE).toFixed(6)
    
    // Generate secret for atomic swap (same as test)
    const secretBytes = uint8ArrayToHex(ethers.randomBytes(32))
    const swapId = `swap-${Date.now()}`

    console.log('Initiating swap with real CrossChainOrder:', {
      swapId,
      fromAmount,
      injAmount,
      userAddress,
      injectiveAddress,
      secretBytes
    })

    // Create and sign the real CrossChainOrder
    const { order, signature, orderHash } = await createCrossChainOrder(
      userAddress,
      fromAmount,
      injAmount,
      secretBytes
    )

    // Call backend to fund destination escrow (like Step 3 in test)
    const response = await fetch('/api/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        swapId,
        order: order.build(), // Serialize the order
        signature,
        orderHash,
        secretBytes,
        fromAmount,
        injAmount,
        userAddress,
        injectiveAddress
      })
    })

    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Swap initiation failed')
    }

    return {
      success: true,
      swapId,
      orderHash,
      secretBytes,
      order, // Return the actual order object
      signature,
      fillAmount: fromAmount,
      injAmount,
      exchangeRate: EXCHANGE_RATE,
      message: 'CrossChainOrder created and destination funded. Ready to deploy source escrow.',
      ...result
    }

  } catch (error) {
    console.error('Error initiating swap:', error)
    throw error
  }
}

/**
 * Deploy source escrow using real resolver contract (like test Step 2)
 */
export async function deploySourceEscrow(
  order: Sdk.CrossChainOrder,
  signature: string,
  fillAmount: string
): Promise<string> {
  if (!window.ethereum) {
    throw new Error('MetaMask not found')
  }

  try {
    console.log('Deploying source escrow with real resolver contract...')
    console.log('Order:', order)
    console.log('Fill amount:', fillAmount)

    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    
    // Create resolver transaction request (following test pattern)
    const resolverAddress = SWAP_CONFIG.source.resolver
    const fillAmountBigInt = ethers.parseUnits(fillAmount, 6)

    // Build taker traits like in the test
    const takerTraits = Sdk.TakerTraits.default()
      .setExtension(order.extension)
      .setAmountMode(Sdk.AmountMode.maker)
      .setAmountThreshold(order.takingAmount)

    // Get immutables like in the test - use real chain ID (27270)
    const realChainId = SWAP_CONFIG.source.chainId // 27270
    const hashLock = order.escrowExtension.hashLockInfo
    const immutables = order.toSrcImmutables(
      realChainId,
      new Address(resolverAddress),
      fillAmountBigInt,
      hashLock
    )

    // Parse signature like in resolver.ts
    const { r, yParityAndS: vs } = ethers.Signature.from(signature)
    const { args, trait } = takerTraits.encode()

    // Create the resolver contract interface based on the test implementation
    const resolverABI = [
      'function deploySrc(bytes calldata immutables, bytes calldata order, bytes32 r, bytes32 vs, uint256 amount, uint256 trait, bytes calldata args) external payable',
      'function deployDst(bytes calldata immutables, uint256 privateCancellation) external payable',
      'function withdraw(address escrow, string calldata secret, bytes calldata immutables) external',
      'function cancel(address escrow, bytes calldata immutables) external'
    ]
    
    const resolverContract = new ethers.Contract(resolverAddress, resolverABI, signer)

    console.log('Calling resolver.deploySrc with parameters:', {
      immutables: immutables.build(),
      order: order.build(),
      r,
      vs,
      amount: fillAmountBigInt.toString(),
      trait,
      args,
      value: order.escrowExtension.srcSafetyDeposit.toString()
    })

    // Call deploySrc on resolver contract (like in test)
    const tx = await resolverContract.deploySrc(
      immutables.build(),
      order.build(),
      r,
      vs,
      fillAmountBigInt,
      trait,
      args,
      {
        value: order.escrowExtension.srcSafetyDeposit,
        gasLimit: 10_000_000
      }
    )

    console.log('Source escrow deployment transaction sent:', tx.hash)
    
    const receipt = await tx.wait()
    console.log('Source escrow deployed successfully:', receipt.hash)
    
    return receipt.hash

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

// Window types are declared in types/window.d.ts 