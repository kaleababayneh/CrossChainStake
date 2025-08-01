import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

// Import contract artifacts (simplified copies in webapp)
const factoryContract = require('../../../lib/TestEscrowFactory.json')
const resolverContract = require('../../../lib/Resolver.json')

// Resolver configuration for EVM transactions (same as test)
const resolverPrivateKey = '0x0a8453b8a66dc0e4cf0afcea4b961b6bcd4bd2d4d378c7512f8eb3a7aea255b3'

// Simple cache for deployed contracts during session - use global to share with withdraw API
declare global {
  var contractCache: { escrowFactory: string; resolver: string; deployedAt: number } | null
}

if (!global.contractCache) {
  global.contractCache = null
}

// Deploy contracts exactly like the working test
async function getOrDeployContracts(provider: ethers.JsonRpcProvider, resolverAddress: string) {
  // Use cached contracts if available and recent (within 1 hour)  
  if (global.contractCache && (Date.now() - global.contractCache.deployedAt) < 3600000) {
    console.log('📋 Using cached contract deployment')
    return global.contractCache
  }

  console.log('🚀 Deploying fresh contracts (exactly like working test)...')
  
  const deployer = new ethers.Wallet(resolverPrivateKey, provider)
  
  // Deploy EscrowFactory (exactly like test)
  console.log('Deploying EscrowFactory...')
  const escrowFactory = await deployContract(
    factoryContract,
    [
      '0x111111125421ca6dc452d289314280a0f8842a65', // limitOrderProtocol
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // wrappedNative (WETH)
      ethers.ZeroAddress,                              // accessToken
      resolverAddress,                                 // owner
      60 * 30,                                         // src rescue delay
      60 * 30                                          // dst rescue delay
    ],
    deployer
  )
  console.log('✅ EscrowFactory deployed to:', escrowFactory)

  // Deploy Resolver (exactly like test)
  console.log('Deploying Resolver...')
  const resolver = await deployContract(
    resolverContract,
    [
      escrowFactory,                                   // escrowFactory
      '0x111111125421ca6dc452d289314280a0f8842a65', // limitOrderProtocol
      resolverAddress                                  // owner
    ],
    deployer
  )
  console.log('✅ Resolver deployed to:', resolver)

  // Cache the deployment
  global.contractCache = { escrowFactory, resolver, deployedAt: Date.now() }
  
  return global.contractCache
}

