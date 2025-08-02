//import { AptosAccount, AptosClient, TxnBuilderTypes, BCS } from "aptos";
import { ethers} from "ethers";
import { createHash } from 'crypto';
import {
  MsgExecuteContractCompat,
  MsgInstantiateContract,
  PrivateKey,
  MsgBroadcasterWithPk,
  // Add these Injective-specific imports:
  ChainGrpcWasmApi,
  createTransaction,
  ChainRestTendermintApi,
} from '@injectivelabs/sdk-ts'
import { keccak256 } from 'ethers'
import * as dotenv from 'dotenv'
import {  Network } from '@injectivelabs/networks'
import { ChainId} from '@injectivelabs/ts-types';
import { MsgBroadcaster } from '@injectivelabs/wallet-core'
import { getNetworkEndpoints } from '@injectivelabs/networks'
import { WalletStrategy } from '@injectivelabs/wallet-strategy'
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { GasPrice } from '@cosmjs/stargate'
import {
  BaseAccount,
  ChainRestAuthApi,
  TxRaw,
  CosmosTxV1Beta1Tx,
  BroadcastModeKeplr,
  getTxRawFromTxRawOrDirectSignResponse,
  TxRestApi,
} from '@injectivelabs/sdk-ts'
import { getStdFee, DEFAULT_BLOCK_TIMEOUT_HEIGHT } from '@injectivelabs/utils'
import { BigNumberInBase } from '@injectivelabs/utils'
import { TransactionException } from '@injectivelabs/exceptions'
import { SignDoc } from '@keplr-wallet/types'
import Long from 'long'

dotenv.config()


const codeId = 33343 // e.g. "33340"
const contractLabel = 'CW20 Atomic Swap'
const gas = { gas: 2_000_000, gasPrice: 500_000_000 } // adjust if needed
const contractAddress = "inj1rxrklxvejj93j7zqfpsd8a3c8n2xf4nakuwc6w"

export async function initializeSwapLedger() {
  const wallet = PrivateKey.fromMnemonic(process.env.MNEMONIC as string)
  const address = wallet.toAddress().toBech32()
  const instantiateMsg = {} // Your instantiateMsg is empty

  const msg = MsgInstantiateContract.fromJSON({
    sender: address,
    admin: '', // no-admin
    codeId,
    label: contractLabel,
    msg: instantiateMsg,
  })

  const broadcaster = new MsgBroadcasterWithPk({
    network: Network.Testnet, 
    chainId: ChainId.Testnet,
    privateKey: wallet,
    endpoints: {
      indexer: 'https://testnet.sentry.exchange.grpc-web.injective.network',
      grpc: 'https://testnet.sentry.chain.grpc-web.injective.network',
      rest: 'https://testnet.sentry.lcd.injective.network',
    },
  })

  const response = await broadcaster.broadcast({
    msgs: msg,
  })

  console.log('✅ Contract instantiated!')
  console.log('Tx Hash:', response.txHash)
}

export async function anounce_order() {
  const wallet = PrivateKey.fromMnemonic(process.env.MNEMONIC as string)
  const address = wallet.toAddress().toBech32()
  console.log('🔧 RESOLVER DEBUG - announce_order called')
  console.log('- address:', address)
  console.log('- contractAddress:', contractAddress)
    const preimage = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
    const hash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex')
  
    const broadcaster = new MsgBroadcasterWithPk({
      network: Network.Testnet,
      chainId: ChainId.Testnet,
      privateKey: wallet,
      endpoints: {
        indexer: 'https://testnet.sentry.exchange.grpc-web.injective.network',
        grpc: 'https://testnet.sentry.chain.grpc-web.injective.network',
        rest: 'https://testnet.sentry.lcd.injective.network',
      },
    })
  
    const expiresAtHeight = 90_000_000
  
    const swapId = 'swap-cusdc-001'
  
    // This is the message that the CW20 token contract expects
 
    
    const executeMsg = {
      create: {
        id: swapId,
        hash,
        recipient: address, // This is the address that will receive the funds when the swap is claimed
        expires: {
          at_height: expiresAtHeight
        }
      }
    }

      
    const funds = [{
      amount: '10000000000000000', // 0.001 INJ in wei (18 decimals)
      denom: 'inj'
    }]
  

    const msg = MsgExecuteContractCompat.fromJSON({
      sender: address,
      contractAddress,
      msg: executeMsg,
      funds,
    })
  

    const tx = await broadcaster.broadcast({
      msgs: msg,
    })
  
    console.log('✅ CUSDC Swap announced!')
    console.log('Tx Hash:', tx.txHash)
    console.log('Hash (SHA256):', hash)
}

