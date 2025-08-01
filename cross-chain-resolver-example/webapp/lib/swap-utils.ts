import { ethers } from 'ethers'
import * as Sdk from '@1inch/cross-chain-sdk'
import { uint8ArrayToHex, UINT_40_MAX } from '@1inch/byte-utils'
import { createHash } from 'crypto'
import { 
  MsgExecuteContractCompat,
  PrivateKey,
  MsgBroadcasterWithPk,
} from '@injectivelabs/sdk-ts'
import { Network } from '@injectivelabs/networks'
import { ChainId } from '@injectivelabs/ts-types'
import { Interface, Signature } from 'ethers'
import { Resolver } from './resolver'

import factoryContract from "./TestEscrowFactory.json"
import resolverContract from "./Resolver.json"
// Resolver contract ABI (minimal interface needed)
const RESOLVER_ABI = [
  'function deploySrc(bytes calldata srcImmutables, bytes calldata order, bytes32 r, bytes32 vs, uint256 amount, uint256 trait, bytes calldata args) external payable',
  'function withdraw(address escrow, bytes32 secret, bytes calldata immutables) external'
]

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

const RESOLVERR = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
const ESCROW_FACTORYY = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

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

  const ownerPrivateKey = '0x8bc5e2d9a1ec77c51fd83dc78622222c8b2f1eadaa361eae31409a702ec21c27' // from test config
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
      resolverContract,
      [
          escrowFactory,
          SWAP_CONFIG.source.limitOrderProtocol,
          ethers.computeAddress(resolverPk) // resolver as owner of contract
      ],
      provider,
      deployer
    )
    console.log(`[${SWAP_CONFIG.source.chainId}]`, `Resolver contract deployed to`, resolver)

      
  // const escrowFactoryFactory = new ethers.ContractFactory(
  //   factoryContract.abi, 
  //   factoryContract.bytecode, 
  //   deployer
  // )


  /*
  const escrowFactoryContract = await escrowFactoryFactory.deploy(
    SWAP_CONFIG.source.limitOrderProtocol,     // limitOrderProtocol
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // wrappedNative (WETH)
    ethers.ZeroAddress,                        // accessToken
    deployer.address,                          // owner
    60 * 30,                                   // src rescue delay
    60 * 30                                    // dst rescue delay
  )
  await escrowFactoryContract.waitForDeployment()
  const escrowFactory = await escrowFactoryContract.getAddress()
  console.log('✅ EscrowFactory deployed to:', escrowFactory)

  // Deploy Resolver (exactly like test)
  console.log('Deploying Resolver...')
  const resolverFactory = new ethers.ContractFactory(
    resolverContract.abi, 
    resolverContract.bytecode, 
    deployer
  )
  
  const resolverContractInstance = await resolverFactory.deploy(
    escrowFactory,                             // escrowFactory
    SWAP_CONFIG.source.limitOrderProtocol,     // limitOrderProtocol
    ethers.computeAddress(resolverPk)          // owner (resolver address)
  )
  await resolverContractInstance.waitForDeployment()
  const resolver = await resolverContractInstance.getAddress()
  console.log('✅ Resolver deployed to:', resolver)
*/
  return { escrowFactoryCont: escrowFactory, resolverCont: resolver }
}
export async function executeCrossChainSwap(
  fromAmount: string,
  userAddress: string,
  injectiveAddress: string
): Promise<any> {

  const { Address } = Sdk

  const Rprovider = new ethers.JsonRpcProvider(SWAP_CONFIG.source.rpcUrl, SWAP_CONFIG.source.chainId)
  const { escrowFactoryCont, resolverCont } = await getOrDeployContracts(Rprovider)


  // Step 1: Generate swap parameters (matching test spec exactly)
  const swapId = `swap-${Date.now()}`
  const secretBytes = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
  const secretBytesX = uint8ArrayToHex(Buffer.from(secretBytes, 'hex'))
  const secret = createHash('sha256').update(Buffer.from(secretBytes, 'hex')).digest('hex')
  const srcTimestamp = BigInt(Math.floor(Date.now() / 1000))

  console.log('🔧 TEST SETUP:')
  console.log('Swap ID:', swapId)
  console.log('Secret bytes (raw):', secretBytes)
  console.log('Secret bytes (hex with 0x):', secretBytesX)
  console.log('Secret hash:', secret)
  console.log('User address:', userAddress)

  // Step 2: Create cross-chain order using 1inch SDK (exactly like test)
  const order = Sdk.CrossChainOrder.new(
    new Address(escrowFactoryCont),
    {
      salt: Sdk.randBigInt(1000),
      maker: new Address(userAddress),
      makingAmount: ethers.parseUnits(fromAmount, 6),
      takingAmount: ethers.parseUnits(fromAmount, 6),
      makerAsset: new Address(SWAP_CONFIG.source.tokens.USDC),
      takerAsset: new Address(SWAP_CONFIG.source.tokens.USDC)
    },
    {
      hashLock: Sdk.HashLock.forSingleFill(secretBytesX),
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
          address: new Address(resolverCont),
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
  console.log('Order salt:', order.salt.toString())
  console.log('Order maker:', order.maker.toString())
  console.log('Order making amount:', order.makingAmount.toString())
  console.log('Order taking amount:', order.takingAmount.toString())
  console.log('Order maker asset:', order.makerAsset.toString())
  console.log('Order taker asset:', order.takerAsset.toString())
  console.log('Src safety deposit:', order.escrowExtension.srcSafetyDeposit.toString())
  
  // Step 3: Sign the order (user signs with MetaMask)
  const realChainId = SWAP_CONFIG.source.chainId // 27270
  const typedData = order.getTypedData(realChainId)

  const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
  const signer = await provider.getSigner()

  const signature = await signer.signTypedData(
    typedData.domain,
    { Order: typedData.types[typedData.primaryType] },
    typedData.message
  )
  // Create the order hash for signing
  const orderHash = order.getOrderHash(SWAP_CONFIG.source.chainId)
  
  console.log('🔍 DEBUG - orderHash type:', typeof orderHash)
  console.log('🔍 DEBUG - orderHash value:', orderHash)
  console.log('🔍 DEBUG - orderHash constructor:', orderHash?.constructor?.name)

  // Then modify line 155 to handle the case where orderHash might be an object
 

  console.log('✍️ ORDER SIGNED:')
  console.log('Signature:', signature)
  console.log('Order hash:', orderHash)
  
  const fillAmount = order.makingAmount

  console.log('💰 FILL PARAMETERS:')
  console.log('Fill amount:', fillAmount.toString())
  console.log('Resolver contract src address:', resolverCont)

  // Step 4: Deploy source escrow - encode the arrays as bytes first
  console.log('🚀 DEPLOY SRC PARAMETERS:')
  const takerTraits = Sdk.TakerTraits.default()
  .setExtension(order.extension)
  .setAmountMode(Sdk.AmountMode.maker)
  .setAmountThreshold(order.takingAmount)

const {args, trait} = takerTraits.encode()
const {r, yParityAndS: vs} = Signature.from(signature)
const immutables = order.toSrcImmutables(
  SWAP_CONFIG.source.chainId, 
  new Sdk.Address(resolverCont), 
  fillAmount, 
  order.escrowExtension.hashLockInfo
)

// Convert SDK objects to array format (like working code)
const orderObj = order.build()
const orderArray = [
  orderObj.salt,
  orderObj.maker,
  orderObj.receiver,
  orderObj.makerAsset,
  orderObj.takerAsset,
  orderObj.makingAmount,
  orderObj.takingAmount,
  orderObj.makerTraits
]

const immutablesObj = immutables.build()
const immutablesArray = [
  immutablesObj.orderHash,
  immutablesObj.hashlock,
  immutablesObj.maker,
  immutablesObj.taker,
  immutablesObj.token,
  immutablesObj.amount,
  immutablesObj.safetyDeposit,
  immutablesObj.timelocks
]



const resolverContract = new Resolver(resolverCont, resolverCont)
console.log('Resolver contract:', resolverContract)

const deployTxRequest = resolverContract.deploySrc(
  SWAP_CONFIG.source.chainId,
  order,
  signature,
  takerTraits,
  fillAmount
)
console.log('📤 DEPLOY TX REQUEST:')
console.log('To:', deployTxRequest.to)
console.log('Value:', deployTxRequest.value?.toString())
console.log('Data length:', deployTxRequest.data?.length)

const ResolverProvider = new ethers.JsonRpcProvider(SWAP_CONFIG.source.rpcUrl); // Replace with your Infura/Alchemy endpoint
const ResolverWallet = new ethers.Wallet(resolverPk, ResolverProvider);


const tx = {
  ...deployTxRequest,
  gasLimit: 10_000_000,
  from: await ResolverWallet.getAddress()
}

const srcTx = await ResolverWallet.sendTransaction(tx)

const srcReceipt = await srcTx.wait()
console.log('Block hash:', srcReceipt)



/*
const srcTx = await ResolverWallet.sendTransaction(deployTxRequest)

const srcReceipt = await srcTx.wait()
console.log('Block hash:', srcReceipt)


/*
  // Create contract instance and call with encoded bytes
  const resolverContract = new ethers.Contract(
    RESOLVERR,
    RESOLVER_ABI,
    signer
  )

  console.log('🚀 CALLING DEPLOYSRC WITH ENCODED BYTES...')

  const srcTx = await resolverContract.deploySrc(
    immutablesEncoded,                  // encoded bytes
    orderEncoded,                       // encoded bytes
    r,                                  // signature r
    vs,                                 // signature vs
    fillAmount,                         // amount
    trait,                              // trait as BigInt
    args,                               // args as bytes
    {
      value: order.escrowExtension.srcSafetyDeposit,
      gasLimit: 10_000_000
    }
  )
    
  console.log('✅ DEPLOY SRC RESULT:')
  console.log(`Source escrow deployed in tx ${srcTx.hash}`)
  
  const srcReceipt = await srcTx.wait()
  console.log('Block hash:', srcReceipt.blockHash)
  */
    // console.log('To:', deployTxRequest.to)
    // console.log('Value:', deployTxRequest.value?.toString())
    // console.log('Data length:', deployTxRequest.data?.length)
/*
  console.log('🚀 DEPLOY SRC PARAMETERS:')
            const takerTraits = Sdk.TakerTraits.default()
                .setExtension(order.extension)
                .setAmountMode(Sdk.AmountMode.maker)
                .setAmountThreshold(order.takingAmount)
  
  const takerTraits = Sdk.TakerTraits.default()
    .setExtension(order.extension)
    .setAmountMode(Sdk.AmountMode.maker)
    .setAmountThreshold(order.takingAmount)
  
  const {args, trait} = takerTraits.encode()
  console.log('Taker traits value:', trait.toString())
  console.log('Taker traits args:', args)
  console.log('Chain ID:', SWAP_CONFIG.source.chainId)
  console.log('Order extension:', order.extension)
  console.log('Amount mode:', Sdk.AmountMode.maker)
  console.log('Amount threshold:', order.takingAmount.toString())

  // Create resolver transaction request (matching test resolver.deploySrc)
  const {r, yParityAndS: vs} = Signature.from(signature)
  const immutables = order.toSrcImmutables(
    SWAP_CONFIG.source.chainId, 
    new Address(RESOLVERR), 
    fillAmount, 
    order.escrowExtension.hashLockInfo
  )

  const resolverInterface = new Interface(RESOLVER_ABI)
  const deployTxRequest = {
    to: RESOLVERR,
    data: resolverInterface.encodeFunctionData('deploySrc', [
      immutables.build(),
      order.build(),
      r,
      vs,
      fillAmount,
      trait,
      args
    ]),
    value: order.escrowExtension.srcSafetyDeposit
  }

  console.log('📤 DEPLOY TX REQUEST:')
  console.log('To:', deployTxRequest.to)
  console.log('Value:', deployTxRequest.value?.toString())
  console.log('Data length:', deployTxRequest.data?.length)

  const srcTx = await signer.sendTransaction(deployTxRequest)
  const srcReceipt = await srcTx.wait()

  console.log('✅ DEPLOY SRC RESULT:')
  console.log(`Source escrow deployed in tx ${srcTx.hash}`)
  console.log('Block hash:', srcReceipt?.blockHash)
  /*
  // Step 5: Fund destination escrow on Injective (like test Step 3)
  console.log(`Funding Injective atomic swap contract`)
  
  console.log('💰 INJECTIVE FUNDING PARAMETERS:')
  console.log('Secret bytes (raw):', secretBytes)
  console.log('Fill amount:', fillAmount.toString())
  console.log('Recipient address:', injectiveAddress)
  console.log('Expiry height:', 90_000_000)
  console.log('Swap ID:', swapId)

  const resolverWallet = PrivateKey.fromMnemonic(resolverMnemonic)
  const resolverAddress = resolverWallet.toAddress().toBech32()

  const broadcaster = new MsgBroadcasterWithPk({
    network: Network.Testnet,
    chainId: ChainId.Testnet,
    privateKey: resolverWallet,
    endpoints: {
      grpc: 'https://testnet.sentry.chain.grpc-web.injective.network',
      rest: 'https://testnet.sentry.lcd.injective.network',
      indexer: 'https://testnet.sentry.exchange.grpc-web.injective.network',
    },
  })

  const hash = createHash('sha256').update(Buffer.from(secretBytes, 'hex')).digest('hex')
  const executeMsg = {
    create: {
      id: swapId,
      hash,
      recipient: injectiveAddress,
      expires: {
        at_height: 90_000_000,
      },
    },
  }

  const msg = MsgExecuteContractCompat.fromJSON({
    sender: resolverAddress,
    contractAddress: SWAP_CONFIG.destination.contractAddress,
    msg: executeMsg,
    funds: [
      {
        amount: fillAmount.toString(), // native INJ amount
        denom: 'inj',
      },
    ],
  })

  const dstTx = await broadcaster.broadcast({ msgs: msg })
  await new Promise(resolve => setTimeout(resolve, 2000))

  console.log('✅ Destination escrow funded on Injective')
  console.log('Tx Hash:', dstTx.txHash)

  // Step 6: Wait for finality lock to pass (like test Step 4)
  console.log('⏰ WAITING FOR FINALITY LOCK:')
  console.log('Waiting 11 seconds for finality lock...')
  await new Promise(resolve => setTimeout(resolve, 11000))
  console.log('✅ Time passed, finality lock should be cleared')

  // Step 7: User claims funds on Injective (like test Step 5)
  console.log(`User claiming funds on Injective`)

  console.log('🔓 INJECTIVE CLAIM PARAMETERS:')
  console.log('Swap ID:', swapId)
  console.log('Secret bytes (raw for preimage):', secretBytes)
  console.log('Recipient address:', injectiveAddress)

  const claimMsg = {
    release: {
      id: swapId,
      preimage: secretBytes,
      recipient: injectiveAddress,
    },
  }

  const claimExecuteMsg = MsgExecuteContractCompat.fromJSON({
    sender: resolverAddress, // Resolver claims for user
    contractAddress: SWAP_CONFIG.destination.contractAddress,
    msg: claimMsg,
    funds: [],
  })

  const claimTx = await broadcaster.broadcast({ msgs: [claimExecuteMsg] })

  console.log('✅ Native INJ successfully claimed!')
  console.log('Tx Hash:', claimTx.txHash)

  // Step 8: Resolver withdraws from EVM source escrow (like test Step 6)
  console.log('🏦 WITHDRAWAL SETUP:')

  // Calculate escrow address (simplified - in real implementation would get from factory)
  const srcEscrowAddress = new Sdk.EscrowFactory(new Address(SWAP_CONFIG.source.escrowFactory)).getSrcEscrowAddress(
    immutables,
    new Address("0x") // ESCROW_SRC_IMPLEMENTATION - would need to get from factory
  )

  console.log('Calculated src escrow address:', srcEscrowAddress.toString())
  console.log('Escrow factory address:', SWAP_CONFIG.source.escrowFactory)

  console.log(`Resolver withdrawing from source escrow ${srcEscrowAddress}`)

  console.log('💸 WITHDRAWAL PARAMETERS:')
  console.log('Withdrawal side:', 'src')
  console.log('Escrow address:', srcEscrowAddress.toString())
  console.log('Secret (with 0x prefix):', secretBytesX)
  console.log('Immutables:', immutables)

  const withdrawTxRequest = {
    to: RESOLVERR,
    data: resolverInterface.encodeFunctionData('withdraw', [
      srcEscrowAddress.toString(), 
      secretBytesX, 
      immutables.build()
    ])
  }

  console.log('📤 WITHDRAW TX REQUEST:')
  console.log('To:', withdrawTxRequest.to)
  console.log('Data length:', withdrawTxRequest.data?.length)

  const withdrawTx = await signer.sendTransaction(withdrawTxRequest)
  const withdrawReceipt = await withdrawTx.wait()

  console.log('✅ WITHDRAWAL RESULT:')
  console.log(`Resolver withdrawn funds in tx ${withdrawTx.hash}`)

  return {
    success: true,
    swapId,
    orderHash,
    secretBytes,
    order,
    signature,
    injectiveContract: SWAP_CONFIG.destination.contractAddress,
    injAmount: ethers.formatUnits(fillAmount, 18),
    exchangeRate: 1000,
    message: 'Cross-chain swap completed successfully!',
    srcEscrowTx: srcTx.hash,
    dstFundingTx: dstTx.txHash,
    claimTx: claimTx.txHash,
    withdrawTx: withdrawTx.hash
  }
    */
   return {
    
    message: 'Swap Executed'
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