import { NextRequest, NextResponse } from 'next/server'
import { 
  MsgGrantAllowance,
  MsgRevokeAllowance,
  MsgBroadcasterWithPk, 
  PrivateKey 
} from '@injectivelabs/sdk-ts'
import { Network } from '@injectivelabs/networks'
import { ChainId } from '@injectivelabs/ts-types'


async function revokeFeeAllowance(
  granteeAddress: string,
  granterMnemonic: string 
) {
  try {
    const granterWallet = PrivateKey.fromMnemonic(granterMnemonic)
    const granterAddress = granterWallet.toBech32()
    
    console.log(`🗑️  Attempting to revoke existing fee allowance from ${granterAddress} to ${granteeAddress}`)

    const msg = MsgRevokeAllowance.fromJSON({
      granter: granterAddress,
      grantee: granteeAddress,
    })

    const broadcaster = new MsgBroadcasterWithPk({
      privateKey: granterWallet,
      network: Network.Testnet,
      chainId: ChainId.Testnet,
      endpoints: {
        indexer: 'https://testnet.sentry.exchange.grpc-web.injective.network',
        grpc: 'https://testnet.sentry.chain.grpc-web.injective.network',
        rest: 'https://testnet.sentry.lcd.injective.network',
      },
    })

    const txResponse = await broadcaster.broadcast({
      msgs: msg,
    })

    console.log('✅ Fee allowance revoked successfully!')
    console.log('Revoke Tx Hash:', txResponse.txHash)
    return txResponse.txHash

  } catch (error: any) {
    // It's OK if revoke fails (probably no existing allowance)
    console.log('ℹ️  No existing fee allowance to revoke (this is normal):', error.message)
    return null
  }
}

export async function grantFeeAllowance(
  granteeAddress: string,
  granterMnemonic: string,
  amount: string = '10000000000000000', // Default to 0.01 INJ (18 decimals)
  durationMinutes: number = 3
) {
  try {
    // Step 1: Revoke any existing fee allowance first
    await revokeFeeAllowance(granteeAddress, granterMnemonic)
    
    // Step 2: Initialize wallet from mnemonic (granter)
    const granterWallet = PrivateKey.fromMnemonic(granterMnemonic)
    const granterAddress = granterWallet.toBech32()
    
    console.log(`🎁 Granting NEW fee allowance from ${granterAddress} to ${granteeAddress}`)

    // Set expiration (duration in minutes from now)
    const expiration = Math.floor(Date.now() / 1000) + (durationMinutes * 60)
    
    // Create proper allowance structure that works in Node.js environment
    const allowance = {
      spendLimit: [
        {
          denom: 'inj',
          amount: amount.toString()
        }
      ],
      expiration: expiration
    }

    const msg = MsgGrantAllowance.fromJSON({
      granter: granterAddress,
      grantee: granteeAddress,
      allowance,
    })

    const broadcaster = new MsgBroadcasterWithPk({
      privateKey: granterWallet,
      network: Network.Testnet,
      chainId: ChainId.Testnet,
      endpoints: {
        indexer: 'https://testnet.sentry.exchange.grpc-web.injective.network',
        grpc: 'https://testnet.sentry.chain.grpc-web.injective.network',
        rest: 'https://testnet.sentry.lcd.injective.network',
      },
    })

    const txResponse = await broadcaster.broadcast({
      msgs: msg,
    })

    console.log('✅ Fee grant successful!')
    console.log('Tx Hash:', txResponse.txHash)
    console.log(`💰 Granted ${amount} inj to ${granteeAddress}`)
    console.log(`⏰ Expires at: ${new Date(expiration * 1000).toISOString()}`)
    
    return {
      success: true,
      txHash: txResponse.txHash,
      granter: granterAddress,
      grantee: granteeAddress,
      amount: amount,
      expiresAt: new Date(expiration * 1000).toISOString(),
      message: 'Fee allowance granted successfully (existing allowance was revoked first if it existed)'
    }

  } catch (error) {
    console.error('❌ Error granting fee allowance:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      granteeAddress, 
      granterMnemonic,
      amount = '10000000000000000', // 0.01 INJ default
      durationMinutes = 3 
    } = body

    if (!granteeAddress) {
      return NextResponse.json({
        success: false,
        error: 'granteeAddress is required'
      }, { status: 400 })
    }

    console.log(`📝 Fee grant request: ${granteeAddress}, amount: ${amount}, duration: ${durationMinutes}min`)
    console.log(`🔄 Process: REVOKE existing (if any) → GRANT new allowance`)

    const result = await grantFeeAllowance(
      granteeAddress,
      granterMnemonic,  
      amount,
      durationMinutes
    )
    
    console.log(`✅ Fee grant process completed successfully!`)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('❌ Fee grant API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Fee grant failed'
    }, { status: 500 })
  }
}

export async function GET() {
  
  return NextResponse.json({
    service: 'Fee Grant API',
    status: 'healthy',
    granter: "",
    features: [
      'Grant fee allowances', 
      'Auto-revoke existing allowances before granting',
      'Prevents "fee allowance already exists" errors'
    ],
    timestamp: new Date().toISOString()
  })
}