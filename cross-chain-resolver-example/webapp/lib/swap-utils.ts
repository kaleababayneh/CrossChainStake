import { AbiCoder, ethers,randomBytes } from 'ethers'
import * as Sdk from '@1inch/cross-chain-sdk'
import { uint8ArrayToHex, UINT_40_MAX } from '@1inch/byte-utils'
import { createHash } from 'crypto'
import { Resolver } from './resolver'
import { parseUnits, parseEther, MaxUint256 } from 'ethers'
import factoryContract from "./TestEscrowFactory.json"
import resolverContractAbi from "./Resolver.json"
import {EscrowFactory} from './escrow-factory'
import * as injective from './injective'

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
const injectiveResolverMnemonic = "soda giggle lobster frown sponsor bridge follow firm fashion buddy final this crawl junior burst race differ school pupil bleak above economy toy chunk"
const injectiveResolverPublicKey = "inj1rfhgjga07nkn5kmw7macwathepxew3rfndtw45" // Injective resolver public key
const injectiveContractAddress = "inj1rxrklxvejj93j7zqfpsd8a3c8n2xf4nakuwc6w" // Injective resolver contract address
const evmResolverPublicKey = "0x54E13447C59e6d0b844c8e2af22479b7ccc7D47D" // EVM resolver public key
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
  metaMaskAddress: string,
  keplrAddress: string,
  evm2inj: boolean
): Promise<any> {
  const swapId = `swap-${Date.now()}`
  const secretBytes = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
  const secretBytesX = uint8ArrayToHex(Buffer.from(secretBytes, 'hex')) // This will automatically include "0x" prefix
  


  console.log('🚀 STARTING COMPLETE CROSS-CHAIN SWAP')
  console.log('metaMaskAddress', metaMaskAddress)


  const Rprovider = new ethers.JsonRpcProvider(SWAP_CONFIG.source.rpcUrl, SWAP_CONFIG.source.chainId, {
                cacheTimeout: -1,
                staticNetwork: true
    })
        
  
  const { escrowFactory, resolver } = await getOrDeployContracts(Rprovider)

  const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
  const signer = await provider.getSigner()
    

  const ResolverWallet = new ethers.Wallet(resolverPk, Rprovider);

  const srcFactory = new EscrowFactory(Rprovider, escrowFactory);
  const srcTimestamp = BigInt((await Rprovider.getBlock('latest'))!.timestamp)
  const DST_RESOLVER = "inj1rfhgjga07nkn5kmw7macwathepxew3rfndtw45"
     const resolverContract = new Resolver(resolver, DST_RESOLVER)

// if statement beginis
if (evm2inj) {

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




  console.log('🔧 TEST SETUP:')
  console.log('Secret bytes:', secretBytes)
  console.log('Secret hash:', secretBytesX)
 
  // Step 2: Create cross-chain order using 1inch SDK (exactly like test)
  const order = Sdk.CrossChainOrder.new(
    new Address(escrowFactory),
    {
      salt: Sdk.randBigInt(BigInt(1000)),
      maker: new Address(metaMaskAddress),
      makingAmount: ethers.parseUnits('1', 6),
      takingAmount: ethers.parseUnits('1', 6),
      makerAsset: new Address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"), // USDC
      takerAsset: new Address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48") // USDC
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

 const srcDeployBlock = receipt?.blockHash as string
 const orderFillHash = receipt?.hash as string


console.log('✅ Transaction sent successfully!', receipt)
console.log(`Order ${orderHash} filled for ${fillAmount} in tx ${orderFillHash}`)

// Extract the event from the receipt logs directly
const srcEscrowEvent = srcFactory.parseSrcDeployEventFromReceipt(receipt)

console.log('📋 SRC ESCROW EVENT:')
console.log('Escrow event immutables:', srcEscrowEvent[0])

const address2 = keplrAddress

const hash = createHash('sha256').update(Buffer.from(secretBytes, 'hex')).digest('hex')
const injectiveTx = await injective.fund_dst_escrow_with_params(
                hash, // Pass the raw secret to generate the hash
                "1",
                address2, // recipient (user's Injective address)
                90_000_000, // expiry height
                swapId,
                injectiveResolverMnemonic // Pass the mnemonic for Injective resolver
    )

console.log('✅ Injective funding transaction:', injectiveTx)
console.log('🔧 RESOLVER DEBUG - injectiveTx:', injectiveTx)



  



 const injectiveClaimFund =     await injective.claim_funds_with_params_resolver(
                swapId,
                secretBytes, // raw secret as preimage,
                address2,
                injectiveResolverMnemonic // Pass the mnemonic for Injective resolver
            )


            // put this vefore injective claim
            // set timeout for 11 seconds to allow the dst escrow to be created with a print countdown
  await new Promise<void>(resolve => {
    let countdown = 11
    const interval = setInterval(() => {
      console.log(`⏳ Countdown: ${countdown} seconds remaining`)
      countdown -= 1
      if (countdown < 0) {
        clearInterval(interval)
        resolve()
      }
    }, 1000)
  })
console.log('✅ Injective claim transaction:', injectiveClaimFund)


 const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl()
console.log('📋 SRC ESCROW IMPLEMENTATION:', ESCROW_SRC_IMPLEMENTATION)

 const srcEscrowAddress = new Sdk.EscrowFactory(new Address(escrowFactory)).getSrcEscrowAddress(
                srcEscrowEvent[0],
                ESCROW_SRC_IMPLEMENTATION
            )
            
console.log('🏦 WITHDRAWAL SETUP:')
console.log('Escrow src implementation:', ESCROW_SRC_IMPLEMENTATION)
console.log('Calculated src escrow address:', srcEscrowAddress.toString())
console.log('Escrow factory address:', escrowFactory)

console.log(`[] Resolver withdrawing from source escrow ${srcEscrowAddress}`)





   const withdrawTxRequest = resolverContract.withdraw('src', srcEscrowAddress, secretBytesX, srcEscrowEvent[0])
  //withdrawTxRequest.to = evmResolverPublicKey // Set the resolver contract as the recipient
  console.log('📤 WITHDRAW TX REQUEST:')
  console.log('To:', withdrawTxRequest.to)
  console.log('Data length:', withdrawTxRequest.data?.length)

const Ftxy = {
            ...withdrawTxRequest,
            gasLimit: 10_000_000,
            
        }

 const withdrawTx = await ResolverWallet.sendTransaction(
  Ftxy
 )

  const withdrawReceipt = await withdrawTx.wait(1)

 const resolverWithdrawHash = withdrawReceipt?.hash

console.log('✅ WITHDRAWAL TX SENT SUCCESSFULLY!')
console.log('Withdrawal receipt:', withdrawReceipt)
console.log('✅ WITHDRAWAL RESULT:')
console.log(`[$] Resolver withdrawn funds in tx ${resolverWithdrawHash}`)
}
else {
  console.log('Welcome to the new world of cross-chain swaps!')

  console.log(`[] User creating atomic swap on Injective`)

  const xyza = await injective.fund_dst_escrow_with_keplr(
        createHash('sha256').update(Buffer.from(secretBytes, 'hex')).digest('hex'),
        "300000000", 
        injectiveResolverPublicKey, // INJ Resolver as recipient
        90_000_000, // expiry height
        swapId
   )


 console.log("lets ee", xyza)
 


        const reverseOrder = Sdk.CrossChainOrder.new(
                new Address(escrowFactory),
                {
                    salt: Sdk.randBigInt(1000),
                    maker: new Address(evmResolverPublicKey), // User is maker
                    makingAmount: parseUnits('8', 6), // 1 USDC  
                    takingAmount: parseUnits('8', 6), // 1 CUSDC equivalent
                    makerAsset: new Address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"), // USDC
                    takerAsset: new Address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48") // USDC
                },
                {
                    hashLock: Sdk.HashLock.forSingleFill(secretBytesX),
                    timeLocks: Sdk.TimeLocks.new({
                        srcWithdrawal: BigInt(10), // 10sec finality lock for test
                        srcPublicWithdrawal: BigInt(120), // 2m for private withdrawal
                        srcCancellation: BigInt(121), // 1sec public cancellation
                        srcPublicCancellation: BigInt(122), // 1sec private cancellation
                        dstWithdrawal: BigInt(10), // 10sec finality lock for test
                        dstPublicWithdrawal: BigInt(100), // 100sec private withdrawal
                        dstCancellation: BigInt(101) // 1sec public cancellation
                    }),
                    srcChainId: Sdk.NetworkEnum.ETHEREUM,
                    dstChainId: Sdk.NetworkEnum.COINBASE,
                    srcSafetyDeposit: parseEther('0.001'),
                    dstSafetyDeposit: parseEther('0.001')
                },
                {
                    auction: new Sdk.AuctionDetails({
                        initialRateBump: 0,
                        points: [],
                        duration: BigInt(120), // 2 minutes
                        startTime: srcTimestamp
                    }),
                    whitelist: [
                        {
                            address: new Address(resolver), // Resolver can fill
                            allowFrom: BigInt(0) // Allow from anyone
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
        
            const realChainId = SWAP_CONFIG.source.chainId // 27270
            const typedData = reverseOrder.getTypedData(realChainId)

             const signature = await ResolverWallet.signTypedData(
                  typedData.domain,
                  { Order: typedData.types[typedData.primaryType] },
                  typedData.message
                )

            const orderHash = reverseOrder.getOrderHash(SWAP_CONFIG.source.chainId)




            console.log(`Order Hash: ${orderHash} | Resolver filling reverse order`)

            
const tx = resolverContract.deploySrc(
                    SWAP_CONFIG.source.chainId,
                    reverseOrder,
                    signature,
                    Sdk.TakerTraits.default()
                        .setExtension(reverseOrder.extension)
                        .setAmountMode(Sdk.AmountMode.maker)
                        .setAmountThreshold(reverseOrder.takingAmount),
                    reverseOrder.makingAmount
                )
   console.log('📤 DEPLOY TX REQUEST:', tx)
                

      const Ftx = {
                    ...tx,
                    gasLimit: 10_000_000,

      }
          const res = await ResolverWallet.sendTransaction(Ftx)


 const receipt = await res.wait(1)

 console.log('📜 Transaction receipt:', receipt)

  const evmEscrowEvent = await srcFactory.parseSrcDeployEventFromReceipt(receipt)

  console.log('📋 EVM ESCROW EVENT:', evmEscrowEvent)
  await new Promise<void>(resolve => {
    let countdown = 11
    const interval = setInterval(() => {
        console.log(`⏳ Countdown: ${countdown} seconds remaining`)
        countdown -= 1
        if (countdown < 0) {
            clearInterval(interval)
            resolve()
        }
    }, 1000)
})



const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl()
const evmEscrowAddress = new Sdk.EscrowFactory(new Address(escrowFactory)).getSrcEscrowAddress(
    evmEscrowEvent[0],
    ESCROW_SRC_IMPLEMENTATION
)

console.log('🏦 WITHDRAWAL SETUP:', evmEscrowAddress)


/**
 * 
             const {txHash: userClaimHash} = await srcChainUser.send(
                resolverContract.withdraw('src', evmEscrowAddress, secretBytesX, evmEscrowEvent[0])
            )
            
            console.log(`[${srcChainId}] User claimed USDC in tx ${userClaimHash}`)
 */

  const resolverWithdrawTxRequest = resolverContract.withdraw('src', evmEscrowAddress, secretBytesX, evmEscrowEvent[0])
  //resolverWithdrawTxRequest.to = evmResolverPublicKey // Set the resolver contract as the recipient
  console.log('📤 WITHDRAW TX REQUEST:')
  console.log('To:', resolverWithdrawTxRequest.to)
  console.log('Data length:', resolverWithdrawTxRequest.data?.length)

const Ftxy = {
            ...resolverWithdrawTxRequest,
            gasLimit: 10_000_000,
            
        }

 console.log('📤 WITHDRAW TX REQUEST:', Ftxy)

  const withdrawTx = await ResolverWallet.sendTransaction(
    Ftxy
  )
  const withdrawReceipt = await withdrawTx.wait(1)

  const resolverWithdrawHash = withdrawReceipt?.hash

  console.log('✅ WITHDRAWAL TX SENT SUCCESSFULLY!')
  console.log('Withdrawal receipt:', withdrawReceipt)
  console.log('✅ WITHDRAWAL RESULT:')
  console.log(`[$] Resolver withdrawn funds in tx ${resolverWithdrawHash}`)

            /*
 const srcDeployBlock = receipt?.blockHash as string
 const orderFillHash = receipt?.hash as string

    const withdrawTx = await ResolverWallet.sendTransaction(
        Ftxy
    )

    const withdrawReceipt = await withdrawTx.wait(1)
    console.log('✅ WITHDRAWAL TX SENT SUCCESSFULLY!')
    console.log('Withdrawal receipt:', withdrawReceipt)



   const azya = await injective.claim_funds_with_params_resolver(
                swapId,
                secretBytes,
                injectiveResolverPublicKey,
                injectiveResolverMnemonic // Pass the mnemonic for Injective resolver
  )

  console.log("lets ee", azya)

  console.log('✅ Injective claim transaction sent successfully!')
  */
}




           return {
  message: 'Source escrow deployed successfully'
}
        }

// ...existing code...



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
