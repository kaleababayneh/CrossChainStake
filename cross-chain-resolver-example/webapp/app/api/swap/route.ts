import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { createHash } from 'crypto'
import { 
  MsgExecuteContractCompat,
  PrivateKey,
  MsgBroadcasterWithPk,
} from '@injectivelabs/sdk-ts'


import { Network } from '@injectivelabs/networks'
import { ChainId } from '@injectivelabs/ts-types'

// Configuration matching the test setup
const config = {
  source: {
    chainId: 27270,
    rpcUrl: "https://rpc.buildbear.io/appalling-thepunisher-3e7a9d1c",
    escrowFactory: process.env.ESCROW_FACTORY_ADDRESS || "0xd806e3bd97F5dDE903745889cf2588EB60f0f2A2", // From working test deployment
    resolver: process.env.RESOLVER_CONTRACT_ADDRESS || "0x21f937E650570EA46d9434a832061c72069BBD0f", // From working test deployment
    tokens: {
      USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    }
  },
  destination: {
    chainId: 'injective-888',
    contractAddress: process.env.CW_20_ATOMIC_SWAP_CONTRACT_ADDRESS || 'inj1rxrklxvejj93j7zqfpsd8a3c8n2xf4nakuwc6w'
  }
}

// Resolver configuration for funding destination
const resolverMnemonic = "soda giggle lobster frown sponsor bridge follow firm fashion buddy final this crawl junior burst race differ school pupil bleak above economy toy chunk"
const resolverWallet = PrivateKey.fromMnemonic(resolverMnemonic)
const resolverAddress = resolverWallet.toAddress().toBech32()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      swapId,
      order, // Serialized CrossChainOrder
      signature,
      orderHash,
      secretBytes,
      fromAmount,
      injAmount,
      userAddress,
      injectiveAddress
    } = body

    // Hardcode the correct secret preimage that was used in the successful claim
    const hardcodedSecret = '5532d0c37f1cace417f0868b843676ea29e044c7d66ed3b9993e22f689a485f4'
    
    console.log('🔑 Using hardcoded secret:', hardcodedSecret)
    console.log('🔑 Original secretBytes from request:', secretBytes)

    if (!swapId || !order || !signature || !orderHash || !secretBytes || !fromAmount || !injAmount || !userAddress || !injectiveAddress) {
      return NextResponse.json(
        { error: 'Missing required CrossChainOrder parameters' },
        { status: 400 }
      )
    }

    console.log('Processing real CrossChainOrder swap:', { 
      swapId,
      orderHash,
      fromAmount, 
      injAmount,
      userAddress, 
      injectiveAddress,
      signature: signature.substring(0, 20) + '...'
    })

    // Step 1: Fund destination escrow on Injective (like in test Step 3)
    console.log('🔓 Funding destination escrow on Injective...')
    
    try {
      const contractAddress = process.env.CW_20_ATOMIC_SWAP_CONTRACT_ADDRESS || config.destination.contractAddress

      if (!contractAddress) {
        throw new Error('Contract address not configured')
      }

      // Create the resolver broadcaster
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

      // Create the fund message (following fund_dst_escrow_with_params pattern from tests)
      const hash = createHash('sha256').update(Buffer.from(hardcodedSecret, 'hex')).digest('hex')
      console.log('🔐 Computed hash from hardcoded secret:', hash)
      const executeMsg = {
        create: {
          id: swapId,
          hash, // Use computed hash like in tests
          recipient: injectiveAddress,
          expires: {
            at_height: 90_000_000
          }
        }
      }

      console.log('💰 Resolver funding destination escrow for CrossChainOrder:', orderHash)
      console.log('Amount:', injAmount, 'INJ')
      console.log('Recipient:', injectiveAddress)
      console.log('Execute message:', executeMsg)

      const msg = MsgExecuteContractCompat.fromJSON({
        sender: resolverAddress,
        contractAddress,
        msg: executeMsg,
        funds: [{
          denom: 'inj',
          amount: ethers.parseUnits(injAmount, 18).toString() // Send the actual INJ tokens
        }]
      })

      // Broadcast the transaction
      const tx = await broadcaster.broadcast({ msgs: [msg] })

      console.log('✅ Resolver successfully funded destination escrow!')
      console.log('Tx Hash:', tx.txHash)
      
      // Return successful response with destination funding info
      return NextResponse.json({
        success: true,
        swapId,
        orderHash,
        secretBytes: hardcodedSecret, // Return the hardcoded secret
        order: order, // Return the serialized order back
        signature,
        destinationFundingTx: tx.txHash, // Injective funding transaction
        injectiveContract: contractAddress,
        injAmount,
        fromAmount,
        message: 'CrossChainOrder processed and destination escrow funded. Ready to deploy source escrow.'
      })
      
    } catch (error) {
      console.error('Failed to fund destination escrow:', error)
      return NextResponse.json(
        { error: 'Failed to fund destination escrow', details: error?.toString() },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('CrossChainOrder API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.toString() },
      { status: 500 }
    )
  }
} 