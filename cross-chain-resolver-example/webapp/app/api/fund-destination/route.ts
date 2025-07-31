import { NextRequest, NextResponse } from 'next/server'
import { 
  MsgExecuteContractCompat,
  PrivateKey,
  MsgBroadcasterWithPk,
} from '@injectivelabs/sdk-ts'
import { Network } from '@injectivelabs/networks'
import { ChainId } from '@injectivelabs/ts-types'
import { ethers } from 'ethers'
import { createHash } from 'crypto'

// Resolver configuration - using the same mnemonic as tests
let mnemonic = process.env.RESOLVER_MNEMONIC || process.env.MNEMONIC || 'fat kitten ignore behind mention acquire mandate swallow account lawsuit purity ahead'
mnemonic = "soda giggle lobster frown sponsor bridge follow firm fashion buddy final this crawl junior burst race differ school pupil bleak above economy toy chunk"
const wallet = PrivateKey.fromMnemonic(mnemonic)
const resolverAddress = wallet.toAddress().toBech32()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      swapId,
      secretBytes,
      amount,
      recipientAddress,
      expiryHeight
    } = body

    if (!swapId || !secretBytes || !amount || !recipientAddress || !expiryHeight) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    console.log('💰 Resolver funding destination escrow for swap:', swapId)
    console.log('Amount:', amount, 'INJ')
    console.log('Recipient:', recipientAddress)
    console.log('Expiry Height:', expiryHeight)

    const contractAddress = process.env.CW_20_ATOMIC_SWAP_CONTRACT_ADDRESS

    if (!contractAddress) {
      return NextResponse.json(
        { error: 'Contract address not configured' },
        { status: 500 }
      )
    }

    // Create the resolver broadcaster
    const broadcaster = new MsgBroadcasterWithPk({
      network: Network.Testnet,
      chainId: ChainId.Testnet,
      privateKey: wallet,
      endpoints: {
        grpc: 'https://testnet.sentry.chain.grpc-web.injective.network',
        rest: 'https://testnet.sentry.lcd.injective.network',
        indexer: 'https://testnet.sentry.exchange.grpc-web.injective.network',
      },
    })

    // Create the fund message (following fund_dst_escrow_with_params pattern from tests)
    // The test uses "create" message type, not "fund"
    const hash = createHash('sha256').update(Buffer.from(secretBytes, 'hex')).digest('hex')
    const executeMsg = {
      create: {
        id: swapId,
        hash, // Use computed hash like in tests
        recipient: recipientAddress,
        expires: {
          at_height: expiryHeight
        }
      }
    }

    console.log('Execute message:', executeMsg)

    const msg = MsgExecuteContractCompat.fromJSON({
      sender: resolverAddress,
      contractAddress,
      msg: executeMsg,
      funds: [{
        denom: 'inj',
        amount: ethers.parseUnits(amount, 18).toString() // Send the actual INJ tokens
      }]
    })

    // Broadcast the transaction
    const tx = await broadcaster.broadcast({ msgs: [msg] })

    console.log('✅ Resolver successfully funded destination escrow!')
    console.log('Tx Hash:', tx.txHash)

    return NextResponse.json({
      success: true,
      txHash: tx.txHash,
      resolverAddress,
      recipientAddress,
      swapId,
      amount,
      message: 'Destination escrow funded successfully'
    })

  } catch (error) {
    console.error('Fund destination API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fund destination escrow', 
        details: error?.toString(),
        resolverAddress 
      },
      { status: 500 }
    )
  }
} 