export async function fund_dst_escrow_with_params(
  hash: string, 
  amount: string, 
  recipient: string, 
  expiresAtHeight: number,
  swapId: string,
  privateMnemonic: string 
) {

  const wallet = PrivateKey.fromMnemonic(privateMnemonic)
  const address = wallet.toAddress().toBech32()
  console.log('🔧 RESOLVER DEBUG - fund_dst_escrow_with_params called')
  console.log('- address:', address)
  console.log('- contractAddress:', contractAddress)
  console.log('- hash:', hash)
  console.log('- amount:', amount)
  console.log('- recipient:', recipient)
  console.log('- expiresAtHeight:', expiresAtHeight)
  console.log('- swapId:', swapId)
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

  console.log('🔧 RESOLVER DEBUG - fund_dst_escrow_with_params called')
  console.log('- address:', address)
  console.log('- contractAddress:', contractAddress)
  console.log('- hash:', hash)
  console.log('- amount:', amount)
  console.log('- recipient:', recipient)
  console.log('- expiresAtHeight:', expiresAtHeight)
  console.log('- swapId:', swapId)

  const executeMsg = {
    create: {
      id: swapId,
      hash,
      recipient,
      expires: {
        at_height: expiresAtHeight,
      },
    },
  }

  console.log('🔧 RESOLVER DEBUG - executeMsg:', executeMsg)
  console.log('🔧 RESOLVER DEBUG - amount:', amount)


  const msg = MsgExecuteContractCompat.fromJSON({
    sender: address,
    contractAddress, // your swap contract address
    msg: executeMsg,
    funds: [
      {
        amount: amount, // native INJ amount in uinj
        denom: 'inj',
      },
    ],
  })

  console.log('🔧 RESOLVER DEBUG - msg:', msg)
  console.log('🔧 RESOLVER DEBUG - msg length:', JSON.stringify(msg))


  const tx = await broadcaster.broadcast({ msgs: msg })

  await new Promise(resolve => setTimeout(resolve, 2000))

  
  console.log('✅ Destination escrow funded on Injective')
  console.log('Tx Hash:', tx.txHash)
  console.log('Swap ID:', swapId)
  
  return { swapId, txHash: tx.txHash }
} 

export async function claim_funds_with_params_resolver(
  swapId: string, 
  preimage: string,
  recipientAddress: string,
  privateMnemonic: string,
)

  {

  const wallet = PrivateKey.fromMnemonic(privateMnemonic)
  const address = wallet.toAddress().toBech32()

  const broadcaster = new MsgBroadcasterWithPk({
      network: Network.Testnet,
      chainId: ChainId.Testnet,
      privateKey: wallet, // Resolver wallet, not user wallet
      endpoints: {
          grpc: 'https://testnet.sentry.chain.grpc-web.injective.network',
          rest: 'https://testnet.sentry.lcd.injective.network',
          indexer: 'https://testnet.sentry.exchange.grpc-web.injective.network',
      },
  })

  const executeMsg = {
    release: {
      id: swapId,
      preimage,
      recipient: recipientAddress,
    },
  }

  const msg = MsgExecuteContractCompat.fromJSON({
    sender: address, // Resolver address
    contractAddress, // Escrow contract
    msg: executeMsg,
    funds: [], // Nothing to send — just unlocking escrow
  })

  const tx = await broadcaster.broadcast({ msgs: msg })

  console.log('✅ Resolver successfully claimed native INJ!')
  console.log('Tx Hash:', tx.txHash)

  return tx.txHash
} 

// Add this import at the top (you might already have it):

// Replace the fund_dst_escrow_with_keplr function:
// export async function fund_dst_escrow_with_keplr(
//   hash: string, 
//   amount: string, 
//   recipient: string, 
//   expiresAtHeight: number,
//   swapId: string
// ) {
//   if (!window.keplr) {
//     throw new Error('Keplr wallet not found')
//   }

//   const chainId = 'injective-888'
//   await window.keplr.enable(chainId)
  
//   const key = await window.keplr.getKey(chainId)
//   const userAddress = key.bech32Address

//   console.log('🔧 KEPLR FUNDING - User address:', userAddress)
//   console.log('- contractAddress:', contractAddress)
//   console.log('- hash:', hash)
//   console.log('- amount:', amount)
//   console.log('- recipient:', recipient)
//   console.log('- expiresAtHeight:', expiresAtHeight)
//   console.log('- swapId:', swapId)

