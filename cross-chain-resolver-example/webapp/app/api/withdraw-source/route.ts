import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

// Resolver configuration
const resolverPrivateKey = process.env.RESOLVER_PRIVATE_KEY || '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'

const config = {
  source: {
    chainId: 27270,
    rpcUrl: "https://rpc.buildbear.io/appalling-thepunisher-3e7a9d1c",
    resolver: process.env.RESOLVER_CONTRACT_ADDRESS || "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      escrowAddress,
      secretBytes,
      immutables,
      swapId
    } = body

    if (!escrowAddress || !secretBytes || !immutables || !swapId) {
      return NextResponse.json(
        { error: 'Missing required parameters for withdraw' },
        { status: 400 }
      )
    }

    console.log('🏦 REAL Resolver withdrawing from source escrow:', escrowAddress)
    console.log('Swap ID:', swapId)
    console.log('Secret:', secretBytes)

    // Set up resolver signer
    const provider = new ethers.JsonRpcProvider(config.source.rpcUrl)
    const resolverSigner = new ethers.Wallet(resolverPrivateKey, provider)
    const resolverAddress = await resolverSigner.getAddress()

    console.log('Resolver address:', resolverAddress)

    // Load resolver contract ABI
    const resolverContractJson = require('../../../lib/resolver-contract.json')
    const resolverInterface = new ethers.Interface(resolverContractJson.abi)

    // Create withdraw transaction
    const withdrawTxRequest = {
      to: config.source.resolver,
      data: resolverInterface.encodeFunctionData('withdraw', [
        escrowAddress,
        secretBytes, // secret as bytes32
        immutables // immutables struct
      ])
    }

    console.log('🔧 Executing REAL withdraw transaction...')
    console.log('Escrow address:', escrowAddress)
    
    // Execute the real withdraw transaction
    const tx = await resolverSigner.sendTransaction(withdrawTxRequest)
    
    console.log('✅ REAL withdraw transaction sent:', tx.hash)
    
    // Wait for confirmation
    const receipt = await tx.wait()
    
    console.log('✅ REAL withdraw transaction confirmed!')
    console.log('Block number:', receipt?.blockNumber)
    console.log('Gas used:', receipt?.gasUsed?.toString())
    
    // REAL USDC is now withdrawn from escrow to resolver

    return NextResponse.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber,
      gasUsed: receipt?.gasUsed?.toString(),
      resolverAddress,
      escrowAddress,
      swapId,
      message: 'REAL withdraw executed successfully - USDC retrieved from escrow!',
      realTransaction: true
    })

  } catch (error) {
    console.error('Withdraw source API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to execute REAL withdraw', 
        details: error?.toString()
      },
      { status: 500 }
    )
  }
} 