import { Interface, Signature, TransactionRequest } from 'ethers'
import * as Sdk from '@1inch/cross-chain-sdk'
import { AbiCoder } from '@ethersproject/abi'

const RESOLVER_ABI = [
    'function deploySrc(bytes calldata srcImmutables, bytes calldata order, bytes32 r, bytes32 vs, uint256 amount, uint256 trait, bytes calldata args) external payable',
    'function withdraw(address escrow, bytes32 secret, bytes calldata immutables) external'
]

export class Resolver {
    private readonly iface = new Interface(RESOLVER_ABI)

    constructor(
        public readonly srcAddress: string,
        public readonly dstAddress: string
    ) {}

    public deploySrc(
        chainId: number,
        order: Sdk.CrossChainOrder,
        signature: string,
        takerTraits: Sdk.TakerTraits,
        amount: bigint,
        hashLock = order.escrowExtension.hashLockInfo
    ): TransactionRequest {
        const {r, yParityAndS: vs} = Signature.from(signature)
        const {args, trait} = takerTraits.encode()
        const immutables = order.toSrcImmutables(chainId, new Sdk.Address(this.srcAddress), amount, hashLock)

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
        // 🔥 KEY FIX: Encode the arrays as bytes using ABI encoder
        const abiCoder = new AbiCoder()

        // Define the struct types for encoding
        const immutablesEncoded = abiCoder.encode(
            ['tuple(bytes32,bytes32,address,address,address,uint256,uint256,uint256)'],
            [immutablesArray]
        )

        const orderEncoded = abiCoder.encode(
            ['tuple(uint256,address,address,address,address,uint256,uint256,uint256)'],
            [orderArray]
        )

        return {
            to: this.srcAddress,
            data: this.iface.encodeFunctionData('deploySrc', [
                immutablesEncoded,                  // encoded bytes
                orderEncoded,                       // encoded bytes
                r,                                  // signature r
                vs,                                 // signature vs
                amount,                         // amount
                trait,                              // trait as BigInt
                args,                               // args as bytes
            ]),
            value: order.escrowExtension.srcSafetyDeposit
        }
    }

    public withdraw(
        side: 'src' | 'dst',
        escrow: Sdk.Address,
        secret: string,
        immutables: Sdk.Immutables
    ): TransactionRequest {
        const encoding = this.iface.encodeFunctionData('withdraw', [escrow.toString(), secret, immutables.build()])
        return {
            to: side === 'src' ? this.srcAddress : this.dstAddress,
            data: encoding
        }
    }
}