//   // Create the execute message
//   const executeMsg = {
//     create: {
//       id: swapId,
//       hash,
//       recipient,
//       expires: {
//         at_height: expiresAtHeight,
//       },
//     },
//   }

//   try {
//     // Use Injective's MsgBroadcaster with Keplr's offline signer
//     const broadcaster = new MsgBroadcaster({
//       network: Network.Testnet,
//       endpoints: {
//         grpc: 'https://testnet.sentry.chain.grpc-web.injective.network',
//         rest: 'https://testnet.sentry.lcd.injective.network',
//         indexer: 'https://testnet.sentry.exchange.grpc-web.injective.network',
//       },
//     })

//     const msg = MsgExecuteContractCompat.fromJSON({
//       sender: userAddress,
//       contractAddress,
//       msg: executeMsg,
//       funds: [
//         {
//           amount: amount,
//           denom: 'inj',
//         },
//       ],
//     })

//     // Get Keplr's offline signer
//     const offlineSigner = window.keplr.getOfflineSigner(chainId)

//     console.log('🔧 DEBUG - About to broadcast with Injective SDK + Keplr')

//     // Use Injective's broadcaster with Keplr signer
//     const result = await broadcaster.broadcastWithOfflineSigner({
//       msgs: [msg],
//       offlineSigner,
//     })

//     console.log('✅ Destination escrow funded with Keplr + Injective SDK')
//     console.log('Tx Hash:', result.txHash)
    
//     return { swapId, txHash: result.txHash }
//   } catch (error) {
//     console.error('❌ Keplr transaction failed:', error)
//     throw error
//   }
// }


// Remove this incorrect import:
// import { MsgBroadcaster } from '@injectivelabs/wallet-core'

// Update the fund_dst_escrow_with_keplr function:
// Fix the imports at the top (remove the incorrect import):
// Remove this line:
// import WalletType from '@injectivelabs/wallet-core'

// Add the correct import:

// Update the fund_dst_escrow_with_keplr function:
// export async function fund_dst_escrow_with_keplr(
//   hash: string, 
//   amount: string, 
//   recipient: string, 
//   expiresAtHeight: number,
//   swapId: string
// ) {
//   if (!window.keplr) {
//     throw new Error('Keplr wallet not found')
//   }

//   const chainId = 'injective-888'
//   await window.keplr.enable(chainId)
  
//   const key = await window.keplr.getKey(chainId)
//   const userAddress = key.bech32Address

//   console.log('🔧 KEPLR FUNDING - User address:', userAddress)
//   console.log('- contractAddress:', contractAddress)
//   console.log('- hash:', hash)
//   console.log('- amount:', amount)
//   console.log('- recipient:', recipient)
//   console.log('- expiresAtHeight:', expiresAtHeight)
//   console.log('- swapId:', swapId)

//   // Create the execute message
//   const executeMsg = {
//     create: {
//       id: swapId,
//       hash,
//       recipient,
//       expires: {
//         at_height: expiresAtHeight,
//       },
//     },
//   }

//   try {
//     // Create WalletStrategy for Keplr (using correct Wallet enum)
//     const walletStrategy = new WalletStrategy({
//       chainId: ChainId.Testnet,
//       wallet: Wallet.Keplr,
//       strategies: 
//     })

//     // Set the wallet explicitly
//     await walletStrategy.setWallet(Wallet.Keplr)

//     // Set up MsgBroadcaster with WalletStrategy
//     const msgBroadcaster = new MsgBroadcaster({
//       walletStrategy,
//       network: Network.Testnet,
//       endpoints: getNetworkEndpoints(Network.Testnet),
//       simulateTx: true,
//       gasBufferCoefficient: 1.2,
//     })

//     const msg = MsgExecuteContractCompat.fromJSON({
//       sender: userAddress,
//       contractAddress,
//       msg: executeMsg,
//       funds: [
//         {
//           amount: amount,
//           denom: 'inj',
//         },
//       ],
//     })

//     console.log('🔧 DEBUG - About to broadcast with Injective MsgBroadcaster + WalletStrategy')

//     // Broadcast using the proper interface
//     const result = await msgBroadcaster.broadcast({
//       injectiveAddress: userAddress,
//       msgs: msg,
//     })

//     console.log('✅ Destination escrow funded with Keplr + Injective SDK')
//     console.log('Tx Hash:', result.txHash)
    
