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

import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { GasPrice } from '@cosmjs/stargate'

dotenv.config()


// const mnemonic = process.env.MNEMONIC as string 
// const mnemonic2 = process.env.MNEMONIC2 as string

// const wallet = PrivateKey.fromMnemonic(mnemonic)
// const address = wallet.toAddress().toBech32()


const codeId = 33343 // e.g. "33340"
const contractLabel = 'CW20 Atomic Swap'
const gas = { gas: 2_000_000, gasPrice: 500_000_000 } // adjust if needed
//const recipientAddress = process.env.RECIPIENT        // e.g. 'inj1...'
const contractAddress = "inj1rxrklxvejj93j7zqfpsd8a3c8n2xf4nakuwc6w"

//const preimage = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
//const hash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex')

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
/*
// Add this new function for Keplr wallet users
export async function fund_dst_escrow_with_keplr(
  hash: string, 
  amount: string, 
  recipient: string, 
  expiresAtHeight: number,
  swapId: string
) {
  // Connect to Keplr
  if (!window.keplr) {
    throw new Error('Keplr wallet not found')
  }

  const chainId = 'injective-888' // Injective testnet chain ID
  await window.keplr.enable(chainId)
  
  const key = await window.keplr.getKey(chainId)
  const userAddress = key.bech32Address
  // // Get Keplr's offline signer
  // const offlineSigner = window.keplr.getOfflineSigner(chainId)
  // const accounts = await offlineSigner.getAccounts()
  // const userAddress = accounts[0].address

  console.log('🔧 KEPLR FUNDING - User address:', userAddress)
  console.log('- contractAddress:', contractAddress)
  console.log('- hash:', hash)
  console.log('- amount:', amount)
  console.log('- recipient:', recipient)
  console.log('- expiresAtHeight:', expiresAtHeight)
  console.log('- swapId:', swapId)

//    const client = await SigningCosmWasmClient.connectWithSigner(
//     'https://testnet.sentry.tm.injective.network:443',
//     offlineSigner,
//     {
//       gasPrice: GasPrice.fromString('500000000inj'),
//     }
//   )

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

//   const funds = [{ denom: 'inj', amount: amount }]

//   const result = await client.execute(
//     userAddress,
//     contractAddress,
//     executeMsg,
//     'auto', // fee
//     undefined, // memo
//     funds
//   )

//   console.log('✅ Destination escrow funded with Keplr')
//   console.log('Tx Hash:', result.transactionHash)
  
//   return { swapId, txHash: result.transactionHash }
// }
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

  // Use Keplr's suggest and send transaction
  const tx = {
    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
    value: {
      sender: userAddress,
      contract: contractAddress,
      msg: new TextEncoder().encode(JSON.stringify(executeMsg)),
      funds: [{ denom: 'inj', amount: amount }],
    },
  }

  // Send transaction with Keplr
  const result = await window.keplr.sendTx(
    chainId,
    {
      msg: [tx],
      fee: {
        amount: [{ denom: 'inj', amount: '5000000000000000' }],
        gas: '200000',
      },
      memo: '',
    },
    'sync'
  )

  console.log('✅ Destination escrow funded with Keplr')
  console.log('Tx Hash:', result)
  
  return { swapId, txHash: result }
}
*/
// export async function fund_dst_escrow_with_keplr(
//   hash: string, 
//   amount: string, 
//   recipient: string, 
//   expiresAtHeight: number,
//   swapId: string
// ) {
//   // Connect to Keplr
//   if (!window.keplr) {
//     throw new Error('Keplr wallet not found')
//   }

//   const chainId = 'injective-888' // Injective testnet chain ID
//   await window.keplr.enable(chainId)
  
//   // Get account info from Keplr
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

//   // Create the transaction message
//   const msg = MsgExecuteContractCompat.fromJSON({
//     sender: userAddress,
//     contractAddress,
//     msg: executeMsg,
//     funds: [
//       {
//         amount: amount,
//         denom: 'inj',
//       },
//     ],
//   })

//   // Get the tx raw data that Keplr can sign
//   const txRaw = await createTransaction({
//     message: [msg],
//     memo: '',
//     fee: {
//       amount: [{ denom: 'inj', amount: '5000000000000000' }], // 0.005 INJ
//       gas: '200000',
//     },
//     pubKey: key.pubKey,
//     sequence: 0, // Will be fetched automatically
//     timeoutHeight: 0,
//     accountNumber: 0, // Will be fetched automatically
//     chainId: 'injective-888',
//   })

