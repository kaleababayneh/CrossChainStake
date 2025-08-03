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
import { Interface } from 'ethers'
import { parse } from 'path'

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


// Callback function types for real-time UI updates
export interface SwapProgressCallbacks {
  onStepUpdate: (step: string, status: 'in_progress' | 'completed' | 'failed', txHash?: string, message?: string) => void
  onSwapDataUpdate: (data: Partial<SwapResponse>) => void
}

export async function executeCrossChainSwap(
  
  makerAmountReq: string,
  takerAmountReq: string,
  metaMaskAddress: string,
  keplrAddress: string,
  evm2inj: boolean,
  secretBytes: string,
  callbacks?: SwapProgressCallbacks

): Promise<any> {

  const swapId = `swap-${Date.now()}`
  const secretBytesHex = uint8ArrayToHex(Buffer.from(secretBytes, 'hex')) // This will automatically include "0x" prefix
  
  const resolverInterface = new Interface([
    'function arbitraryCalls(address[] calldata targets, bytes[] calldata arguments) external'
  ])

  const usdcTransferData = '0xa9059cbb' +  coder.encode(['address', 'uint256'], [metaMaskAddress, parseUnits(takerAmountReq, 6)]).slice(2)
  const transferTxData = resolverInterface.encodeFunctionData('arbitraryCalls', [
    [SWAP_CONFIG.source.tokens.USDC], 
    [usdcTransferData] 
  ])


  const resolverProvider = new ethers.JsonRpcProvider(SWAP_CONFIG.source.rpcUrl, SWAP_CONFIG.source.chainId, {
                cacheTimeout: -1,
                staticNetwork: true
    })
        
  
  const { escrowFactory, resolver } = await getOrDeployContracts(resolverProvider)

  const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
  const signer = await provider.getSigner()
    

  const ResolverWallet = new ethers.Wallet(resolverPk, resolverProvider);
  const srcFactory = new EscrowFactory(resolverProvider, escrowFactory);
  const srcTimestamp = BigInt((await resolverProvider.getBlock('latest'))!.timestamp)
  const DST_RESOLVER = "inj1rfhgjga07nkn5kmw7macwathepxew3rfndtw45"
  const resolverContract = new Resolver(resolver, DST_RESOLVER)

  if (evm2inj) {

      // Step 1: Token Approval
      callbacks?.onStepUpdate('approve', 'in_progress', undefined, 'Approving USDC for cross-chain transfer...')
      
      const approveToken = await signer.sendTransaction({
                to: SWAP_CONFIG.source.tokens.USDC,
                data: '0x095ea7b3' + coder.encode(['address', 'uint256'], [SWAP_CONFIG.source.limitOrderProtocol, MaxUint256]).slice(2)
      })

      await approveToken.wait()
      console.log('✅ USDC approved for limit order protocol')
      callbacks?.onStepUpdate('approve', 'completed', approveToken.hash, 'USDC approved successfully')

      const srcResolverContract = new ethers.Contract(
        resolver,
        resolverContractAbi.abi,
        ResolverWallet
    )

      // Step 2: Create cross-chain order using 1inch SDK 
      const order = Sdk.CrossChainOrder.new(
        new Address(escrowFactory),
        {
          salt: Sdk.randBigInt(BigInt(1000)),
          maker: new Address(metaMaskAddress),
          makingAmount: ethers.parseUnits(makerAmountReq, 6),
          takingAmount: ethers.parseUnits(takerAmountReq, 6),
          makerAsset: new Address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"), // USDC
          takerAsset: new Address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48") // USDC
        },
        {
          hashLock: Sdk.HashLock.forSingleFill(secretBytesHex),
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
          dstChainId: Sdk.NetworkEnum.COINBASE, 
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

    const fillAmount = order.makingAmount
    console.log('💰 FILL AMOUNT:', fillAmount.toString())
    console.log('Resolver contract address:', resolverContract)

    // Step 2: Source Escrow Deployment
    callbacks?.onStepUpdate('src_escrow', 'in_progress', undefined, 'Deploying escrow contract on Ethereum...')

    const deployTxonSrc = resolverContract.deploySrc(
          SWAP_CONFIG.source.chainId,
        order,
        signature,
        Sdk.TakerTraits.default()
            .setExtension(order.extension)
            .setAmountMode(Sdk.AmountMode.maker)
            .setAmountThreshold(order.takingAmount),
        fillAmount
   )


    const submitTransaction = await ResolverWallet.sendTransaction(
        {
        ...deployTxonSrc,
        gasLimit: 10_000_000,
      }
    )

    const receipt = await submitTransaction.wait(1)

    
    const orderFillHash = receipt?.hash as string

    console.log('✅ Transaction sent successfully!', receipt)
    console.log(`Order ${orderHash} filled for ${fillAmount} in tx ${orderFillHash}`)

    callbacks?.onStepUpdate('src_escrow', 'completed', orderFillHash, 'Source escrow deployed successfully')
    callbacks?.onSwapDataUpdate({ srcEscrowTx: orderFillHash })

    // Extract the event from the receipt logs directly
    const srcEscrowEvent = srcFactory.parseSrcDeployEventFromReceipt(receipt)

    console.log('📋 SRC ESCROW EVENT:')
    console.log('Escrow event immutables:', srcEscrowEvent[0])

    const address2 = keplrAddress

    const hash = createHash('sha256').update(Buffer.from(secretBytes, 'hex')).digest('hex')

    // Step 3: Destination Funding
    callbacks?.onStepUpdate('dst_funding', 'in_progress', undefined, 'Funding escrow on Injective network...')

    const injectiveTx = await injective.fund_dst_escrow_with_params(
                    hash, 
                    parseUnits(takerAmountReq, 18).toString(),
                    keplrAddress, // recipient (user's Injective address)
                    90_000_000, // expiry height
                    swapId,
                    injectiveResolverMnemonic // Pass the mnemonic for Injective resolver
        )

    console.log('✅ Injective funding transaction:', injectiveTx)
    console.log('🔧 RESOLVER DEBUG - injectiveTx:', injectiveTx)
    
    callbacks?.onStepUpdate('dst_funding', 'completed', injectiveTx.txHash, 'Destination funded successfully')
    callbacks?.onSwapDataUpdate({ dstFundingTx: injectiveTx.txHash })

      // set timeout for 11 seconds to allow the dst escrow to be created with a print countdown
      callbacks?.onStepUpdate('claim', 'in_progress', undefined, 'Waiting for escrow confirmation...')
      await new Promise<void>(resolve => {
        let countdown = 11
        const interval = setInterval(() => {
          console.log(`⏳ Countdown: ${countdown} seconds remaining`)
          callbacks?.onStepUpdate('claim', 'in_progress', undefined, `Waiting ${countdown}s for escrow confirmation...`)
          countdown -= 1
          if (countdown < 0) {
            clearInterval(interval)
            resolve()
          }
        }, 1000)
      })


    const injectiveClaimFund =  await injective.claim_funds_with_params_resolver(
        swapId,
        secretBytes, // raw secret as preimage,
        keplrAddress,
        injectiveResolverMnemonic // Pass the mnemonic for Injective resolver
    )

    console.log('✅ Injective claim transaction:', injectiveClaimFund)
    
    callbacks?.onStepUpdate('claim', 'completed', injectiveClaimFund, 'Funds claimed on Injective')
    callbacks?.onSwapDataUpdate({ claimTx: injectiveClaimFund })


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

    // Step 5: Resolver Withdrawal
    callbacks?.onStepUpdate('withdraw', 'in_progress', undefined, 'Resolver withdrawing from source escrow...')

    const withdrawTxRequest = resolverContract.withdraw('src', srcEscrowAddress, secretBytesHex, srcEscrowEvent[0])
    console.log('📤 WITHDRAW TX REQUEST:')
    console.log('To:', withdrawTxRequest.to)
    console.log('Data length:', withdrawTxRequest.data?.length)

    const withdrawTx = await ResolverWallet.sendTransaction(
          {
            ...withdrawTxRequest,
            gasLimit: 10_000_000,  
          }
    )

    const withdrawReceipt = await withdrawTx.wait(1)

    const resolverWithdrawHash = withdrawReceipt?.hash

    console.log('✅ WITHDRAWAL TX SENT SUCCESSFULLY!')
    console.log('Withdrawal receipt:', withdrawReceipt)
    console.log('✅ WITHDRAWAL RESULT:')
    console.log(`[$] Resolver withdrawn funds in tx ${resolverWithdrawHash}`)
    
    callbacks?.onStepUpdate('withdraw', 'completed', resolverWithdrawHash, 'Cross-chain swap completed successfully!')
    callbacks?.onSwapDataUpdate({ withdrawTx: resolverWithdrawHash })

}
 else {
  
  
    console.log(`🚀 STARTING GASLESS CROSS-CHAIN SWAP (INJ → EVM)`)
    console.log(`💡 Using Next.js API for fee grants - no protobuf encoding issues!`)
    console.log(`⛽ User pays NO gas fees - resolver covers transaction costs`)
    console.log(`🔄 Flow: Fee Grant → Gasless User Tx → Resolver Fills Order → Transfer to User`)
  
    // Step 1: Resolver grants fee allowance to user via Next.js API
    console.log('🎁 Step 1: Resolver granting fee allowance to user via API...')
    callbacks?.onStepUpdate('fee_grant', 'in_progress', undefined, 'Resolver granting fee allowance for gasless transaction...')
    let feeGrant;
    try {
      feeGrant = await injective.grantFeeAllowanceToUser(
        keplrAddress, // user's Injective address
        injectiveResolverMnemonic, // resolver mnemonic (will be used by API)
        '10000000000000000', // 0.01 INJ allowance
        3 // 3 minutes duration
      )
      
      console.log('✅ Fee grant successful via Next.js API!')
      console.log('- Tx Hash:', feeGrant.txHash)
      console.log('- Granter:', feeGrant.granter)
      console.log('- Expires:', feeGrant.expiresAt)
      callbacks?.onStepUpdate('fee_grant', 'completed', feeGrant.txHash, 'Fee allowance granted successfully')
    } catch (error) {
      console.error('❌ Fee grant failed:', error)
      throw new Error(`Fee grant failed: ${error}`)
    }
  
    // Step 2: User signs transaction intent (this could be a simple message sign)
    console.log('✍️ Step 2: User signing transaction intent...')
    // You could add a Keplr message sign here for user confirmation
    
    // Step 3: User creates gasless swap using the fee grant
    console.log('⛽ Step 3: User creating gasless swap with granted fees...')
    callbacks?.onStepUpdate('gasless_swap', 'in_progress', undefined, 'Creating gasless swap on Injective...')
    let lock_inj_on_src_chain;
    try {
      lock_inj_on_src_chain = await injective.fund_dst_escrow_with_fee_grant(
        createHash('sha256').update(Buffer.from(secretBytes, 'hex')).digest('hex'),
        parseUnits(makerAmountReq, 18).toString(),
        injectiveResolverPublicKey, // INJ Resolver as recipient
        90_000_000, // expiry height
        swapId,
        feeGrant.granter // Use the actual granter address from fee grant response
      )
      
      console.log("✅ Gasless swap created successfully!")
      console.log("- Swap ID:", swapId)
      console.log("- Tx Hash:", lock_inj_on_src_chain.txHash)
      callbacks?.onStepUpdate('gasless_swap', 'completed', lock_inj_on_src_chain.txHash, 'Gasless swap created successfully')
      callbacks?.onSwapDataUpdate({ dstFundingTx: lock_inj_on_src_chain.txHash })
    } catch (error) {
      console.error('❌ Gasless swap creation failed:', error)
      throw new Error(`Gasless swap creation failed: ${error}`)
    }

    const reverseOrder = Sdk.CrossChainOrder.new(
        new Address(escrowFactory),
          {
              salt: Sdk.randBigInt(1000),
              maker: new Address(evmResolverPublicKey), // resolver is maker
              makingAmount: parseUnits(takerAmountReq, 6), 
              takingAmount: parseUnits(makerAmountReq, 6), 
              makerAsset: new Address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"), // USDC
              takerAsset: new Address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48") // USDC
          },
          {
              hashLock: Sdk.HashLock.forSingleFill(secretBytesHex),
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

      // Step 3: Reverse Order Fill
      callbacks?.onStepUpdate('reverse_order', 'in_progress', undefined, 'Resolver filling reverse order on Ethereum...')
            
      const resolverTx = resolverContract.deploySrc(
              SWAP_CONFIG.source.chainId,
              reverseOrder,
              signature,
              Sdk.TakerTraits.default()
                  .setExtension(reverseOrder.extension)
                  .setAmountMode(Sdk.AmountMode.maker)
                  .setAmountThreshold(reverseOrder.takingAmount),
              reverseOrder.makingAmount
      )

      console.log('📤 DEPLOY TX REQUEST:', resolverTx)

    const transactionResponse = await ResolverWallet.sendTransaction({
                    ...resolverTx,
                    gasLimit: 10_000_000,

      })


      const receipt = await transactionResponse.wait(1)

      console.log('📜 Transaction receipt:', receipt)
      callbacks?.onStepUpdate('reverse_order', 'completed', receipt?.hash, 'Reverse order filled successfully')
      callbacks?.onSwapDataUpdate({ srcEscrowTx: receipt?.hash })

      const evmEscrowEvent = await srcFactory.parseSrcDeployEventFromReceipt(receipt)

      console.log('📋 EVM ESCROW EVENT:', evmEscrowEvent)
      // Extract the event from the receipt logs directly
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

      // Step 4: EVM Withdrawal
      callbacks?.onStepUpdate('evm_withdraw', 'in_progress', undefined, 'Resolver withdrawing from EVM escrow...')

      const resolverWithdrawTxRequest = resolverContract.withdraw('src', evmEscrowAddress, secretBytesHex, evmEscrowEvent[0])
      console.log('📤 WITHDRAW TX REQUEST:')
      console.log('To:', resolverWithdrawTxRequest.to)
      console.log('Data length:', resolverWithdrawTxRequest.data?.length)


      const withdrawTx = await ResolverWallet.sendTransaction(
      {
                ...resolverWithdrawTxRequest,
                gasLimit: 10_000_000,
                
            }
      )
      const withdrawReceipt = await withdrawTx.wait(1)

      const resolverWithdrawHash = withdrawReceipt?.hash

      console.log('✅ WITHDRAWAL TX SENT SUCCESSFULLY!')
      console.log('Withdrawal receipt:', withdrawReceipt)
      console.log('✅ WITHDRAWAL RESULT:')
      console.log(`[$] Resolver withdrawn funds in tx ${resolverWithdrawHash}`)
      callbacks?.onStepUpdate('evm_withdraw', 'completed', resolverWithdrawHash, 'EVM withdrawal completed')


    


        // Step 5: Final Transfer
        callbacks?.onStepUpdate('transfer', 'in_progress', undefined, 'Transferring funds to your wallet...')
        
        const transferTx = await ResolverWallet.sendTransaction({
          to: resolver, // resolver contract address
          data: transferTxData,
          gasLimit: 10_000_000
        })

        const transferReceipt = await transferTx.wait(1)

        console.log('Transfer tx hash:', transferReceipt?.hash)
        console.log(` ${metaMaskAddress}`)
        callbacks?.onStepUpdate('transfer', 'completed', transferReceipt?.hash, 'Funds transferred to your wallet')
        callbacks?.onSwapDataUpdate({ withdrawTx: transferReceipt?.hash })
                  


      // Step 6: Injective Claim
      callbacks?.onStepUpdate('inj_claim', 'in_progress', undefined, 'Resolver claiming on Injective...')
      
      const resolver_claim = await injective.claim_funds_with_params_resolver(
                    swapId,
                    secretBytes,
                    injectiveResolverPublicKey,
                    injectiveResolverMnemonic // Pass the mnemonic for Injective resolver
      )

      console.log('✅ Injective claim transaction sent successfully!')
      console.log('Claim receipt:',  resolver_claim)
      callbacks?.onStepUpdate('inj_claim', 'completed', resolver_claim, 'Resolver claimed on Injective')
      callbacks?.onSwapDataUpdate({ claimTx: resolver_claim })
      
      console.log('')
      console.log('🎉 GASLESS CROSS-CHAIN SWAP COMPLETED SUCCESSFULLY!')
      console.log('✅ User paid ZERO gas fees on Injective')
      console.log('✅ Fee grant handled via Next.js API (no browser issues)')
      console.log('✅ Funds transferred to user MetaMask wallet')
      console.log('💰 Resolver covered all transaction costs')
      console.log('')
}




           return {
  message: 'Source escrow deployed successfully'
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
      message: '',
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