//     return { swapId, txHash: result.txHash }
//   } catch (error) {
//     console.error('❌ Keplr transaction failed:', error)
//     throw error
//   }
// }


// Add these imports at the top:


// Remove the problematic WalletStrategy imports and unused functions

// Replace your fund_dst_escrow_with_keplr function with this official pattern:
export async function fund_dst_escrow_with_keplr(
  hash: string, 
  amount: string, 
  recipient: string, 
  expiresAtHeight: number,
  swapId: string
) {
  if (!window.keplr) {
    throw new Error('Keplr wallet not found')
  }

  const chainId = 'injective-888' // Injective testnet chain ID
  await window.keplr.enable(chainId)
  
  const key = await window.keplr.getKey(chainId)
  const offlineSigner = window.keplr.getOfflineSigner(chainId)
  const userAddress = key.bech32Address
  const pubKey = Buffer.from(key.pubKey).toString('base64')

  console.log('🔧 KEPLR FUNDING - User address:', userAddress)
  console.log('- contractAddress:', contractAddress)
  console.log('- hash:', hash)
  console.log('- amount:', amount)
  console.log('- recipient:', recipient)
  console.log('- expiresAtHeight:', expiresAtHeight)
  console.log('- swapId:', swapId)

  // Create the execute message
  const executeMsg = {
    create: {
      id: swapId,
      hash,
      recipient,
      expires: {
        at_height: expiresAtHeight,
      },
    },
  }

  try {
    const restEndpoint = 'https://testnet.sentry.lcd.injective.network'

    // Step 1: Get account details
    const chainRestAuthApi = new ChainRestAuthApi(restEndpoint)
    const accountDetailsResponse = await chainRestAuthApi.fetchAccount(userAddress)
    const baseAccount = BaseAccount.fromRestApi(accountDetailsResponse)

    // Step 2: Get block details for timeout
    const chainRestTendermintApi = new ChainRestTendermintApi(restEndpoint)
    const latestBlock = await chainRestTendermintApi.fetchLatestBlock()
    const latestHeight = latestBlock.header.height
    const timeoutHeight = new BigNumberInBase(latestHeight).plus(DEFAULT_BLOCK_TIMEOUT_HEIGHT)

    // Step 3: Create the contract execution message
    const msg = MsgExecuteContractCompat.fromJSON({
      sender: userAddress,
      contractAddress,
      msg: executeMsg,
      funds: [
        {
          amount: amount,
          denom: 'inj',
        },
      ],
    })
    // Step 4: Prepare the transaction
    const { signDoc } = createTransaction({
      pubKey,
      chainId,
      fee: getStdFee({ gas: '200000' }), // Adjust gas as needed
      message: msg,
      sequence: baseAccount.sequence,
      timeoutHeight: timeoutHeight.toNumber(),
      accountNumber: baseAccount.accountNumber,
    })

    console.log('🔧 DEBUG - About to sign transaction with Keplr')

    // Step 5: Sign the transaction - Convert accountNumber to Long for Keplr compatibility
    const keplrSignDoc = {
      ...signDoc,
      accountNumber: Long.fromString(signDoc.accountNumber.toString())
    }
    
    const directSignResponse = await offlineSigner.signDirect(
      userAddress,
      keplrSignDoc as SignDoc
    )
    

    // Step 6: Get the signed transaction
    const txRaw = getTxRawFromTxRawOrDirectSignResponse(directSignResponse)

    // Step 7: Broadcast the transaction
    const result = await window.keplr.sendTx(
      chainId,
      CosmosTxV1Beta1Tx.TxRaw.encode(txRaw).finish(),
      BroadcastModeKeplr.Sync
    )

    if (!result || result.length === 0) {
      throw new TransactionException(
        new Error('Transaction failed to be broadcasted'),
        { contextModule: 'Keplr' }
      )
    }

    const txHash = Buffer.from(result).toString('hex')

    // Step 8: Wait for transaction confirmation
    const txRestApi = new TxRestApi(restEndpoint)
    await txRestApi.fetchTxPoll(txHash)

    console.log('✅ Destination escrow funded with Keplr')
    console.log('Tx Hash:', txHash)
    
    return { swapId, txHash }
  } catch (error) {
    console.error('❌ Keplr transaction failed:', error)
    throw error
  }
}