//   // Sign with Keplr
//   const response = await window.keplr.sendTx(
//     chainId,
//     txRaw,
//     'sync' // broadcast mode
//   )

//   // Wait for confirmation
//   await new Promise(resolve => setTimeout(resolve, 3000))

//   console.log('✅ Destination escrow funded with Keplr')
//   console.log('Tx Hash:', response)
  
//   return { swapId, txHash: response }
// }


/*
// --- add these imports ---
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { fromBase64 } from '@cosmjs/encoding'
import { ChainRestAuthApi } from '@injectivelabs/sdk-ts'



// --- replace your fund_dst_escrow_with_keplr implementation with this ---
export async function fund_dst_escrow_with_keplr(
  hash: string,
  amount: string,
  recipient: string,
  expiresAtHeight: number,
  swapId: string
) {
  const chainId = 'injective-888'
  const restEndpoint = 'https://testnet.sentry.lcd.injective.network'

  if (!window.keplr) throw new Error('Keplr wallet not found')

  await window.keplr.enable(chainId)
  const key = await window.keplr.getKey(chainId)
  const userAddress = key.bech32Address

  console.log('🔧 KEPLR FUNDING - User address:', userAddress)

  // 1) Build the execute message (same as before)
  const executeMsg = {
    create: {
      id: swapId,
      hash,
      recipient,
      expires: { at_height: expiresAtHeight },
    },
  }

  // 2) Wrap into Injective Msg
  const msg = MsgExecuteContractCompat.fromJSON({
    sender: userAddress,
    contractAddress,
    msg: executeMsg,
    funds: [{ denom: 'inj', amount }],
  })

  // 3) Fetch accountNumber & sequence
  const authApi = new ChainRestAuthApi(restEndpoint)
  const { account } = await authApi.fetchCosmosAccount(userAddress)
  const accountNumber = account.base_account.account_number
  const sequence = account.base_account.sequence

  // 4) Create unsigned TxRaw (bodyBytes/authInfoBytes)
  const fee = {
    amount: [{ denom: 'inj', amount: '5000000000000000' }], // 0.005 INJ
    gas: '200000',
  }

  const { txRaw } = createTransaction({
    message: [msg],
    memo: '',
    fee,
    pubKey: key.pubKey,     // from Keplr
    sequence,               // fetched above
    accountNumber,          // fetched above
    chainId,
    timeoutHeight: 0,
  })

  // 5) Sign with Keplr (direct)
  const signResp = await window.keplr.signDirect(chainId, userAddress, {
    bodyBytes: txRaw.bodyBytes,
    authInfoBytes: txRaw.authInfoBytes,
    chainId,
    accountNumber: String(accountNumber),
  })

  // 6) Produce final TxRaw bytes
  const signedTxRaw = TxRaw.fromPartial({
    bodyBytes: txRaw.bodyBytes,
    authInfoBytes: txRaw.authInfoBytes,
    signatures: [fromBase64(signResp.signature.signature)],
  })
  const txBytes = TxRaw.encode(signedTxRaw).finish()

  // 7) Broadcast
  const resultBytes = await window.keplr.sendTx(chainId, txBytes, 'sync')

  // Convert result (Uint8Array) to hex hash for logs if you want:
  const txHashHex = Buffer.from(resultBytes).toString('hex').toUpperCase()

  console.log('✅ Destination escrow funded with Keplr')
  console.log('Tx Hash:', txHashHex)

  return { swapId, txHash: txHashHex }
}

*/


// First, add proper type declaration for Keplr at the top of the file
declare global {
  interface Window {
    keplr: {
      enable: (chainId: string) => Promise<void>;
      getOfflineSigner: (chainId: string) => any;
      getKey: (chainId: string) => Promise<any>;
      sendTx: (chainId: string, tx: Uint8Array, mode: string) => Promise<Uint8Array>; // Add this
      signDirect: (chainId: string, signer: string, signDoc: any) => Promise<any>; // Add this too
    };
  }
}

// export async function fund_dst_escrow_with_keplr(
//   hash: string, 
//   amount: string, 
//   recipient: string, 
//   expiresAtHeight: number,
//   swapId: string
// ) {
//   // Connect to Keplr
//   if (!window.keplr) {
//     throw new Error('Keplr wallet not found')
//   }

//   const chainId = 'injective-888' // Injective testnet chain ID
//   await window.keplr.enable(chainId)
  
