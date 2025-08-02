import 'dotenv/config'
import {expect, jest, describe, beforeAll, afterAll, it} from '@jest/globals'

import Sdk from '@1inch/cross-chain-sdk'
import {
    computeAddress,
    ContractFactory,
    ethers,
    JsonRpcProvider,
    MaxUint256,
    parseEther,
    parseUnits,
    Wallet as SignerWallet
} from 'ethers'

import {uint8ArrayToHex, UINT_40_MAX} from '@1inch/byte-utils'
import {ChainConfig, config} from './config'
import {Wallet} from './wallet'
import {Resolver} from './resolver'
import {EscrowFactory} from './escrow-factory'
import factoryContract from '../dist/contracts/TestEscrowFactory.sol/TestEscrowFactory.json'
import resolverContract from '../dist/contracts/Resolver.sol/Resolver.json'

import * as injective from './injective'
import { createHash } from 'crypto';
import { Network, getNetworkEndpoints } from '@injectivelabs/networks'
import { ChainGrpcWasmApi } from '@injectivelabs/sdk-ts'
import { InjectiveWallet } from './injective-wallet'

const {Address} = Sdk

jest.setTimeout(1000 * 60 * 3)

const userPk = '0x3897c33f920e4594c9321f78208b8cf1646f45fd807a78ef0985cc607eea4f51'
const resolverPk = '0x0a8453b8a66dc0e4cf0afcea4b961b6bcd4bd2d4d378c7512f8eb3a7aea255b3'

const userPublicAddress = "0xaA83fCB728c9d1e039B35DeDB8a18736A50ab6EE"
const resolverPublicAddress = "0x54E13447C59e6d0b844c8e2af22479b7ccc7D47D"


const ownerPrivateKey = '0x8bc5e2d9a1ec77c51fd83dc78622222c8b2f1eadaa361eae31409a702ec21c27'

const injectiveUserPk = "snap half peasant letter empty kid cement vast comic trigger goat speed explain frog busy sand dial quote victory crew detail airport recall chef"
const injectiveResolverPk = "soda giggle lobster frown sponsor bridge follow firm fashion buddy final this crawl junior burst race differ school pupil bleak above economy toy chunk"

const address2 = "inj12nnymkfwlr6c6c5ksmrq29nlh4x0pmls6xmkc9"
const resolverAddress = "inj1rfhgjga07nkn5kmw7macwathepxew3rfndtw45"
// eslint-disable-next-line max-lines-per-function

