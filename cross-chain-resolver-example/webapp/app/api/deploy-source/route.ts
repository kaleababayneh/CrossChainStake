import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

// Resolver configuration for EVM transactions (same as test)
const resolverPrivateKey = '0x0a8453b8a66dc0e4cf0afcea4b961b6bcd4bd2d4d378c7512f8eb3a7aea255b3'

// Configuration matching the test setup
const config = {
  source: {
    chainId: 27270,
    rpcUrl: "https://rpc.buildbear.io/appalling-thepunisher-3e7a9d1c",
    escrowFactory: process.env.ESCROW_FACTORY_ADDRESS || "0x3A686A56071445Bc36d432C9332eBDcae3F6dC4D", // From test deployment  
    resolver: process.env.RESOLVER_CONTRACT_ADDRESS || "0xB9c80Fd36A0ea0AD844538934ac7384aC0f46659", // From test deployment
    limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
    tokens: {
      USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      orderData,
      signature,
      fillAmount,
      userAddress,
      safetyDeposit,
      extensionData,
      takingAmount,
      immutables,
      takerTraits
    } = body

    if (!orderData || !signature || !fillAmount || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters for deploySrc' },
        { status: 400 }
      )
    }

    // Add validation for the new parameters
    if (!immutables || !takerTraits) {
      return NextResponse.json(
        { error: 'Missing immutables or takerTraits from frontend' },
        { status: 400 }
      )
    }

    console.log('📊 Received SDK data:')
    console.log('Immutables:', immutables)
    console.log('TakerTraits:', takerTraits)

    console.log('🚀 REAL Resolver executing deploySrc for user:', userAddress)
    console.log('Fill amount:', fillAmount, 'USDC')
    console.log('Safety deposit:', safetyDeposit ? ethers.formatEther(BigInt(safetyDeposit)) : '0', 'ETH')
    console.log('Order data received:', typeof orderData)
    console.log('Order data structure:', JSON.stringify(orderData, null, 2))

    // Set up resolver signer
    const provider = new ethers.JsonRpcProvider(config.source.rpcUrl)
    const resolverSigner = new ethers.Wallet(resolverPrivateKey, provider)
    const resolverAddress = await resolverSigner.getAddress()

    console.log('Resolver address:', resolverAddress)

    // Check resolver ETH balance for gas fees
    const resolverEthBalance = await provider.getBalance(resolverAddress)
    console.log('🔋 Resolver ETH balance:', ethers.formatEther(resolverEthBalance), 'ETH')
    
    if (resolverEthBalance === 0n) {
      return NextResponse.json(
        { 
          error: `Resolver wallet has no ETH for gas fees!`,
          resolverAddress,
          currentBalance: '0 ETH',
          fundingInstruction: `Please send ETH to resolver address: ${resolverAddress}`
        },
        { status: 400 }
      )
    }

    // Estimate gas for the transaction to check if balance is sufficient
    try {
      const gasEstimate = await provider.estimateGas({
        to: config.source.limitOrderProtocol,
        data: '0x', // placeholder for gas estimation
        from: resolverAddress
      })
      
      const gasPrice = await provider.getFeeData()
      const estimatedGasCost = gasEstimate * (gasPrice.gasPrice || 0n)
      
      console.log('⛽ Estimated gas needed:', ethers.formatEther(estimatedGasCost), 'ETH')
      
      if (resolverEthBalance < estimatedGasCost) {
        return NextResponse.json(
          { 
            error: `Insufficient ETH for gas fees`,
            resolverAddress,
            currentBalance: ethers.formatEther(resolverEthBalance) + ' ETH',
            requiredGas: ethers.formatEther(estimatedGasCost) + ' ETH',
            fundingInstruction: `Please send at least ${ethers.formatEther(estimatedGasCost)} ETH to: ${resolverAddress}`
          },
          { status: 400 }
        )
      }
    } catch (gasError) {
      console.log('Could not estimate gas, proceeding with transaction...')
    }

    // Verify user has approved USDC to LimitOrderProtocol
    const ERC20_ABI = [
      'function allowance(address owner, address spender) external view returns (uint256)',
      'function balanceOf(address account) external view returns (uint256)'
    ]

    const usdcContract = new ethers.Contract(
      config.source.tokens.USDC,
      ERC20_ABI,
      provider
    )

    const fillAmountBigInt = ethers.parseUnits(fillAmount, 6)
    const userBalance = await usdcContract.balanceOf(userAddress)
    const userAllowance = await usdcContract.allowance(userAddress, config.source.limitOrderProtocol)

    console.log('User USDC balance:', ethers.formatUnits(userBalance, 6))
    console.log('User allowance to LOP:', ethers.formatUnits(userAllowance, 6))

    if (userBalance < fillAmountBigInt) {
      return NextResponse.json(
        { error: 'Insufficient USDC balance' },
        { status: 400 }
      )
    }

    if (userAllowance < fillAmountBigInt) {
      return NextResponse.json(
        { error: 'Insufficient USDC allowance to LimitOrderProtocol' },
        { status: 400 }
      )
    }

    // Load resolver contract ABI and create interface
    const resolverContractJson = require('../../../lib/resolver-contract.json')
    const resolverInterface = new ethers.Interface(resolverContractJson.abi)

    // ✅ DEBUG: Check if we're the owner of the Resolver contract
    try {
      const resolverContract = new ethers.Contract(config.source.resolver, resolverInterface, provider)
      const contractOwner = await resolverContract.owner()
      console.log('🔐 Contract owner:', contractOwner)
      console.log('🔐 Our address:', resolverAddress)
      console.log('🔐 Are we the owner?', contractOwner.toLowerCase() === resolverAddress.toLowerCase())
      
      if (contractOwner.toLowerCase() !== resolverAddress.toLowerCase()) {
        return NextResponse.json(
          { 
            error: `Access denied: We are not the owner of the Resolver contract`,
            contractOwner,
            ourAddress: resolverAddress,
            note: 'Only the contract owner can call deploySrc'
          },
          { status: 403 }
        )
      }
    } catch (ownerCheckError) {
      console.log('⚠️ Could not verify contract owner:', ownerCheckError)
    }

    // Parse signature components
    const sigObj = ethers.Signature.from(signature)
    const r = sigObj.r
    const vs = sigObj.yParityAndS

    console.log('🔧 Constructing REAL Resolver.deploySrc call...')
    console.log('Signature r:', r)
    console.log('Signature vs:', vs)

    // 🔥 REAL: Call Resolver.deploySrc (exactly like the test)
    // Convert order to array format
    const orderArray = [
      orderData.salt,
      orderData.maker,
      orderData.receiver,
      orderData.makerAsset,
      orderData.takerAsset,
      orderData.makingAmount,
      orderData.takingAmount,
      orderData.makerTraits
    ]

    console.log('Order array:', orderArray)

    // Extract takingAmount that was missing
    const takingAmountBigInt = takingAmount ? BigInt(takingAmount) : fillAmountBigInt

    // 🎯 REAL TRANSACTION: Call Resolver.deploySrc (exactly like main.spec.ts)
    const deploySrcTxRequest = {
      to: config.source.resolver,
      data: resolverInterface.encodeFunctionData('deploySrc', [
        immutables,                           // Real SDK immutables from frontend
        orderArray,                           // order.build()
        r,                                   // signature r
        vs,                                  // signature vs  
        fillAmountBigInt,                    // amount
        BigInt(takerTraits?.value || '0'),   // trait: TakerTraits as BigInt
        takerTraits?.args || '0x'            // args: bytes
      ]),
      value: safetyDeposit ? BigInt(safetyDeposit) : 0n
    }

    console.log('To:', deploySrcTxRequest.to)
    console.log('Value (safety deposit):', ethers.formatEther(deploySrcTxRequest.value || 0n), 'ETH')
    
    // Execute the real deploySrc transaction
    // get the balance of the resolver before and after the transaction
    const beforeBalance = await provider.getBalance(resolverAddress)
    console.log('Before balance:', ethers.formatEther(beforeBalance), 'ETH')
    const tx = await resolverSigner.sendTransaction({
      ...deploySrcTxRequest,
      gasLimit: BigInt(500000), // Example gas limit
      maxFeePerGas: ethers.parseUnits("50", "gwei"), // Example gas price
    });
    
    console.log('✅ REAL deploySrc transaction sent:', tx.hash)
    
    // Wait for confirmation
  // Wait for confirmation
try {
  const receipt = await tx.wait();
  console.log('✅ REAL deploySrc transaction confirmed!');
  console.log('Block number:', receipt?.blockNumber);
  console.log('Gas used:', receipt?.gasUsed?.toString());
  console.log('Status:', receipt?.status); // 1 = success, 0 = failed
  
  // Parse and log all events
  console.log('📋 Transaction Logs:');
  console.log('Total logs:', receipt?.logs?.length || 0);
  
  if (receipt?.logs && receipt.logs.length > 0) {
    receipt.logs.forEach((log, index) => {
      console.log(`Log ${index}:`, {
        address: log.address,
        topics: log.topics,
        data: log.data
      });
      
      // Try to decode USDC Transfer events
      if (log.address.toLowerCase() === config.source.tokens.USDC.toLowerCase()) {
        try {
          const transferInterface = new ethers.Interface([
            'event Transfer(address indexed from, address indexed to, uint256 value)'
          ]);
          const decoded = transferInterface.parseLog({
            topics: log.topics,
            data: log.data
          });
          console.log(`🔄 USDC Transfer Event:`, {
            from: decoded?.args.from,
            to: decoded?.args.to,
            value: ethers.formatUnits(decoded?.args.value, 6) + ' USDC'
          });
        } catch (decodeError) {
          console.log('Could not decode as Transfer event:', decodeError);
        }
      }
    });
  } else {
    console.log('⚠️  NO EVENTS EMITTED - This might indicate the transaction did not perform expected operations');
  }
  
} catch (err) {
  console.error("Transaction failed with error:", err);
}
    // console.log('✅ REAL deploySrc transaction confirmed!')
    // console.log('Block number:', receipt?.blockNumber)
    // console.log('Gas used:', receipt?.gasUsed?.toString())
    
    // REAL USDC is now locked in escrow contract, user's balance is reduced

    return NextResponse.json({
      success: true,
      txHash: tx.hash,
      blockNumber: 'pending',
      gasUsed: 'pending',
      resolverAddress,
      userAddress,
      fillAmount,
      message: 'REAL Resolver.deploySrc executed successfully - USDC locked in escrow!',
      escrowDeployed: true,
      realTransaction: true
    })

  } catch (error) {
    console.error('Deploy source API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to execute REAL deploySrc', 
        details: error?.toString()
      },
      { status: 500 }
    )
  }
} 