//   // Get account info from Keplr
//   const key = await window.keplr.getKey(chainId)
//   const userAddress = key.bech32Address

//   console.log('🔧 KEPLR FUNDING - User address:', userAddress)
//   console.log('- contractAddress:', contractAddress)
//   console.log('- hash:', hash)
//   console.log('- amount:', amount)
//   console.log('- recipient:', recipient)
//   console.log('- expiresAtHeight:', expiresAtHeight)
//   console.log('- swapId:', swapId)

//   // Create the execute message (following your working pattern)
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

//   // Create proto message for CosmWasm execution
//   const proto = [{
//     typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
//     value: {
//       sender: userAddress,
//       contract: contractAddress,
//       msg: new TextEncoder().encode(JSON.stringify(executeMsg)),
//       funds: [{ denom: 'inj', amount: amount }],
//     },
//   }]

//   // Create fee structure (following your pattern)
//   const fee = {
//     amount: [{ denom: 'inj', amount: '5000000000000000' }], // 0.005 INJ
//     gas: '200000',
//   }

//   // Use your working sendMsgs pattern adapted for Injective
//   try {
//     const txHash = await sendMsgsToInjective(chainId, userAddress, proto, fee)
    
//     console.log('✅ Destination escrow funded with Keplr')
//     console.log('Tx Hash:', txHash)
    
//     return { swapId, txHash }
//   } catch (error) {
//     console.error('❌ Keplr transaction failed:', error)
//     throw error
//   }
// }

// Replace the entire fund_dst_escrow_with_keplr function with this simpler version:
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

  const chainId = 'injective-888'
  await window.keplr.enable(chainId)
  
  const key = await window.keplr.getKey(chainId)
  const userAddress = key.bech32Address

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

  // Use Keplr's built-in transaction sending (much simpler)
  const tx = {
    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
    value: {
      sender: userAddress,
      contract: contractAddress,
      msg: new TextEncoder().encode(JSON.stringify(executeMsg)),
      funds: [{ denom: 'inj', amount: amount }],
    },
  }

  try {
    // Use the sendMsgsToInjective helper function to properly construct the transaction
    const txHash = await sendMsgsToInjective(chainId, userAddress, [tx], {
      amount: [{ denom: 'inj', amount: '5000000000000000' }],
      gas: '200000',
    })
    
    const result = txHash

    console.log('✅ Destination escrow funded with Keplr')
    console.log('Tx Hash:', result)
    
    return { swapId, txHash: Buffer.from(result).toString('hex') }
  } catch (error) {
    console.error('❌ Keplr transaction failed:', error)
    throw error
  }
}

import { AuthInfo, Fee, TxRaw, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import  { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing'
import  {PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys'
import Long from 'long'

//import Base64 from 'crypto-js'
// import enc from 'crypto-js'
import Base64 from 'crypto-js/enc-base64';
// import Hex from 'crypto-js/enc-hex';
// import { fromHex } from '@cosmjs/encoding';
import {  enc } from 'crypto-js'



//   const Long = (await import('long')).default

  
// Update the sendMsgsToInjective function:
async function sendMsgsToInjective(chainId: string, sender: string, proto: any[], fee: any) {
  // Get account info from Injective REST API
  const restUrl = 'https://testnet.sentry.lcd.injective.network'
  const account = await fetchAccountInfo(restUrl, sender)
  const { pubKey } = await window.keplr.getKey(chainId)

  if (!account) {
    throw new Error('Could not fetch account info')
  }

  console.log('🔧 DEBUG - Account info for signing:', account)

  // Create transaction body
  const tx = TxBody.encode(
    TxBody.fromPartial({
      messages: proto,
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
          sequence: Long.fromString(account.sequence).toBigInt(), // Convert to bigint
        },
      ],
      fee: Fee.fromPartial({
        amount: fee.amount.map((coin: any) => ({
          denom: coin.denom,
          amount: coin.amount.toString(),
        })),
        gasLimit: Long.fromString(fee.gas).toBigInt(), // Convert gas to bigint
      }),
    }).finish(),
    chainId: chainId,
    accountNumber: Long.fromString(account.account_number).toBigInt(), // Convert to bigint
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

// Helper functions from your working code
// Replace the fetchAccountInfo function:
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

function fromHexString(hexString: string) {
  return Uint8Array.from(hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))
}

function decodeSignature(s: string) {
  return fromHexString(Base64.parse(s).toString(enc.Hex))
}