describe('Resolving example', () => {
    const srcChainId = config.chain.source.chainId
    const dstChainId = config.chain.destination.chainId

    type EthereumChain = {
        provider: JsonRpcProvider
        escrowFactory: string
        resolver: string
        type: 'ethereum'
   }

    type InjectiveChain = {
        provider: ChainGrpcWasmApi
        escrowFactory: string  // This will be a contract address on Injective
        resolver: string       // This will be a contract address on Injective
        type: 'injective-888'
    }

    let src: EthereumChain
    let dst: InjectiveChain

    let srcChainUser: Wallet
    let dstChainUser: InjectiveWallet

    let srcChainResolver: Wallet
    let dstChainResolver: InjectiveWallet

    let srcFactory: EscrowFactory
    let dstFactory: EscrowFactory // This will be an escrow contract address on Injective

    let srcResolverContract: Wallet
    let dstResolverContract: Wallet | undefined // Made optional since it's not initialized for Injective

    let srcTimestamp: bigint

    async function increaseTime(t: number): Promise<void> {
        // removed destination
        await Promise.all([src].map((chain) => chain.provider.send('evm_increaseTime', [t])))
    }
    
    beforeAll(async () => {
        ;[src, dst] = await Promise.all([initChain(config.chain.source), initChain(config.chain.destination)])
        
        srcChainUser = new Wallet(userPk, src.provider)
        dstChainUser = new InjectiveWallet(injectiveUserPk)
        

        srcChainResolver = new Wallet(resolverPk, src.provider)
        dstChainResolver = new InjectiveWallet(injectiveResolverPk)


       
        srcFactory = new EscrowFactory(src.provider, src.escrowFactory)
        //dstFactory = new EscrowFactory(dst.provider, dst.escrowFactory)
 
        await srcChainUser.approveToken(
            config.chain.source.tokens.USDC.address,
            config.chain.source.limitOrderProtocol,
            MaxUint256
        )

        await srcChainResolver.approveToken(
            config.chain.source.tokens.USDC.address,
            config.chain.source.limitOrderProtocol,
            MaxUint256
        )
        console.log("Resolver funded and approved USDC")

     
        srcResolverContract = srcChainResolver  // Use the existing resolver wallet
        //dstResolverContract = dstChainResolver  // Use the existing resolver wallet

        srcTimestamp = BigInt((await src.provider.getBlock('latest'))!.timestamp)
    })

    // eslint-disable-next-line max-lines-per-function
    describe('Fill', () => {
  
        it.skip('should swap ETH USDC -> INJ. Single fill only ', async () => {
            const swapId = `swap-${Date.now()}`
            const secretBytes = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
            const secretBytesX = uint8ArrayToHex(Buffer.from(secretBytes, 'hex')) // This will automatically include "0x" prefix

            console.log('🔧 TEST SETUP:')
            console.log('Swap ID:', swapId)
            console.log('Secret bytes (raw):', secretBytes)
            console.log('Secret bytes (hex with 0x):', secretBytesX)
            console.log('User address:', await srcChainUser.getAddress())
            console.log('Resolver address:', await srcChainResolver.getAddress())

             const order = Sdk.CrossChainOrder.new(
                new Address(src.escrowFactory),
                {
                    salt: Sdk.randBigInt(1000n),
                    maker: new Address(await srcChainUser.getAddress()),
                    makingAmount: parseUnits('1', 6),
                    takingAmount: parseUnits('1', 6),
                    makerAsset: new Address(config.chain.source.tokens.USDC.address),
                    takerAsset: new Address(config.chain.source.tokens.USDC.address) 
                },
                {
                    hashLock: Sdk.HashLock.forSingleFill(secretBytesX),
                    timeLocks: Sdk.TimeLocks.new({
                        srcWithdrawal: 10n, // 10sec finality lock for test
                        srcPublicWithdrawal: 120n, // 2m for private withdrawal
                        srcCancellation: 121n, // 1sec public withdrawal
                        srcPublicCancellation: 122n, // 1sec private cancellation
                        dstWithdrawal: 10n, // 10sec finality lock for test
                        dstPublicWithdrawal: 100n, // 100sec private withdrawal
                        dstCancellation: 101n // 1sec public withdrawal
                    }),
                    srcChainId: Sdk.NetworkEnum.ETHEREUM,
                    dstChainId: Sdk.NetworkEnum.COINBASE, // temporary, should add aptos to supported chains
                    srcSafetyDeposit: parseEther('0.001'),
                    dstSafetyDeposit: parseEther('0.001')
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
                            address: new Address(src.resolver),
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
            
            console.log('📋 ORDER CREATED:')
            console.log('Order salt:', order.salt.toString())
            console.log('Order maker:', order.maker.toString())
            console.log('Order making amount:', order.makingAmount.toString())
            console.log('Order taking amount:', order.takingAmount.toString())
            console.log('Order maker asset:', order.makerAsset.toString())
            console.log('Order taker asset:', order.takerAsset.toString())
            console.log('Src safety deposit:', order.escrowExtension.srcSafetyDeposit.toString())
            console.log('Time locks created with srcWithdrawal: 10 seconds')
            
            const signature = await srcChainUser.signOrder(srcChainId, order)
            const orderHash = order.getOrderHash(srcChainId)

            console.log('✍️ ORDER SIGNED:')
            console.log('Signature:', signature)
            console.log('Order hash:', orderHash)

           
           // const resolverContract = new Resolver(src.resolver, dst.resolver)
            console.log(`[${srcChainId}]`, `Filling order ${orderHash}`)
            const fillAmount = order.makingAmount

            console.log('💰 FILL PARAMETERS:')
            console.log('Fill amount:', fillAmount.toString())
            console.log('Resolver contract src address:', src.resolver)
            console.log('Resolver contract dst address:', dst.resolver)

        
            const resolverContract = new Resolver(src.resolver, dst.resolver)

            // Step 2: Deploy source escrow on EVM side using 1inch SDK
            console.log(`[${srcChainId}] Deploying source escrow for order ${orderHash}`)
            
            console.log('🚀 DEPLOY SRC PARAMETERS:')
            const takerTraits = Sdk.TakerTraits.default()
                .setExtension(order.extension)
                .setAmountMode(Sdk.AmountMode.maker)
                .setAmountThreshold(order.takingAmount)
            
            const {args, trait} = takerTraits.encode()
            console.log('Taker traits value:', trait.toString())
            console.log('Taker traits args:', args)
            console.log('Chain ID:', srcChainId)
            console.log('Order extension:', order.extension)
            console.log('Amount mode:', Sdk.AmountMode.maker)
            console.log('Amount threshold:', order.takingAmount.toString())
            
            const deployTxRequest = resolverContract.deploySrc(
                srcChainId,
                order,
                signature,
                takerTraits,
                fillAmount
            )
            
            console.log('📤 DEPLOY TX REQUEST:')
            console.log('To:', deployTxRequest.to)
            console.log('Value:', deployTxRequest.value?.toString())
            console.log('Data length:', deployTxRequest.data?.length)
            
            const {txHash: orderFillHash, blockHash: srcDeployBlock} = await srcChainResolver.send(deployTxRequest)
            
            console.log('✅ TRANSACTION SENT:')
            console.log('Transaction hash:', orderFillHash)
            console.log('Block hash:', srcDeployBlock)



            console.log('✅ DEPLOY SRC RESULT:')
            console.log(`[${srcChainId}] Source escrow deployed in tx ${orderFillHash}`)
            console.log('Block hash:', srcDeployBlock)
            
            const srcEscrowEvent = await srcFactory.getSrcDeployEvent(srcDeployBlock)
            console.log('📋 SRC ESCROW EVENT:')
            console.log('Escrow event immutables:', srcEscrowEvent[0])

            // Step 3: Fund destination escrow on Injective using your custom contract
            const address2 = "inj12nnymkfwlr6c6c5ksmrq29nlh4x0pmls6xmkc9"
            console.log(`[${dstChainId}] Funding Injective atomic swap contract`)
            
            console.log('💰 INJECTIVE FUNDING PARAMETERS:')
            console.log('Secret bytes (raw):', secretBytes)
            console.log('Fill amount:', fillAmount.toString())
            console.log('Recipient address:', address2)
            console.log('Expiry height:', 90_000_000)
            console.log('Swap ID:', swapId)

              const hash = createHash('sha256').update(Buffer.from(secretBytes, 'hex')).digest('hex')

            await injective.fund_dst_escrow_with_params(

                hash, // Pass the raw secret to generate the hash
                fillAmount.toString(),
                address2, // recipient (user's Injective address)
                90_000_000, // expiry height
                swapId
            )

            // Step 4: Wait for finality lock to pass
            console.log('⏰ WAITING FOR FINALITY LOCK:')
            console.log('Increasing time by 11 seconds...')
            await increaseTime(11)
            console.log('✅ Time increased, finality lock should be passed')

            // Step 5: User claims funds on Injective by revealing the secret
            console.log(`[${dstChainId}] User claiming funds on Injective`)

            console.log('🔓 INJECTIVE CLAIM PARAMETERS:')
            console.log('Swap ID:', swapId)
            console.log('Secret bytes (raw for preimage):', secretBytes)
            console.log('Recipient address:', address2)

            await injective.claim_funds_with_params(
                swapId,
                secretBytes, // raw secret as preimage,
                address2
            )
            
            // Step 6: Resolver withdraws from EVM source escrow using the same secret
            const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl()
            const srcEscrowAddress = new Sdk.EscrowFactory(new Address(src.escrowFactory)).getSrcEscrowAddress(
                srcEscrowEvent[0],
                ESCROW_SRC_IMPLEMENTATION
            )
            
            console.log('🏦 WITHDRAWAL SETUP:')
            console.log('Escrow src implementation:', ESCROW_SRC_IMPLEMENTATION)
            console.log('Calculated src escrow address:', srcEscrowAddress.toString())
            console.log('Escrow factory address:', src.escrowFactory)
            
            console.log(`[${srcChainId}] Resolver withdrawing from source escrow ${srcEscrowAddress}`)
            
            console.log('💸 WITHDRAWAL PARAMETERS:')
            console.log('Withdrawal side:', 'src')
            console.log('Escrow address:', srcEscrowAddress.toString())
            console.log('Secret (with 0x prefix):', secretBytesX)
            console.log('Immutables from event:', srcEscrowEvent[0])
            console.log('Resolver address calling withdraw:', await srcChainResolver.getAddress())
            
            const withdrawTxRequest = resolverContract.withdraw('src', srcEscrowAddress, secretBytesX, srcEscrowEvent[0])
            
            console.log('📤 WITHDRAW TX REQUEST:')
            console.log('To:', withdrawTxRequest.to)
            console.log('Data length:', withdrawTxRequest.data?.length)
            
            const {txHash: resolverWithdrawHash} = await srcChainResolver.send(withdrawTxRequest)
            
            console.log('✅ WITHDRAWAL RESULT:')
            console.log(`[${srcChainId}] Resolver withdrawn funds in tx ${resolverWithdrawHash}`)
           
        }) 


  
        it('should swap CW20 Injective MYTOKEN -> EVM USDC. Single fill only ', async () => {
            const swapId = `swip-${Date.now()}`
            const secretBytes = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
            const secretBytesX = uint8ArrayToHex(Buffer.from(secretBytes, 'hex'))
            const secret = createHash('sha256').update(Buffer.from(secretBytes, 'hex')).digest('hex')
        
            // Step 1: User creates atomic swap on Injective first
            console.log(`[${dstChainId}] User creating atomic swap on Injective`)
            
            await injective.fund_dst_escrow_with_params(
                secretBytes, 
                "1000000", // 1 CUSDC (6 decimals)
                address2, // EVM user address as recipient
                90_000_000, // expiry height
                swapId
            )
        
            // Step 2: Create order where USER is maker, but RESOLVER provides the funds
            // This maintains the correct roles for the resolver contract
            console.log(`[${srcChainId}] Creating EVM order for reverse flow`)
            
            const resolverContract = new Resolver(src.resolver, dst.resolver)
            
            // Create order where user is maker (even though resolver provides funds)
            const reverseOrder = Sdk.CrossChainOrder.new(
                new Address(src.escrowFactory),
                {
                    salt: Sdk.randBigInt(1000n),
                    maker: new Address(await srcChainUser.getAddress()), // User is maker
                    makingAmount: parseUnits('1', 6), // 1 USDC  
                    takingAmount: parseUnits('1', 6), // 1 CUSDC equivalent
                    makerAsset: new Address(config.chain.source.tokens.USDC.address),
                    takerAsset: new Address(config.chain.source.tokens.USDC.address) // Dummy
                },
                {
                    hashLock: Sdk.HashLock.forSingleFill(secretBytesX),
                    timeLocks: Sdk.TimeLocks.new({
                        srcWithdrawal: 10n,
                        srcPublicWithdrawal: 120n,
                        srcCancellation: 121n,
                        srcPublicCancellation: 122n,
                        dstWithdrawal: 10n,
                        dstPublicWithdrawal: 100n,
                        dstCancellation: 101n
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
                        duration: 120n,
                        startTime: srcTimestamp
                    }),
                    whitelist: [
                        {
                            address: new Address(src.resolver), // Resolver can fill
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
        
            // Step 3: User signs the order (but won't provide funds)
            const userSignature = await srcChainUser.signOrder(srcChainId, reverseOrder)
        
            // Step 4: Resolver fills the order (providing USDC)
            console.log(`[${srcChainId}] Resolver filling reverse order`)
            
            const {txHash: evmEscrowHash, blockHash: evmDeployBlock} = await srcChainResolver.send(
                resolverContract.deploySrc(
                    srcChainId,
                    reverseOrder,
                    userSignature,
                    Sdk.TakerTraits.default()
                        .setExtension(reverseOrder.extension)
                        .setAmountMode(Sdk.AmountMode.maker)
                        .setAmountThreshold(reverseOrder.takingAmount),
                    reverseOrder.makingAmount
                )
            )
            
            console.log(`[${srcChainId}] EVM escrow deployed in tx ${evmEscrowHash}`)
            const evmEscrowEvent = await srcFactory.getSrcDeployEvent(evmDeployBlock)
        
            // Step 5: Wait for finality
            await increaseTime(11)
        
            // Step 6: User claims USDC from EVM by revealing the secret
            console.log(`[${srcChainId}] User claiming USDC from EVM escrow`)
            
            const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl()
            const evmEscrowAddress = new Sdk.EscrowFactory(new Address(src.escrowFactory)).getSrcEscrowAddress(
                evmEscrowEvent[0],
                ESCROW_SRC_IMPLEMENTATION
            )
            
            const {txHash: userClaimHash} = await srcChainUser.send(
                resolverContract.withdraw('src', evmEscrowAddress, secretBytesX, evmEscrowEvent[0])
            )
            
            console.log(`[${srcChainId}] User claimed USDC in tx ${userClaimHash}`)
        
            // Step 7: Resolver claims CUSDC from Injective using the revealed secret
            console.log(`[${dstChainId}] Resolver claiming CUSDC from Injective`)
            
            await injective.claim_funds_with_params_resolver(
                swapId,
                secretBytes,
                resolverAddress
            )
            
            console.log(`✅ Reverse swap completed: Injective CUSDC → EVM USDC`)
        }) 






        // it('should swap Ethereum USDC -> Bsc USDC. Multiple fills. Fill 100%', async () => {
        //     const initialBalances = await getBalances(
        //         config.chain.source.tokens.USDC.address,
        //         config.chain.destination.tokens.USDC.address
        //     )

        //     // User creates order
        //     // 11 secrets
        //     const secrets = Array.from({length: 11}).map(() => uint8ArrayToHex(randomBytes(32))) // note: use crypto secure random number in the real world
        //     const secretHashes = secrets.map((s) => Sdk.HashLock.hashSecret(s))
        //     const leaves = Sdk.HashLock.getMerkleLeaves(secrets)
        //     const order = Sdk.CrossChainOrder.new(
        //         new Address(src.escrowFactory),
        //         {
        //             salt: Sdk.randBigInt(1000n),
        //             maker: new Address(await srcChainUser.getAddress()),
        //             makingAmount: parseUnits('100', 6),
        //             takingAmount: parseUnits('99', 6),
        //             makerAsset: new Address(config.chain.source.tokens.USDC.address),
        //             takerAsset: new Address(config.chain.destination.tokens.USDC.address)
        //         },
        //         {
        //             hashLock: Sdk.HashLock.forMultipleFills(leaves),
        //             timeLocks: Sdk.TimeLocks.new({
        //                 srcWithdrawal: 10n, // 10s finality lock for test
        //                 srcPublicWithdrawal: 120n, // 2m for private withdrawal
        //                 srcCancellation: 121n, // 1sec public withdrawal
        //                 srcPublicCancellation: 122n, // 1sec private cancellation
        //                 dstWithdrawal: 10n, // 10s finality lock for test
        //                 dstPublicWithdrawal: 100n, // 100sec private withdrawal
        //                 dstCancellation: 101n // 1sec public withdrawal
        //             }),
        //             srcChainId,
        //             dstChainId,
        //             srcSafetyDeposit: parseEther('0.001'),
        //             dstSafetyDeposit: parseEther('0.001')
        //         },
        //         {
        //             auction: new Sdk.AuctionDetails({
        //                 initialRateBump: 0,
        //                 points: [],
        //                 duration: 120n,
        //                 startTime: srcTimestamp
        //             }),
        //             whitelist: [
        //                 {
        //                     address: new Address(src.resolver),
        //                     allowFrom: 0n
        //                 }
        //             ],
        //             resolvingStartTime: 0n
        //         },
        //         {
        //             nonce: Sdk.randBigInt(UINT_40_MAX),
        //             allowPartialFills: true,
        //             allowMultipleFills: true
        //         }
        //     )

        //     const signature = await srcChainUser.signOrder(srcChainId, order)
        //     const orderHash = order.getOrderHash(srcChainId)
        //     // Resolver fills order
        //     const resolverContract = new Resolver(src.resolver, dst.resolver)

        //     console.log(`[${srcChainId}]`, `Filling order ${orderHash}`)

        //     const fillAmount = order.makingAmount
        //     const idx = secrets.length - 1 // last index to fulfill
        //     // Number((BigInt(secrets.length - 1) * (fillAmount - 1n)) / order.makingAmount)

        //     const {txHash: orderFillHash, blockHash: srcDeployBlock} = await srcChainResolver.send(
        //         resolverContract.deploySrc(
        //             srcChainId,
        //             order,
        //             signature,
        //             Sdk.TakerTraits.default()
        //                 .setExtension(order.extension)
        //                 .setInteraction(
        //                     new Sdk.EscrowFactory(new Address(src.escrowFactory)).getMultipleFillInteraction(
        //                         Sdk.HashLock.getProof(leaves, idx),
        //                         idx,
        //                         secretHashes[idx]
        //                     )
        //                 )
        //                 .setAmountMode(Sdk.AmountMode.maker)
        //                 .setAmountThreshold(order.takingAmount),
        //             fillAmount,
        //             Sdk.HashLock.fromString(secretHashes[idx])
        //         )
        //     )

        //     console.log(`[${srcChainId}]`, `Order ${orderHash} filled for ${fillAmount} in tx ${orderFillHash}`)

        //     const srcEscrowEvent = await srcFactory.getSrcDeployEvent(srcDeployBlock)

        //     const dstImmutables = srcEscrowEvent[0]
        //         .withComplement(srcEscrowEvent[1])
        //         .withTaker(new Address(resolverContract.dstAddress))

        //     console.log(`[${dstChainId}]`, `Depositing ${dstImmutables.amount} for order ${orderHash}`)
        //     const {txHash: dstDepositHash, blockTimestamp: dstDeployedAt} = await dstChainResolver.send(
        //         resolverContract.deployDst(dstImmutables)
        //     )
        //     console.log(`[${dstChainId}]`, `Created dst deposit for order ${orderHash} in tx ${dstDepositHash}`)

        //     const secret = secrets[idx]

        //     const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl()
        //     const ESCROW_DST_IMPLEMENTATION = await dstFactory.getDestinationImpl()

        //     const srcEscrowAddress = new Sdk.EscrowFactory(new Address(src.escrowFactory)).getSrcEscrowAddress(
        //         srcEscrowEvent[0],
        //         ESCROW_SRC_IMPLEMENTATION
        //     )

        //     const dstEscrowAddress = new Sdk.EscrowFactory(new Address(dst.escrowFactory)).getDstEscrowAddress(
        //         srcEscrowEvent[0],
        //         srcEscrowEvent[1],
        //         dstDeployedAt,
        //         new Address(resolverContract.dstAddress),
        //         ESCROW_DST_IMPLEMENTATION
        //     )

        //     await increaseTime(11) // finality lock passed
        //     // User shares key after validation of dst escrow deployment
        //     console.log(`[${dstChainId}]`, `Withdrawing funds for user from ${dstEscrowAddress}`)
        //     await dstChainResolver.send(
        //         resolverContract.withdraw('dst', dstEscrowAddress, secret, dstImmutables.withDeployedAt(dstDeployedAt))
        //     )

        //     console.log(`[${srcChainId}]`, `Withdrawing funds for resolver from ${srcEscrowAddress}`)
        //     const {txHash: resolverWithdrawHash} = await srcChainResolver.send(
        //         resolverContract.withdraw('src', srcEscrowAddress, secret, srcEscrowEvent[0])
        //     )
        //     console.log(
        //         `[${srcChainId}]`,
        //         `Withdrew funds for resolver from ${srcEscrowAddress} to ${src.resolver} in tx ${resolverWithdrawHash}`
        //     )

        //     const resultBalances = await getBalances(
        //         config.chain.source.tokens.USDC.address,
        //         config.chain.destination.tokens.USDC.address
        //     )

        //     // user transferred funds to resolver on the source chain
        //     expect(initialBalances.src.user - resultBalances.src.user).toBe(order.makingAmount)
        //     expect(resultBalances.src.resolver - initialBalances.src.resolver).toBe(order.makingAmount)
        //     // resolver transferred funds to user on the destination chain
        //     expect(resultBalances.dst.user - initialBalances.dst.user).toBe(order.takingAmount)
        //     expect(initialBalances.dst.resolver - resultBalances.dst.resolver).toBe(order.takingAmount)
        // })

        // it('should swap Ethereum USDC -> Bsc USDC. Multiple fills. Fill 50%', async () => {
        //     const initialBalances = await getBalances(
        //         config.chain.source.tokens.USDC.address,
        //         config.chain.destination.tokens.USDC.address
        //     )

        //     // User creates order
        //     // 11 secrets
        //     const secrets = Array.from({length: 11}).map(() => uint8ArrayToHex(randomBytes(32))) // note: use crypto secure random number in the real world
        //     const secretHashes = secrets.map((s) => Sdk.HashLock.hashSecret(s))
        //     const leaves = Sdk.HashLock.getMerkleLeaves(secrets)
        //     const order = Sdk.CrossChainOrder.new(
        //         new Address(src.escrowFactory),
        //         {
        //             salt: Sdk.randBigInt(1000n),
        //             maker: new Address(await srcChainUser.getAddress()),
        //             makingAmount: parseUnits('100', 6),
        //             takingAmount: parseUnits('99', 6),
        //             makerAsset: new Address(config.chain.source.tokens.USDC.address),
        //             takerAsset: new Address(config.chain.destination.tokens.USDC.address)
        //         },
        //         {
        //             hashLock: Sdk.HashLock.forMultipleFills(leaves),
        //             timeLocks: Sdk.TimeLocks.new({
        //                 srcWithdrawal: 10n, // 10s finality lock for test
        //                 srcPublicWithdrawal: 120n, // 2m for private withdrawal
        //                 srcCancellation: 121n, // 1sec public withdrawal
        //                 srcPublicCancellation: 122n, // 1sec private cancellation
        //                 dstWithdrawal: 10n, // 10s finality lock for test
        //                 dstPublicWithdrawal: 100n, // 100sec private withdrawal
        //                 dstCancellation: 101n // 1sec public withdrawal
        //             }),
        //             srcChainId,
        //             dstChainId,
        //             srcSafetyDeposit: parseEther('0.001'),
        //             dstSafetyDeposit: parseEther('0.001')
        //         },
        //         {
        //             auction: new Sdk.AuctionDetails({
        //                 initialRateBump: 0,
        //                 points: [],
        //                 duration: 120n,
        //                 startTime: srcTimestamp
        //             }),
        //             whitelist: [
        //                 {
        //                     address: new Address(src.resolver),
        //                     allowFrom: 0n
        //                 }
        //             ],
        //             resolvingStartTime: 0n
        //         },
        //         {
        //             nonce: Sdk.randBigInt(UINT_40_MAX),
        //             allowPartialFills: true,
        //             allowMultipleFills: true
        //         }
        //     )

        //     const signature = await srcChainUser.signOrder(srcChainId, order)
        //     const orderHash = order.getOrderHash(srcChainId)
        //     // Resolver fills order
        //     const resolverContract = new Resolver(src.resolver, dst.resolver)

        //     console.log(`[${srcChainId}]`, `Filling order ${orderHash}`)

        //     const fillAmount = order.makingAmount / 2n
        //     const idx = Number((BigInt(secrets.length - 1) * (fillAmount - 1n)) / order.makingAmount)

        //     const {txHash: orderFillHash, blockHash: srcDeployBlock} = await srcChainResolver.send(
        //         resolverContract.deploySrc(
        //             srcChainId,
        //             order,
        //             signature,
        //             Sdk.TakerTraits.default()
        //                 .setExtension(order.extension)
        //                 .setInteraction(
        //                     new Sdk.EscrowFactory(new Address(src.escrowFactory)).getMultipleFillInteraction(
        //                         Sdk.HashLock.getProof(leaves, idx),
        //                         idx,
        //                         secretHashes[idx]
        //                     )
        //                 )
        //                 .setAmountMode(Sdk.AmountMode.maker)
        //                 .setAmountThreshold(order.takingAmount),
        //             fillAmount,
        //             Sdk.HashLock.fromString(secretHashes[idx])
        //         )
        //     )

        //     console.log(`[${srcChainId}]`, `Order ${orderHash} filled for ${fillAmount} in tx ${orderFillHash}`)

        //     const srcEscrowEvent = await srcFactory.getSrcDeployEvent(srcDeployBlock)

        //     const dstImmutables = srcEscrowEvent[0]
        //         .withComplement(srcEscrowEvent[1])
        //         .withTaker(new Address(resolverContract.dstAddress))

        //     console.log(`[${dstChainId}]`, `Depositing ${dstImmutables.amount} for order ${orderHash}`)
        //     const {txHash: dstDepositHash, blockTimestamp: dstDeployedAt} = await dstChainResolver.send(
        //         resolverContract.deployDst(dstImmutables)
        //     )
        //     console.log(`[${dstChainId}]`, `Created dst deposit for order ${orderHash} in tx ${dstDepositHash}`)

        //     const secret = secrets[idx]

        //     const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl()
        //     const ESCROW_DST_IMPLEMENTATION = await dstFactory.getDestinationImpl()

        //     const srcEscrowAddress = new Sdk.EscrowFactory(new Address(src.escrowFactory)).getSrcEscrowAddress(
        //         srcEscrowEvent[0],
        //         ESCROW_SRC_IMPLEMENTATION
        //     )

        //     const dstEscrowAddress = new Sdk.EscrowFactory(new Address(dst.escrowFactory)).getDstEscrowAddress(
        //         srcEscrowEvent[0],
        //         srcEscrowEvent[1],
        //         dstDeployedAt,
        //         new Address(resolverContract.dstAddress),
        //         ESCROW_DST_IMPLEMENTATION
        //     )

        //     await increaseTime(11) // finality lock passed
        //     // User shares key after validation of dst escrow deployment
        //     console.log(`[${dstChainId}]`, `Withdrawing funds for user from ${dstEscrowAddress}`)
        //     await dstChainResolver.send(
        //         resolverContract.withdraw('dst', dstEscrowAddress, secret, dstImmutables.withDeployedAt(dstDeployedAt))
        //     )

        //     console.log(`[${srcChainId}]`, `Withdrawing funds for resolver from ${srcEscrowAddress}`)
        //     const {txHash: resolverWithdrawHash} = await srcChainResolver.send(
        //         resolverContract.withdraw('src', srcEscrowAddress, secret, srcEscrowEvent[0])
        //     )
        //     console.log(
        //         `[${srcChainId}]`,
        //         `Withdrew funds for resolver from ${srcEscrowAddress} to ${src.resolver} in tx ${resolverWithdrawHash}`
        //     )

        //     const resultBalances = await getBalances(
        //         config.chain.source.tokens.USDC.address,
        //         config.chain.destination.tokens.USDC.address
        //     )

        //     // user transferred funds to resolver on the source chain
        //     expect(initialBalances.src.user - resultBalances.src.user).toBe(fillAmount)
        //     expect(resultBalances.src.resolver - initialBalances.src.resolver).toBe(fillAmount)
        //     // resolver transferred funds to user on the destination chain
        //     const dstAmount = (order.takingAmount * fillAmount) / order.makingAmount
        //     expect(resultBalances.dst.user - initialBalances.dst.user).toBe(dstAmount)
        //     expect(initialBalances.dst.resolver - resultBalances.dst.resolver).toBe(dstAmount)
        // })
    })
    // describe('Cancel', () => {
    //     it('should cancel swap Ethereum USDC -> Bsc USDC', async () => {
    //         const initialBalances = await getBalances(
    //             config.chain.source.tokens.USDC.address,
    //             config.chain.destination.tokens.USDC.address
    //         )

    //         // User creates order
    //         const hashLock = Sdk.HashLock.forSingleFill(uint8ArrayToHex(randomBytes(32))) // note: use crypto secure random number in real world
    //         const order = Sdk.CrossChainOrder.new(
    //             new Address(src.escrowFactory),
    //             {
    //                 salt: Sdk.randBigInt(1000n),
    //                 maker: new Address(await srcChainUser.getAddress()),
    //                 makingAmount: parseUnits('100', 6),
    //                 takingAmount: parseUnits('99', 6),
    //                 makerAsset: new Address(config.chain.source.tokens.USDC.address),
    //                 takerAsset: new Address(config.chain.destination.tokens.USDC.address)
    //             },
    //             {
    //                 hashLock,
    //                 timeLocks: Sdk.TimeLocks.new({
    //                     srcWithdrawal: 0n, // no finality lock for test
    //                     srcPublicWithdrawal: 120n, // 2m for private withdrawal
    //                     srcCancellation: 121n, // 1sec public withdrawal
    //                     srcPublicCancellation: 122n, // 1sec private cancellation
    //                     dstWithdrawal: 0n, // no finality lock for test
    //                     dstPublicWithdrawal: 100n, // 100sec private withdrawal
    //                     dstCancellation: 101n // 1sec public withdrawal
    //                 }),
    //                 srcChainId,
    //                 dstChainId,
    //                 srcSafetyDeposit: parseEther('0.001'),
    //                 dstSafetyDeposit: parseEther('0.001')
    //             },
    //             {
    //                 auction: new Sdk.AuctionDetails({
    //                     initialRateBump: 0,
    //                     points: [],
    //                     duration: 120n,
    //                     startTime: srcTimestamp
    //                 }),
    //                 whitelist: [
    //                     {
    //                         address: new Address(src.resolver),
    //                         allowFrom: 0n
    //                     }
    //                 ],
    //                 resolvingStartTime: 0n
    //             },
    //             {
    //                 nonce: Sdk.randBigInt(UINT_40_MAX),
    //                 allowPartialFills: false,
    //                 allowMultipleFills: false
    //             }
    //         )

    //         const signature = await srcChainUser.signOrder(srcChainId, order)
    //         const orderHash = order.getOrderHash(srcChainId)
    //         // Resolver fills order
    //         const resolverContract = new Resolver(src.resolver, dst.resolver)

    //         console.log(`[${srcChainId}]`, `Filling order ${orderHash}`)

    //         const fillAmount = order.makingAmount
    //         const {txHash: orderFillHash, blockHash: srcDeployBlock} = await srcChainResolver.send(
    //             resolverContract.deploySrc(
    //                 srcChainId,
    //                 order,
    //                 signature,
    //                 Sdk.TakerTraits.default()
    //                     .setExtension(order.extension)
    //                     .setAmountMode(Sdk.AmountMode.maker)
    //                     .setAmountThreshold(order.takingAmount),
    //                 fillAmount
    //             )
    //         )

    //         console.log(`[${srcChainId}]`, `Order ${orderHash} filled for ${fillAmount} in tx ${orderFillHash}`)

    //         const srcEscrowEvent = await srcFactory.getSrcDeployEvent(srcDeployBlock)

    //         const dstImmutables = srcEscrowEvent[0]
    //             .withComplement(srcEscrowEvent[1])
    //             .withTaker(new Address(resolverContract.dstAddress))

    //         console.log(`[${dstChainId}]`, `Depositing ${dstImmutables.amount} for order ${orderHash}`)
    //         const {txHash: dstDepositHash, blockTimestamp: dstDeployedAt} = await dstChainResolver.send(
    //             resolverContract.deployDst(dstImmutables)
    //         )
    //         console.log(`[${dstChainId}]`, `Created dst deposit for order ${orderHash} in tx ${dstDepositHash}`)

    //         const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl()
    //         const ESCROW_DST_IMPLEMENTATION = await dstFactory.getDestinationImpl()

    //         const srcEscrowAddress = new Sdk.EscrowFactory(new Address(src.escrowFactory)).getSrcEscrowAddress(
    //             srcEscrowEvent[0],
    //             ESCROW_SRC_IMPLEMENTATION
    //         )

    //         const dstEscrowAddress = new Sdk.EscrowFactory(new Address(dst.escrowFactory)).getDstEscrowAddress(
    //             srcEscrowEvent[0],
    //             srcEscrowEvent[1],
    //             dstDeployedAt,
    //             new Address(resolverContract.dstAddress),
    //             ESCROW_DST_IMPLEMENTATION
    //         )

    //         await increaseTime(125)
    //         // user does not share secret, so cancel both escrows
    //         console.log(`[${dstChainId}]`, `Cancelling dst escrow ${dstEscrowAddress}`)
    //         await dstChainResolver.send(
    //             resolverContract.cancel('dst', dstEscrowAddress, dstImmutables.withDeployedAt(dstDeployedAt))
    //         )

    //         console.log(`[${srcChainId}]`, `Cancelling src escrow ${srcEscrowAddress}`)
    //         const {txHash: cancelSrcEscrow} = await srcChainResolver.send(
    //             resolverContract.cancel('src', srcEscrowAddress, srcEscrowEvent[0])
    //         )
    //         console.log(`[${srcChainId}]`, `Cancelled src escrow ${srcEscrowAddress} in tx ${cancelSrcEscrow}`)

    //         const resultBalances = await getBalances(
    //             config.chain.source.tokens.USDC.address,
    //             config.chain.destination.tokens.USDC.address
    //         )

    //         expect(initialBalances).toEqual(resultBalances)
    //     })
    // })
})

async function initChain(cnf: ChainConfig): Promise<any> {
    const { provider} = await getProvider(cnf)

    if (cnf.chainId == "injective-888") {
        return await initInjectiveChain(cnf, provider as ChainGrpcWasmApi)
    } else {
        return await initEthereumChain(cnf, provider as JsonRpcProvider)
    }
}

async function initEthereumChain(
    cnf: ChainConfig, 
    provider: JsonRpcProvider, 
   
):  Promise<{ provider: JsonRpcProvider; escrowFactory: string; resolver: string}> {
    
    // ✅ Option 1: Use shared deployment if available (to match webapp)
    
    
    // ✅ Option 2: Deploy fresh contracts (default behavior)
    console.log(`[${cnf.chainId}] Deploying fresh contracts (test default)`)
    const deployer = new SignerWallet(cnf.ownerPrivateKey, provider)

    // deploy EscrowFactory
    const escrowFactory = await deploy(
        factoryContract,
        [
            cnf.limitOrderProtocol,
            cnf.wrappedNative, // feeToken,
            Address.fromBigInt(0n).toString(), // accessToken,
            deployer.address, // owner
            60 * 30, // src rescue delay
            60 * 30 // dst rescue delay
        ],
        provider,
        deployer
    )
    console.log(`[${cnf.chainId}]`, `Escrow factory contract deployed to`, escrowFactory)

    // deploy Resolver contract
    const resolver = await deploy(
        resolverContract,
        [
            escrowFactory,
            cnf.limitOrderProtocol,
            computeAddress(resolverPk) // resolver as owner of contract
        ],
        provider,
        deployer
    )
    console.log(`[${cnf.chainId}]`, `Resolver contract deployed to`, resolver)

    return { provider, resolver, escrowFactory}
}


async function initInjectiveChain(
  cnf: ChainConfig,
  provider: ChainGrpcWasmApi
): Promise<{
  
  provider: ChainGrpcWasmApi
  escrowFactory: string
  resolver: string
}> {
  // Use hardcoded values for your Injective testnet
  const escrowFactory = process.env.CW_20_AESCROW_CONTRACT_ADDRESS as string
  const resolver = process.env.RESOLVER_ADDRESS as string // define this if needed
  console.log(`[${cnf.chainId}]`, `Injective escrow factory at`, escrowFactory)
  console.log(`[${cnf.chainId}]`, `Resolver logic handled off-chain or injected manually.`)

  return {
    
    provider,
    escrowFactory,
    resolver,
  }
}



async function getProvider(cnf: ChainConfig): Promise<{provider: any}> {
    
    if (cnf.chainId == "injective-888") {
        const network =  Network.Testnet
        const endpoints = getNetworkEndpoints(network)
        return {
            provider: new ChainGrpcWasmApi(endpoints.grpc)
        }
    }
    else {
        return {
            provider: new JsonRpcProvider(cnf.url, cnf.chainId)
        }
    }
}

/**
 * Deploy contract and return its address
 */
async function deploy(
    json: {abi: any; bytecode: any},
    params: unknown[],
    provider: JsonRpcProvider,
    deployer: SignerWallet
): Promise<string> {
    const deployed = await new ContractFactory(json.abi, json.bytecode, deployer).deploy(...params)
    await deployed.waitForDeployment()

    return await deployed.getAddress()
}