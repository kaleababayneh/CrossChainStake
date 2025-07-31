import { Interface, Signature, ethers } from 'ethers'
import * as Sdk from '@1inch/cross-chain-sdk'
import resolverContractJson from './resolver-contract.json'

/**
 * Helper class to construct Resolver contract transactions
 * Similar to tests/resolver.ts but for webapp use
 */
export class ResolverHelper {
    private readonly iface = new Interface(resolverContractJson.abi)

    constructor(
        public readonly srcAddress: string,
        public readonly dstAddress: string
    ) {}

    /**
     * Creates a deploySrc transaction request like the test
     */
    public deploySrc(
        chainId: number,
        order: Sdk.CrossChainOrder,
        signature: string,
        takerTraits: Sdk.TakerTraits,
        amount: bigint,
        hashLock = order.escrowExtension.hashLockInfo
    ): ethers.TransactionRequest {
        const { r, yParityAndS: vs } = Signature.from(signature)
        const { args, trait } = takerTraits.encode()
        const immutables = order.toSrcImmutables(chainId, new Sdk.Address(this.srcAddress), amount, hashLock)

        return {
            to: this.srcAddress,
            data: this.iface.encodeFunctionData('deploySrc', [
                immutables.build(),
                order.build(),
                r,
                vs,
                amount,
                trait,
                args
            ]),
            value: order.escrowExtension.srcSafetyDeposit
        }
    }

    /**
     * Creates a withdraw transaction request like the test
     */
    public withdraw(
        side: 'src' | 'dst',
        escrow: string,
        secret: string,
        immutables: Sdk.Immutables
    ): ethers.TransactionRequest {
        const encoding = this.iface.encodeFunctionData('withdraw', [escrow, secret, immutables.build()])
        return {
            to: side === 'src' ? this.srcAddress : this.dstAddress,
            data: encoding
        }
    }
} 