import { AbiCoder, ethers,randomBytes } from 'ethers'
import * as Sdk from '@1inch/cross-chain-sdk'
import { uint8ArrayToHex, UINT_40_MAX } from '@1inch/byte-utils'
import { createHash } from 'crypto'
import { Resolver } from './resolver'
import { parseUnits, parseEther, MaxUint256 } from 'ethers'
import factoryContract from "./TestEscrowFactory.json"
import resolverContractAbi from "./Resolver.json"
import {EscrowFactory} from './escrow-factory'

const coder = AbiCoder.defaultAbiCoder()
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
  order: any
  signature: string
  injectiveContract: string
  injAmount: string
  exchangeRate: number
  message: string
  srcEscrowTx?: string
  dstFundingTx?: string
  claimTx?: string
  withdrawTx?: string
}



// Configuration matching the test spec exactly
export const SWAP_CONFIG = {
  source: {
    chainId: 27270,
    rpcUrl: "https://rpc.buildbear.io/appalling-thepunisher-3e7a9d1c",
    limitOrderProtocol: "0x111111125421ca6dc452d289314280a0f8842a65",
    wrappedNative: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    tokens: {
      USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    }
  },
  destination: {
    chainId: 'injective-888',
    rpcUrl: 'https://testnet.sentry.lcd.injective.network',
    contractAddress: 'inj1rxrklxvejj93j7zqfpsd8a3c8n2xf4nakuwc6w'
  }
}

// Resolver private key from test
const resolverMnemonic = "soda giggle lobster frown sponsor bridge follow firm fashion buddy final this crawl junior burst race differ school pupil bleak above economy toy chunk"
const resolverPk = '0x0a8453b8a66dc0e4cf0afcea4b961b6bcd4bd2d4d378c7512f8eb3a7aea255b3'
const ownerPrivateKey = '0x3897c33f920e4594c9321f78208b8cf1646f45fd807a78ef0985cc607eea4f51'

/**
 * Complete cross-chain swap implementation matching the test spec exactly
 */
async function deploy(
  json: {abi: any; bytecode: any},
  params: unknown[],
  provider: ethers.JsonRpcProvider,
  deployer: ethers.Wallet
): Promise<string> {
  const deployed = await new ethers.ContractFactory(json.abi, json.bytecode, deployer).deploy(...params)
  await deployed.waitForDeployment()

  return await deployed.getAddress()
}

