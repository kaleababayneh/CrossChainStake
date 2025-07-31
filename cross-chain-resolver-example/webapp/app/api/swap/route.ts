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

// Simplified configuration 
const config = {
  source: {
    chainId: 27270,
    rpcUrl: "https://rpc.buildbear.io/appalling-thepunisher-3e7a9d1c",
    escrowFactory: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    resolver: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    tokens: {
      USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    }
  },
  destination: {
    chainId: 'injective-888',
    contractAddress: 'inj1contract_placeholder'
  }
}

// Hardcoded exchange rate: 1000 USDC = 1 INJ
const EXCHANGE_RATE = 1000

// Resolver configuration for funding destination
const resolverMnemonic = "soda giggle lobster frown sponsor bridge follow firm fashion buddy final this crawl junior burst race differ school pupil bleak above economy toy chunk"
const resolverWallet = PrivateKey.fromMnemonic(resolverMnemonic)
const resolverAddress = resolverWallet.toAddress().toBech32()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      fromAmount, 
      userAddress, 
      injectiveAddress,
      fromToken = 'USDC',
      toToken = 'INJ'
    } = body

    if (!fromAmount || !userAddress || !injectiveAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Calculate INJ amount using hardcoded rate: 1000 USDC = 1 INJ
    const injAmount = (parseFloat(fromAmount) / EXCHANGE_RATE).toFixed(6)

    // Generate unique swap ID and secret for atomic swap
    const swapId = `swap-${Date.now()}`
    const secretBytes = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
    const secretBytesX = `0x${secretBytes}`
    const secret = createHash('sha256').update(Buffer.from(secretBytes, 'hex')).digest('hex')

    console.log('Starting simplified cross-chain swap:', { 
      swapId, 
      fromAmount, 
      injAmount,
      userAddress, 
      injectiveAddress 
    })

    // Step 1: Fund destination escrow on Injective (like in test Step 3)
    console.log('🔓 Funding destination escrow on Injective...')
    
    try {
      const contractAddress = process.env.CW_20_ATOMIC_SWAP_CONTRACT_ADDRESS

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
      const hash = createHash('sha256').update(Buffer.from(secretBytes, 'hex')).digest('hex')
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

      console.log('💰 Resolver funding destination escrow for swap:', swapId)
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
      
    } catch (error) {
      console.error('Failed to fund destination escrow:', error)
      return NextResponse.json(
        { error: 'Failed to fund destination escrow', details: error?.toString() },
        { status: 500 }
      )
    }

    // Return simplified swap details
    return NextResponse.json({
      success: true,
      swapId,
      orderHash: `0x${secret}`, // Using secret as order hash for now
      secretBytes,
      order: {
        makingAmount: ethers.parseUnits(fromAmount, 6).toString(), // USDC amount
        takingAmount: ethers.parseUnits(injAmount, 18).toString(), // INJ amount  
        maker: userAddress,
        makerAsset: config.source.tokens.USDC,
        takerAsset: 'inj' // INJ token
      },
      injectiveContract: process.env.CW_20_ATOMIC_SWAP_CONTRACT_ADDRESS || 'inj1contract_placeholder',
      injAmount,
      exchangeRate: EXCHANGE_RATE,
      message: 'Swap prepared. Ready to deploy source escrow and claim on Injective.'
    })

  } catch (error) {
    console.error('Swap API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.toString() },
      { status: 500 }
    )
  }
} 