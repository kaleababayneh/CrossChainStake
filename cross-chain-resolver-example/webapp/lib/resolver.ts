import {Interface, Signature, TransactionRequest} from 'ethers'
import * as Sdk from '@1inch/cross-chain-sdk'
import Contract from './Resolver.json'

const {Address} = Sdk
export class Resolver {
    private readonly iface = new Interface(Contract.abi)

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
        console.log('🔧 RESOLVER DEBUG - deploySrc called')
        console.log('- chainId:', chainId)
        console.log('- order:', order)
        console.log('- signature:', signature)
        console.log('- amount:', amount)
        console.log('- hashLock:', hashLock)

        const {r, yParityAndS: vs} = Signature.from(signature)
        const {args, trait} = takerTraits.encode()
        const immutables = order.toSrcImmutables(chainId, new Sdk.Address(this.srcAddress), amount, hashLock)

        console.log('🔧 RESOLVER DEBUG - deploySrc parameters:')
        console.log('- immutables.build():', immutables.build())
        console.log('- order.build():', order.build())
        console.log('- r:', r)
        console.log('- vs:', vs)
        console.log('- amount:', amount)
        console.log('- trait:', trait)
        console.log('- args:', args)

        const encoded = this.iface.encodeFunctionData('deploySrc', [
            immutables.build(),
            order.build(),
            r,
            vs,
            amount,
            trait,
            args
        ])

        console.log('🔧 RESOLVER DEBUG - encoded data:', encoded)
        console.log('🔧 RESOLVER DEBUG - encoded data length:', encoded.length)

        return {
            to: this.srcAddress,
            data: encoded,
            value: order.escrowExtension.srcSafetyDeposit
        }
    }

    public deployDst(
        /**
         * Immutables from SrcEscrowCreated event with complement applied
         */
        immutables: Sdk.Immutables
    ): TransactionRequest {
        return {
            to: this.dstAddress,
            data: this.iface.encodeFunctionData('deployDst', [
                immutables.build(),
                immutables.timeLocks.toSrcTimeLocks().privateCancellation
            ]),
            value: immutables.safetyDeposit
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

    public cancel(side: 'src' | 'dst', escrow: Sdk.Address, immutables: Sdk.Immutables): TransactionRequest {
        return {
            to: side === 'src' ? this.srcAddress : this.dstAddress,
            data: this.iface.encodeFunctionData('cancel', [escrow.toString(), immutables.build()])
        }
    }
}