async function getOrDeployContracts(provider: ethers.JsonRpcProvider) {
  
  console.log('🚀 Deploying contracts dynamically (like test)...')
  console.log('Deploying EscrowFactory...')

  const deployer = new ethers.Wallet(ownerPrivateKey, provider)

  const escrowFactory = await deploy(
    factoryContract,
    [
        SWAP_CONFIG.source.limitOrderProtocol,
        SWAP_CONFIG.source.wrappedNative, // feeToken,
        Sdk.Address.fromBigInt(BigInt(0)).toString(), // accessToken,
        deployer.address, // owner
        60 * 30, // src rescue delay
        60 * 30 // dst rescue delay
    ],
    provider,
    deployer
)
 console.log(`[${SWAP_CONFIG.source.chainId}]`, `Escrow factory contract deployed to`, escrowFactory)

  
    const resolver = await deploy(
    resolverContractAbi,
    [
        escrowFactory,
        SWAP_CONFIG.source.limitOrderProtocol,
        ethers.computeAddress(resolverPk) // resolver as owner of contract
    ],
    provider,
    deployer
  )
    console.log(`[${SWAP_CONFIG.source.chainId}]`, `Resolver contract deployed to`, resolver)

      


  return { escrowFactory,  resolver }
}
export async function executeCrossChainSwap(
  fromAmount: string,
  userAddress: string,
  injectiveAddress: string
): Promise<any> {

  console.log('🚀 STARTING COMPLETE CROSS-CHAIN SWAP')
  console.log('userAddress', userAddress)


  const Rprovider = new ethers.JsonRpcProvider(SWAP_CONFIG.source.rpcUrl, SWAP_CONFIG.source.chainId, {
                cacheTimeout: -1,
                staticNetwork: true
    })
        
  
  const { escrowFactory, resolver } = await getOrDeployContracts(Rprovider)

  const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
  const signer = await provider.getSigner()
    

  const ResolverWallet = new ethers.Wallet(resolverPk, Rprovider);

  const srcFactory = new EscrowFactory(Rprovider, escrowFactory);

  
  // Check current user USDC balance
  const usdcContract = new ethers.Contract(SWAP_CONFIG.source.tokens.USDC, [
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)'
  ], signer)
  


  const approveToken = await signer.sendTransaction({
            to: SWAP_CONFIG.source.tokens.USDC,
            data: '0x095ea7b3' + coder.encode(['address', 'uint256'], [SWAP_CONFIG.source.limitOrderProtocol, MaxUint256]).slice(2)
    })

  await approveToken.wait()
  console.log('✅ USDC approved for limit order protocol')


  const srcResolverContract = new ethers.Contract(
    resolver,
    resolverContractAbi.abi,
    ResolverWallet
)



  // Step 1: Generate swap parameters (matching test spec exactly)
  const swapId = `swap-${Date.now()}`
  
   const secret = uint8ArrayToHex(randomBytes(32)) 

  console.log('🔧 TEST SETUP:')

  console.log('Secret hash:', secret)
  const srcTimestamp = BigInt((await Rprovider.getBlock('latest'))!.timestamp)

  // Step 2: Create cross-chain order using 1inch SDK (exactly like test)
  const order = Sdk.CrossChainOrder.new(
    new Address(escrowFactory),
    {
      salt: Sdk.randBigInt(BigInt(1000)),
      maker: new Address(userAddress),
      makingAmount: ethers.parseUnits('1', 6),
      takingAmount: ethers.parseUnits('1', 6),
      makerAsset: new Address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"), // USDC
      takerAsset: new Address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48") // USDC
    },
    {
      hashLock: Sdk.HashLock.forSingleFill(secret),
      timeLocks: Sdk.TimeLocks.new({
            srcWithdrawal: BigInt(10), // 10sec finality lock for test
            srcPublicWithdrawal: BigInt(120), // 2m for private withdrawal
            srcCancellation: BigInt(121), // 1sec public withdrawal
            srcPublicCancellation: BigInt(122), // 1sec private cancellation
            dstWithdrawal: BigInt(10), // 10sec finality lock for test
            dstPublicWithdrawal: BigInt(100), // 100sec private withdrawal
            dstCancellation: BigInt(101) // 1sec public withdrawal
       }),
      srcChainId: Sdk.NetworkEnum.ETHEREUM,
      dstChainId: Sdk.NetworkEnum.COINBASE, // temporary, should add aptos to supported chains
      srcSafetyDeposit: ethers.parseEther('0.001'),
      dstSafetyDeposit: ethers.parseEther('0.001')
    },
    {
      auction: new Sdk.AuctionDetails({
        initialRateBump: 0,
        points: [],
        duration: BigInt(120),
        startTime: srcTimestamp
      }),
      whitelist: [
        {
          address: new Address(resolver),
          allowFrom: BigInt(0)
        }
      ],
      resolvingStartTime: BigInt(0)
    },
    {
      nonce: Sdk.randBigInt(UINT_40_MAX),
      allowPartialFills: false,
      allowMultipleFills: false
    }
  )

  

  console.log('📋 ORDER CREATED:')
  console.log('order', order)

        
  // Step 3: Sign the order (user signs with MetaMask)
  const realChainId = SWAP_CONFIG.source.chainId // 27270
  const typedData = order.getTypedData(realChainId)


  const signature = await signer.signTypedData(
    typedData.domain,
    { Order: typedData.types[typedData.primaryType] },
    typedData.message
  )
  // Create the order hash for signing
  const orderHash = order.getOrderHash(SWAP_CONFIG.source.chainId)
  

  console.log('✍️ ORDER SIGNED:')
  console.log('Signature:', signature)
  console.log('Order hash:', orderHash)
  const DST_RESOLVER = "inj1rfhgjga07nkn5kmw7macwathepxew3rfndtw45"
  const resolverContract = new Resolver(resolver, DST_RESOLVER)

  const fillAmount = order.makingAmount
