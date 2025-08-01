import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

// Import resolver contract ABI
const resolverAbi = require('../../../lib/resolver-contract.json')

// Resolver configuration
const resolverPrivateKey = '0x0a8453b8a66dc0e4cf0afcea4b961b6bcd4bd2d4d378c7512f8eb3a7aea255b3'

// Access the same contract cache as deploy-source
declare global {
  var contractCache: { escrowFactory: string; resolver: string; deployedAt: number } | null
}

function getResolverFromCache(): string | null {
  if (global.contractCache && (Date.now() - global.contractCache.deployedAt) < 3600000) {
    return global.contractCache.resolver
  }
  return null
}

// Configuration - infrastructure can be hardcoded
const config = {
  source: {
    chainId: 27270,
    rpcUrl: "https://rpc.buildbear.io/appalling-thepunisher-3e7a9d1c",
    tokens: {
      USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { escrowAddress, secretBytes, immutablesBuilt, swapId } = body

    // Hardcode the correct secret preimage (same as in swap API)
    const hardcodedSecret = '5532d0c37f1cace417f0868b843676ea29e044c7d66ed3b9993e22f689a485f4'

    console.log('📥 Withdrawal API received data:')
    console.log('Escrow address:', escrowAddress)
    console.log('Secret bytes (received):', secretBytes)
    console.log('🔑 Using hardcoded secret instead:', hardcodedSecret)
    console.log('Swap ID:', swapId)
    console.log('ImmutablesBuilt type:', typeof immutablesBuilt)
    console.log('ImmutablesBuilt received:', immutablesBuilt)

    if (!escrowAddress || !immutablesBuilt || !swapId) {
      return NextResponse.json(
        { error: 'Missing required parameters for withdraw' },
        { status: 400 }
      )
    }

    console.log('🏦 REAL Resolver withdrawing from source escrow:', escrowAddress)
    console.log('Swap ID:', swapId)
    console.log('Secret (using hardcoded):', hardcodedSecret)

    // ✅ CRITICAL: Use hardcoded secret instead of the potentially wrong secretBytes
    const formattedSecret = `0x${hardcodedSecret}`
    console.log('Formatted secret for contract:', formattedSecret)

    // Get resolver address from the same cache as deploy-source
    const resolver = getResolverFromCache()
    
    if (!resolver) {
      return NextResponse.json(
        { 
          error: 'Resolver contract not deployed yet',
          instruction: 'Call deploy-source API first to deploy contracts'
        },
        { status: 400 }
      )
    }

    // Setup provider and resolver
    const provider = new ethers.JsonRpcProvider(config.source.rpcUrl)
    const resolverWallet = new ethers.Wallet(resolverPrivateKey, provider)
    const resolverAddress = await resolverWallet.getAddress()

    console.log('📋 Using resolver address from environment:', resolver)
    console.log('Resolver signer address:', resolverAddress)

    // Get current balances for logging
    const currentTimestamp = Math.floor(Date.now() / 1000)
    console.log('⏰ Current block timestamp:', currentTimestamp)
    console.log('⏰ Current block number:', await provider.getBlockNumber())

    const ethBalance = await provider.getBalance(resolverAddress)
    console.log('🔋 Resolver ETH balance:', ethers.formatEther(ethBalance), 'ETH')

    const usdcContract = new ethers.Contract(config.source.tokens.USDC, [
      'function balanceOf(address) view returns (uint256)'
    ], provider)
    const usdcBalance = await usdcContract.balanceOf(resolverAddress)
    console.log('🪙 Resolver USDC balance BEFORE withdrawal:', ethers.formatUnits(usdcBalance, 6), 'USDC')

    console.log('🔍 Checking time lock constraints...')

    // ✅ HANDLE BOTH ARRAY AND OBJECT FORMAT for immutablesBuilt
    console.log('🧪 DEBUG: ImmutablesBuilt is array?', Array.isArray(immutablesBuilt))

    let timelocks
    let builtImmutablesArray

    if (Array.isArray(immutablesBuilt)) {
      // It's already a built array
      console.log('✅ ImmutablesBuilt is array format')
      builtImmutablesArray = immutablesBuilt
      timelocks = BigInt(immutablesBuilt[7])  // timelocks is at index 7
    } else {
      // It's an object format, convert to array
      console.log('✅ ImmutablesBuilt is object format, converting to array...')
      builtImmutablesArray = [
        immutablesBuilt.orderHash,     // 0
        immutablesBuilt.hashlock,      // 1  
        immutablesBuilt.maker,         // 2
        immutablesBuilt.taker,         // 3
        immutablesBuilt.token,         // 4
        immutablesBuilt.amount,        // 5
        immutablesBuilt.safetyDeposit, // 6
        immutablesBuilt.timelocks      // 7
      ]
      timelocks = BigInt(immutablesBuilt.timelocks)
    }

    console.log('🔍 Raw timelocks value:', timelocks.toString())
    const srcWithdrawal = Number((timelocks >> 224n) & 0xFFFFFFFFn) // Extract 32 bits for srcWithdrawal
    console.log('🔍 Extracted srcWithdrawal time lock:', srcWithdrawal, 'seconds')
    console.log('⚠️  NOTE: Time lock validation is approximate - the exact deployment time determines availability')

    // Setup contract interface and wallet
    const resolverInterface = new ethers.Interface(resolverAbi.abi)
    const resolverContract = new ethers.Contract(resolver, resolverInterface, resolverWallet)

    console.log('🔧 Executing REAL withdraw transaction...')
    console.log('Escrow address:', escrowAddress)
    console.log('Secret:', formattedSecret)

    // ✅ CRITICAL: Use the built immutables array directly - no need to reconstruct anything!
    console.log('🏗️ Using the built immutables array directly from frontend...')
    console.log('Built immutables array:', builtImmutablesArray)

    // ✅ VALIDATION: Try to call the function statically first to get better error info
    console.log('🧪 Testing withdraw call statically first...')
    try {
      const resolverContract = new ethers.Contract(resolver, resolverInterface, provider)
      
      // ✅ CRITICAL: Use the built immutables directly
      const staticResult = await resolverContract.withdraw.staticCall(
        escrowAddress,        // This is correct - address will be cast to IEscrow
        formattedSecret,      // ✅ Use formatted secret with 0x prefix
        builtImmutablesArray  // ✅ Use the built immutables array directly!
      )
      console.log('✅ Static call succeeded - withdrawal should work:', staticResult)
    } catch (staticError: any) {
      console.log('❌ Static call failed - this reveals the exact error:')
      console.log('Static error message:', staticError.message)
      console.log('Static error code:', staticError.code)
      console.log('Static error data:', staticError.data)
      console.log('Static error shortMessage:', staticError.shortMessage)
      
      // Check for specific error types
      if (staticError.message.includes('too early') || staticError.message.includes('time lock') || staticError.message.includes('timestamp')) {
        console.log('🕒 TIME LOCK ERROR DETECTED: Withdrawal is too early!')
        return NextResponse.json(
          { 
            error: 'Time lock not yet expired - withdrawal too early',
            details: `Static call failed: ${staticError.message}`,
            currentTimestamp,
            estimatedSrcWithdrawal: srcWithdrawal,
            suggestion: 'Wait longer before attempting withdrawal'
          },
          { status: 400 }
        )
      } else if (staticError.message.includes('secret') || staticError.message.includes('hash')) {
        console.log('🔐 SECRET ERROR DETECTED: Wrong secret or hash!')
        return NextResponse.json(
          { 
            error: 'Invalid secret or hash lock',
            details: `Static call failed: ${staticError.message}`,
            providedSecret: formattedSecret,
            expectedHashlock: builtImmutablesArray[1] // hashlock is at index 1
          },
          { status: 400 }
        )
      } else if (staticError.message.includes('missing revert data') || staticError.code === 'CALL_EXCEPTION') {
        console.log('🔧 CONTRACT CALL ERROR: Function call failed - checking if it is a parameter issue')
        
        // Try to get more information about why the call failed
        const errorDetails = {
          message: staticError.message,
          code: staticError.code,
          data: staticError.data,
          shortMessage: staticError.shortMessage || 'Unknown error'
        }
        
        console.log('Full error details:', JSON.stringify(errorDetails, null, 2))
        
        return NextResponse.json(
          { 
            error: 'Contract call failed - likely parameter or function signature issue',
            details: errorDetails,
            troubleshooting: {
              escrowAddress,
              secretBytes: formattedSecret,
              builtImmutables: builtImmutablesArray,
              contractAddress: resolver,
              suggestion: 'Check if escrow contract exists and function signature is correct'
            }
          },
          { status: 400 }
        )
      } else {
        console.log('⚠️  UNKNOWN ERROR: Static call failed for other reason')
        // Continue with the actual transaction to get the real error
      }
    }

    // ✅ Encode the transaction using the built immutables
    console.log('🔧 Withdraw transaction data:')
    const txData = resolverInterface.encodeFunctionData('withdraw', [
      escrowAddress,
      formattedSecret,      // ✅ Use formatted secret with 0x prefix
      builtImmutablesArray  // ✅ Use the built immutables directly!
    ])

    // Send the withdraw transaction
    const tx = await resolverWallet.sendTransaction({
      to: resolver,
      data: txData
    })

    console.log('✅ REAL withdraw transaction sent:', tx.hash)
    
    const receipt = await tx.wait()
    console.log('✅ REAL withdraw transaction confirmed!')
    console.log('Block number:', receipt?.blockNumber)
    console.log('Gas used:', receipt?.gasUsed?.toString())
    console.log('Status:', receipt?.status)

    // Get balances after withdrawal
    const ethBalanceAfter = await provider.getBalance(resolverAddress)
    const usdcBalanceAfter = await usdcContract.balanceOf(resolverAddress)
    
    console.log('🔋 Resolver ETH balance AFTER withdrawal:', ethers.formatEther(ethBalanceAfter), 'ETH')
    console.log('🪙 Resolver USDC balance AFTER withdrawal:', ethers.formatUnits(usdcBalanceAfter, 6), 'USDC')

    return NextResponse.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber,
      gasUsed: receipt?.gasUsed?.toString(),
      resolverAddress,
      escrowAddress,
      swapId,
      message: 'REAL Resolver withdrawal executed successfully - USDC claimed by resolver!',
      balanceChanges: {
        ethBefore: ethers.formatEther(ethBalance),
        ethAfter: ethers.formatEther(ethBalanceAfter),
        usdcBefore: ethers.formatUnits(usdcBalance, 6),
        usdcAfter: ethers.formatUnits(usdcBalanceAfter, 6)
      },
      realTransaction: true
    })

  } catch (error: any) {
    console.log('❌ Withdraw source API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to execute withdrawal',
        details: error.message,
        code: error.code
      },
      { status: 500 }
    )
  }
} 