// Deploy a single contract and return its address
async function deployContract(
  contractJson: { abi: any; bytecode: any },
  constructorArgs: unknown[],
  deployer: ethers.Wallet
): Promise<string> {
  const factory = new ethers.ContractFactory(
    contractJson.abi, 
    contractJson.bytecode, 
    deployer
  )
  
  const contract = await factory.deploy(...constructorArgs)
  await contract.waitForDeployment()
  
  return await contract.getAddress()
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

    // Configuration - infrastructure can be hardcoded, contracts from env vars
    const config = {
      source: {
        chainId: 27270,
        rpcUrl: "https://rpc.buildbear.io/appalling-thepunisher-3e7a9d1c",
        limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
        tokens: {
          USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
        }
      }
    }

    // Set up resolver signer
    const provider = new ethers.JsonRpcProvider(config.source.rpcUrl)
    const resolverSigner = new ethers.Wallet(resolverPrivateKey, provider)
    const resolverAddress = await resolverSigner.getAddress()
    
    // Get contract addresses - deploy fresh if needed (like working test)
    const { escrowFactory, resolver } = await getOrDeployContracts(provider, resolverAddress)
    
    console.log('📋 Using contract addresses:')
    console.log('Resolver:', resolver)
    console.log('Escrow Factory:', escrowFactory)
    console.log('Resolver signer address:', resolverAddress)

    // Validate contracts were obtained
    if (!resolver || !escrowFactory) {
      return NextResponse.json(
        { 
          error: 'Failed to deploy contracts',
          details: 'Contract deployment returned null addresses'
        },
        { status: 500 }
      )
    }

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
      const resolverContract = new ethers.Contract(resolver, resolverInterface, provider)
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

              // 🚨 CRITICAL FIX: Convert immutables object to array format (like working test)
          const immutablesArray = [
            immutables.orderHash,        // 0: bytes32
            immutables.hashlock,         // 1: bytes32  
            immutables.maker,            // 2: Address (as string)
            immutables.taker,            // 3: Address (as string)
            immutables.token,            // 4: Address (as string)
            immutables.amount,           // 5: uint256 (as string)
            immutables.safetyDeposit,    // 6: uint256 (as string)
            immutables.timelocks         // 7: Timelocks (as string)
          ]

          // 🔍 DETAILED PARAMETER LOGGING FOR DEBUGGING
          console.log('🧪 DEPLOYSRC FUNCTION PARAMETERS:')
          console.log('Parameter 1 - immutables (ORIGINAL OBJECT):', JSON.stringify(immutables, null, 2))
          console.log('Parameter 1 - immutablesArray (CONVERTED):', JSON.stringify(immutablesArray, null, 2))
          console.log('Parameter 2 - orderArray:', JSON.stringify(orderArray, null, 2))
          console.log('Parameter 3 - r (signature):', r)
          console.log('Parameter 4 - vs (signature):', vs)
          console.log('Parameter 5 - fillAmountBigInt:', fillAmountBigInt.toString())
          console.log('Parameter 6 - takerTraits.value as BigInt:', BigInt(takerTraits?.value || '0').toString())
          console.log('Parameter 7 - takerTraits.args:', takerTraits?.args || '0x')
          
          // 🔍 TYPE CHECKS
          console.log('🧪 PARAMETER TYPE CHECKS:')
          console.log('immutablesArray type:', typeof immutablesArray, 'isArray:', Array.isArray(immutablesArray))
          console.log('orderArray type:', typeof orderArray, 'isArray:', Array.isArray(orderArray))
          console.log('r type:', typeof r)
          console.log('vs type:', typeof vs)
          console.log('fillAmountBigInt type:', typeof fillAmountBigInt)
          console.log('takerTraits.value type:', typeof (takerTraits?.value))
          console.log('takerTraits.args type:', typeof (takerTraits?.args))
          
          // 🎯 REAL TRANSACTION: Call Resolver.deploySrc using Contract interface (like working test)
          const resolverContractInstance = new ethers.Contract(resolver, resolverInterface, resolverSigner)
          
          console.log('🔧 CALLING DEPLOYSRC VIA CONTRACT INTERFACE INSTEAD OF RAW DATA...')
          console.log('Contract address:', resolverContractInstance.target)
          console.log('Signer:', await resolverSigner.getAddress())
          
          console.log('✅ All parameters ready for direct contract call!')
    
    // Execute the real deploySrc transaction using working test pattern
    const beforeBalance = await provider.getBalance(resolverAddress)
    console.log('Before balance:', ethers.formatEther(beforeBalance), 'ETH')
    
    // 🎯 CALL CONTRACT FUNCTION DIRECTLY (like working test does)
    console.log('🚀 CALLING DEPLOYSRC DIRECTLY ON CONTRACT...')
    
    const tx = await resolverContractInstance.deploySrc(
      immutablesArray,                      // ✅ FIXED: Use array format like working test
      orderArray,                           // order.build()
      r,                                   // signature r
      vs,                                  // signature vs
      fillAmountBigInt,                    // amount
      BigInt(takerTraits?.value || '0'),   // trait: TakerTraits as BigInt
      takerTraits?.args || '0x',           // args: bytes
      {
        value: safetyDeposit ? BigInt(safetyDeposit) : 0n,
        gasLimit: 10_000_000
      }
    );
    
    console.log('✅ REAL deploySrc transaction sent:', tx.hash)
    
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
                     receipt.logs.forEach((log: any, index: number) => {
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
      
      // REAL USDC is now locked in escrow contract, user's balance is reduced
      return NextResponse.json({
        success: true,
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber,
        gasUsed: receipt?.gasUsed?.toString(),
        resolverAddress,
        userAddress,
        fillAmount,
        message: 'REAL Resolver.deploySrc executed successfully - USDC locked in escrow!',
        escrowDeployed: true,
        realTransaction: true,
        // ✅ Extract escrow address from USDC Transfer event logs
        escrowAddress: (() => {
          if (receipt?.logs && receipt.logs.length > 0) {
            const usdcTransferLog = receipt.logs.find((log: any) => 
              log.address.toLowerCase() === config.source.tokens.USDC.toLowerCase() &&
              log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' // Transfer event signature
            )
            if (usdcTransferLog && usdcTransferLog.topics.length >= 3) {
              return '0x' + usdcTransferLog.topics[2].slice(26) // topics[2] is the 'to' address
            }
          }
          return null
        })(),
        // ✅ Return the built immutables array for withdrawal
        immutablesBuilt: immutables,
        // ✅ Return the secret bytes for withdrawal
        secretBytes: extensionData
      })
      
    } catch (err) {
      console.error("Transaction failed with error:", err);
      return NextResponse.json(
        { 
          error: 'Failed to execute REAL deploySrc', 
          details: err?.toString()
        },
        { status: 500 }
      )
    }

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