console.log('💰 FILL AMOUNT:', fillAmount.toString())
console.log('Resolver contract address:', resolverContract)





const tx = resolverContract.deploySrc(
                    SWAP_CONFIG.source.chainId,
                    order,
                    signature,
                    Sdk.TakerTraits.default()
                        .setExtension(order.extension)
                        .setAmountMode(Sdk.AmountMode.maker)
                        .setAmountThreshold(order.takingAmount),
                    fillAmount
                )

const Ftx = {
            ...tx,
            gasLimit: 10_000_000,
            
        }

console.log('📤 DEPLOY TX REQUEST:')
console.log('To:', Ftx.to)
console.log('Value:', Ftx.value?.toString())
console.log('Data:', Ftx.data)
console.log('Data length:', Ftx.data?.length)
console.log('Data is empty?', !Ftx.data || Ftx.data === '0x')

 const res = await ResolverWallet.sendTransaction(
   Ftx
)

 const receipt = await res.wait(1)
 console.log('✅ Transaction sent successfully!', receipt)
//   console.log('💰 FILL PARAMETERS:')
//   console.log('Fill amount:', fillAmount.toString())
//   console.log('Resolver contract src address:', resolver)

//   // Step 4: Deploy source escrow - encode the arrays as bytes first
//   console.log('🚀 DEPLOY SRC PARAMETERS:')
//   const takerTraits = Sdk.TakerTraits.default()
//   .setExtension(order.extension)
//   .setAmountMode(Sdk.AmountMode.maker)
//   .setAmountThreshold(order.takingAmount)


// console.log('Resolver contract:', resolverContract)

// console.log('SWAP_CONFIG.source.chainId', SWAP_CONFIG.source.chainId)
// console.log('order', order)
// console.log('signature', signature)
// console.log('takerTraits', takerTraits)
// console.log('fillAmount', fillAmount)

// const deployTxRequest = resolverContract.deploySrc(
//   SWAP_CONFIG.source.chainId,
//   order,
//   signature,
//   takerTraits,
//   fillAmount
// )

// console.log('deployTxRequest', deployTxRequest)
// console.log('📤 DEPLOY TX REQUEST:')
// console.log('To:', deployTxRequest.to)
// console.log('Value:', deployTxRequest.value?.toString())
// console.log('Data:', deployTxRequest.data)
// console.log('Data length:', deployTxRequest.data?.length)
// console.log('Data is empty?', !deployTxRequest.data || deployTxRequest.data === '0x')

// // ✅ CRITICAL FIX: Use the deployTxRequest directly instead of reformatting
// console.log('🔧 DEPLOY TX REQUEST (direct from Resolver):')
// console.log('deployTxRequest:', deployTxRequest)
// console.log('To:', deployTxRequest.to)
// console.log('Data:', deployTxRequest.data)
// console.log('Data length:', deployTxRequest.data?.length)
// console.log('Value:', deployTxRequest.value?.toString())

// // Check if data is missing and throw error
// if (!deployTxRequest.data || deployTxRequest.data === '0x' || deployTxRequest.data === '') {
//   throw new Error('❌ CRITICAL: deployTxRequest.data is empty! This will cause transaction to fail.')
// }

// console.log('tx', deployTxRequest)

// // ✅ BROWSER FIX: Explicitly serialize for browser compatibility
// console.log('🔄 BROWSER FIX: Serializing transaction for browser...')

// const browserTx = {
//   to: deployTxRequest.to,
//   data: deployTxRequest.data,
//   value: deployTxRequest.value?.toString(), // Convert BigInt to string for browser
//   gasLimit: 10_000_000 // Add explicit gas limit
// }

// console.log('� BROWSER TX (serialized):')
// console.log('To:', browserTx.to)
// console.log('Data:', browserTx.data)
// console.log('Data length:', browserTx.data?.length)
// console.log('Value (string):', browserTx.value)
// console.log('Gas limit:', browserTx.gasLimit)


// let srcTx: any
// let srcReceipt: any

