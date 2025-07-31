import { NextRequest, NextResponse } from 'next/server'
import { 
  MsgExecuteContractCompat,
  PrivateKey,
  MsgBroadcasterWithPk,
} from '@injectivelabs/sdk-ts'
import { Network } from '@injectivelabs/networks'
import { ChainId } from '@injectivelabs/ts-types'

// Resolver does the claiming/releasing - user just provides recipient address
const resolverMnemonic = "soda giggle lobster frown sponsor bridge follow firm fashion buddy final this crawl junior burst race differ school pupil bleak above economy toy chunk"
const resolverWallet = PrivateKey.fromMnemonic(resolverMnemonic)
const resolverAddress = resolverWallet.toAddress().toBech32()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      swapId,
      secretBytes,
      recipientAddress,
      contractAddress
    } = body

    if (!swapId || !secretBytes || !recipientAddress || !contractAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    console.log('🔓 Resolver releasing funds from escrow for swap:', swapId)
    console.log('Recipient:', recipientAddress)
    console.log('Contract:', contractAddress)

    // Create the resolver broadcaster (resolver does the releasing)
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

    // Create the release message (resolver releases funds to recipient)
    // Remove "0x" prefix from secretBytes as Injective contract expects raw hex
    const preimage = secretBytes.startsWith('0x') ? secretBytes.slice(2) : secretBytes
    
    const executeMsg = {
      release: {
        id: swapId,
        preimage: preimage, // Raw hex without "0x" prefix
        recipient: recipientAddress
      },
    }

    console.log('Execute message:', executeMsg)

    const msg = MsgExecuteContractCompat.fromJSON({
      sender: resolverAddress, // Resolver releases the funds
      contractAddress,
      msg: executeMsg,
      funds: [], // No funds needed for claiming
    })

    // Broadcast the transaction
    const tx = await broadcaster.broadcast({ msgs: [msg] })

    console.log('✅ Resolver successfully released funds to user!')
    console.log('Tx Hash:', tx.txHash)

          return NextResponse.json({
        success: true,
        txHash: tx.txHash,
        resolverAddress,
        recipientAddress,
        swapId,
        message: 'Funds successfully released to user by resolver'
      })

  } catch (error) {
    console.error('Claim API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to release funds', 
        details: error?.toString(),
        resolverAddress 
      },
      { status: 500 }
    )
  }
} 