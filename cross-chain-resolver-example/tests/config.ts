import {z} from 'zod'
import Sdk from '@1inch/cross-chain-sdk'
import * as process from 'node:process'
import { create } from 'node:domain'
import { wrap } from 'node:module'



export const config = {
    chain: {

        source: {
            chainId: 27270,
            url: "https://rpc.buildbear.io/appalling-thepunisher-3e7a9d1c",
            createFork: false,
            limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
            wrappedNative: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            ownerPrivateKey: '0x8bc5e2d9a1ec77c51fd83dc78622222c8b2f1eadaa361eae31409a702ec21c27',
            tokens: {
                USDC: {
                    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                    donor: '0xd54F23BE482D9A58676590fCa79c8E43087f92fB'
                }
            }
        },
        destination: {
            chainId: 'injective-888',
            url: 'https://testnet.sentry.lcd.injective.network',
            createFork: false,
            limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
            wrappedNative: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            ownerPrivateKey: '0x8bc5e2d9a1ec77c51fd83dc78622222c8b2f1eadaa361eae31409a702ec21c27',
            tokens: {
                CUSDC: {
                    address: 'inj1k6hdgvqzws7xr3aa40acacw5egwghhf5kzmwye',
                    donor: 'inj1zrnpc8zf80p6mctwln77wfagrya5ssyfpayx3t'
                }
            }
        }
        
    }
} as const

export type ChainConfig = (typeof config.chain)['source' | 'destination']