// // ⚠️ IMPORTANT: In the real world, this would be called by the resolver backend, not the user frontend
// // For demo purposes, we're simulating the resolver's action by using the resolver wallet
// console.log('🔄 RESOLVER ACTION: Deploying source escrow (this should normally be done by resolver backend)...')

// console.log('🔍 PRE-SEND DEBUG:')
// console.log('ResolverWallet address:', ResolverWallet.address)
// console.log('Transaction to:', deployTxRequest.to)
// console.log('Transaction data length:', deployTxRequest.data?.length)
// console.log('Transaction value:', deployTxRequest.value?.toString())

// // ...existing code...

// console.log('🔍 CONTRACT ADDRESS DEBUG:')
// console.log('Deployed resolver address:', resolver)
// console.log('Transaction target address:', deployTxRequest.to)
// console.log('Addresses match:', resolver === deployTxRequest.to)

// // ...existing code...
// // ✅ CRITICAL FIX: Check contract owner and verify it matches resolver wallet
// try {
//   console.log('🚀 SENDING TRANSACTION...')
  
//   // Debug: Check contract owner
//   const resolverContract = new ethers.Contract(resolver, resolverContractAbi.abi, ResolverProvider)
//   const contractOwner = await resolverContract.owner()
//   console.log('🔍 OWNERSHIP DEBUG:')
//   console.log('Contract owner:', contractOwner)
//   console.log('Resolver wallet address:', ResolverWallet.address)
//   console.log('Expected resolver address:', ethers.computeAddress(resolverPk))
//   console.log('Owner matches resolver wallet:', contractOwner.toLowerCase() === ResolverWallet.address.toLowerCase())
  
//   if (contractOwner.toLowerCase() !== ResolverWallet.address.toLowerCase()) {
//     throw new Error(`❌ OWNERSHIP ERROR: Contract owner (${contractOwner}) does not match resolver wallet (${ResolverWallet.address})`)
//   }
  
//   // Debug: Check function signature
//   const expectedSelector = '0xca218276' // deploySrc function selector
//   const actualSelector = deployTxRequest.data!.slice(0, 10)
//   console.log('Function selector matches:', expectedSelector === actualSelector)
  

  
//   // Send the transaction with proper gas settings
//   const txRequest = {
//     to: deployTxRequest.to,
//     data: deployTxRequest.data,
//     value: deployTxRequest.value,
//     gasLimit: 2_000_000, // Increased gas limit for complex transaction
//     type: 2 // EIP-1559 transaction
//   }
  
//   console.log('Full transaction request:', txRequest)
  
//   // Try sending the transaction even if static call failed
//   srcTx = await ResolverWallet.sendTransaction(txRequest)
//   console.log('✅ TRANSACTION SENT SUCCESSFULLY!')
// } catch (error: any) {
//   console.error('❌ TRANSACTION FAILED:', error)
  
//   // Enhanced error debugging
//   console.log('Error type:', error.constructor?.name)
//   console.log('Error code:', error.code)
//   console.log('Error reason:', error.reason)
  
//   // Try to get more details about the revert
//   try {
//     if (deployTxRequest.to) {
//       const code = await ResolverProvider.getCode(deployTxRequest.to)
//       console.log('Contract code exists:', code !== '0x')
//       console.log('Contract code length:', code.length)
//     } else {
//       console.log('No target address in deployTxRequest')
//     }
//   } catch (e) {
//     console.log('Could not check contract code:', e)
//   }
  
//   throw error
// }
// srcReceipt = await srcTx.wait(1)

// console.log('✅ REAL deploySrc transaction confirmed!')
// console.log('Transaction hash:', srcTx.hash)
// console.log('Block hash:', srcReceipt?.blockHash)

// console.log('Final transaction hash:', srcTx.hash)

// Return the data needed for the API calls
return {
  message: 'Source escrow deployed successfully'
}

// ...existing code...

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
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (accounts: string[]) => void) => void;
      removeListener: (event: string, callback: (accounts: string[]) => void) => void;
      isMetaMask?: boolean;
    };
    keplr?: {
      enable: (chainId: string) => Promise<void>;
      getOfflineSigner: (chainId: string) => any;
      getKey: (chainId: string) => Promise<any>;
    };
  }
} 