/*


import { AuthInfo, Fee, TxRaw, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import  { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing'
import  {PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx'
import Long from 'long'
import Base64 from 'crypto-js/enc-base64';
import {  enc } from 'crypto-js'


// Replace the sendMsgsToInjective function:
async function sendMsgsToInjective(chainId: string, sender: string, proto: any[], fee: any) {
  // Get account info from Injective REST API
  const restUrl = 'https://testnet.sentry.lcd.injective.network:443'
  const account = await fetchAccountInfo(restUrl, sender)
  const { pubKey } = await window.keplr.getKey(chainId)

  if (!account) {
    throw new Error('Could not fetch account info')
  }

  console.log('🔧 DEBUG - Account info for signing:', account)
  console.log('🔧 DEBUG - Original proto messages:', proto)
  // FIX: Properly construct the CosmWasm execute message
  const executeMsg = JSON.parse(new TextDecoder().decode(proto[0].value.msg))
  
  const properMessage = {
    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
    value: MsgExecuteContract.encode({
      sender: sender,
      contract: contractAddress,
      msg: Buffer.from(JSON.stringify(executeMsg)),
      funds: proto[0].value.funds,
    }).finish(),
  }

  console.log('🔧 DEBUG - Properly constructed message:', properMessage)

  // Create transaction body
  const tx = TxBody.encode(
    TxBody.fromPartial({
      messages: [properMessage], // Use the properly constructed message
      memo: "Cross-chain swap via 1inch",
    }),
  ).finish()

  // Create sign doc with proper Long handling
  const signDoc = {
    bodyBytes: tx,
    authInfoBytes: AuthInfo.encode({
      signerInfos: [
        {
          publicKey: {
            typeUrl: "/cosmos.crypto.secp256k1.PubKey",
            value: PubKey.encode({
              key: pubKey,
            }).finish(),
          },
          modeInfo: {
            single: {
              mode: SignMode.SIGN_MODE_DIRECT,
            },
            multi: undefined,
          },
          sequence: Long.fromString(account.sequence).toBigInt(),
        },
      ],
      fee: Fee.fromPartial({
        amount: fee.amount.map((coin: any) => ({
          denom: coin.denom,
          amount: coin.amount.toString(),
        })),
        gasLimit: Long.fromString(fee.gas).toBigInt(),
      }),
    }).finish(),
    chainId: chainId,
    accountNumber: Long.fromString(account.account_number),
  }

  console.log('🔧 DEBUG - Sign doc created:', {
    chainId,
    accountNumber: account.account_number,
    sequence: account.sequence
  })

  // Sign with Keplr
  const signed = await window.keplr.signDirect(chainId, sender, signDoc)

  // Create signed transaction
  const signedTx = TxRaw.encode({
    bodyBytes: signed.signed.bodyBytes,
    authInfoBytes: signed.signed.authInfoBytes,
    signatures: [decodeSignature(signed.signature.signature)],
  }).finish()

  // Broadcast transaction
  const txHash = await window.keplr.sendTx(chainId, signedTx, "sync")
  return Buffer.from(txHash).toString("hex")
}

async function fetchAccountInfo(rest: string, address: string) {
  try {
    const uri = `${rest}/cosmos/auth/v1beta1/accounts/${address}`
    const response = await fetch(uri)
    const data = await response.json()
    
    console.log('🔧 DEBUG - Raw account data:', data)
    
    // Handle Injective's EthAccount structure
    let account = data.account
    
    // Check if it's an EthAccount (Injective uses Ethereum-style accounts)
    if (account['@type'] === '/injective.types.v1beta1.EthAccount') {
      // Extract base_account from EthAccount
      account = {
        account_number: account.base_account.account_number,
        sequence: account.base_account.sequence,
        address: account.base_account.address,
        pub_key: account.base_account.pub_key
      }
    } else if (account.base_account) {
      // Handle other account types with base_account
      account = {
        account_number: account.base_account.account_number,
        sequence: account.base_account.sequence,
        address: account.base_account.address,
        pub_key: account.base_account.pub_key
      }
    }
    
    console.log('🔧 DEBUG - Processed account:', account)
    
    // Ensure numeric values are properly formatted
    return {
      account_number: String(account.account_number || '0'),
      sequence: String(account.sequence || '0'),
      address: account.address
    }
  } catch (e) {
    console.error('❌ Failed to fetch account info:', e)
    return undefined
  }
}

// function fromHexString(hexString: string) {
//   return Uint8Array.from(hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))
// }

// function decodeSignature(s: string) {
//   return fromHexString(Base64.parse(s).toString(enc.Hex))
// }
*/