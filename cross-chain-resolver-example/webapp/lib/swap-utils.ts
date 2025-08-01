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
  destinationFundingTx?: string // Injective funding transaction
  sourceDeploymentTx?: string // BuildBear escrow deployment  
  userClaimTx?: string // Injective claim transaction
  resolverWithdrawalTx?: string // BuildBear resolver withdrawal
  error?: string
  details?: any
}

// Configuration matching the test setup
export const SWAP_CONFIG = {
  source: {
    chainId: 27270, // BuildBear testnet
    rpcUrl: "https://rpc.buildbear.io/appalling-thepunisher-3e7a9d1c",
    escrowFactory: "0x3A686A56071445Bc36d432C9332eBDcae3F6dC4D", // From test deployment
    resolver: "0xB9c80Fd36A0ea0AD844538934ac7384aC0f46659", // From test deployment
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

    // Important: The API returns a plain object for `order`. We must use the
    // original `order` object which is an instance of `Sdk.CrossChainOrder`
    // and has all the necessary methods. `...result` would overwrite it.
    const { order: _, ...restResult } = result

    return {
      success: true,
      swapId,
      orderHash,
      secretBytes,
      order, // Return the original class instance
      signature,
      fillAmount: fromAmount,
      injAmount,
      exchangeRate: EXCHANGE_RATE,
      message: 'CrossChainOrder created and destination funded. Ready to deploy source escrow.',
      ...restResult
    }

  } catch (error) {
    console.error('Error initiating swap:', error)
    throw error
  }
}

export async function deploySourceEscrow(
  order: Sdk.CrossChainOrder,
  signature: string,
  fillAmount: string
): Promise<{
  txHash: string;
  escrowAddress: string;
  immutablesBuilt: any[];
  secretBytes: string;
  blockNumber?: number;
  gasUsed?: string;
}> {
  if (!window.ethereum) {
    throw new Error('MetaMask not found')
  }

  try {
    console.log('Setting up USDC approval for resolver to execute deploySrc...')
    console.log('Fill amount:', fillAmount)

    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const userAddress = await signer.getAddress()
    
    const fillAmountBigInt = ethers.parseUnits(fillAmount, 6)

    // ERC20 ABI for USDC approval
    const ERC20_ABI = [
      'function approve(address spender, uint256 amount) external returns (bool)',
      'function allowance(address owner, address spender) external view returns (uint256)',
      'function balanceOf(address account) external view returns (uint256)'
    ]

    const usdcContract = new ethers.Contract(
      SWAP_CONFIG.source.tokens.USDC.address,
      ERC20_ABI,
      signer
    )

    // Check current allowance to LimitOrderProtocol (not resolver directly)
    const limitOrderProtocol = SWAP_CONFIG.source.limitOrderProtocol
    const currentAllowance = await usdcContract.allowance(userAddress, limitOrderProtocol)
    
    console.log('Current USDC allowance to LimitOrderProtocol:', ethers.formatUnits(currentAllowance, 6))
    console.log('Required amount:', ethers.formatUnits(fillAmountBigInt, 6))

    // Approve USDC to LimitOrderProtocol if needed (like in test)
    if (currentAllowance < fillAmountBigInt) {
      console.log('Approving USDC to LimitOrderProtocol for resolver to use...')
      const approveTx = await usdcContract.approve(limitOrderProtocol, ethers.MaxUint256) // Approve max
      const receipt = await approveTx.wait()
      console.log('USDC approval confirmed:', receipt.hash)
    }

    // Now call the API for resolver to execute deploySrc
    console.log('Requesting resolver to execute deploySrc transaction...')
    const deployResponse = await fetch('/api/deploy-source', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderData: order.build(),
        signature,
        fillAmount,
        userAddress,
        extensionData: order.extension.encode(),
        safetyDeposit: order.escrowExtension.srcSafetyDeposit.toString(),
        takingAmount: order.takingAmount.toString(),
        // ✅ Generate real SDK immutables (matching main.spec.ts)
        immutables: (() => {
          try {
            const immutables = order.toSrcImmutables(
              SWAP_CONFIG.source.chainId, // Use actual chainId from config
              new Sdk.Address(SWAP_CONFIG.source.resolver),
              fillAmountBigInt,
              order.escrowExtension.hashLockInfo // Add the missing hashLock parameter!
            )
            console.log('✅ Generated immutables:', immutables.build())
            return immutables.build()
          } catch (error) {
            console.error('❌ Error generating immutables:', error)
            throw new Error('Failed to generate immutables: ' + (error instanceof Error ? error.message : String(error)))
          }
        })(),
        // ✅ Generate real taker traits (matching main.spec.ts)
        takerTraits: (() => {
          try {
            const takerTraits = Sdk.TakerTraits.default()
              .setExtension(order.extension)
              .setAmountMode(Sdk.AmountMode.maker)
              .setAmountThreshold(order.takingAmount)
            const {args, trait} = takerTraits.encode()
            console.log('✅ Generated taker traits:', { value: trait.toString(), args })
            return {
              value: trait.toString(),
              args: args
            }
          } catch (error) {
            console.error('❌ Error generating taker traits:', error)
            throw new Error('Failed to generate taker traits: ' + (error instanceof Error ? error.message : String(error)))
          }
        })()
      })
    })

    const deployResult = await deployResponse.json()
    
    if (!deployResponse.ok) {
      throw new Error(deployResult.error || 'Resolver deployment failed')
    }

    console.log('Resolver executed deploySrc:', deployResult.txHash)
    return deployResult
    
  } catch (error) {
    console.error('Error setting up source escrow deployment:', error)
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