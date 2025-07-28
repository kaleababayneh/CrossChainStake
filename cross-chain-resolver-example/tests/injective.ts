//import { AptosAccount, AptosClient, TxnBuilderTypes, BCS } from "aptos";
import { ethers} from "ethers";
import { createHash } from 'crypto';
import {
  MsgExecuteContractCompat,
  MsgInstantiateContract,
  PrivateKey,
  MsgBroadcasterWithPk,
} from '@injectivelabs/sdk-ts'
import { getNetworkInfo } from '@injectivelabs/networks'
import { toUtf8, toBase64 } from '@cosmjs/encoding'
import { keccak256 } from 'ethers'
import * as dotenv from 'dotenv'
import {  Network } from '@injectivelabs/networks'
import { ChainId} from '@injectivelabs/ts-types';

dotenv.config()


// Using a mnemonic phrase
const mnemonic = process.env.MNEMONIC as string 
const mnemonic2 = process.env.MNEMONIC2 as string

const wallet = PrivateKey.fromMnemonic(mnemonic)
const address = wallet.toAddress().toBech32()

const wallet2 = PrivateKey.fromMnemonic(mnemonic2)
const address2 = wallet2.toAddress().toBech32()

const codeId = 33343 // e.g. "33340"
const contractLabel = 'CW20 Atomic Swap'
const gas = { gas: 2_000_000, gasPrice: 500_000_000 } // adjust if needed
const recipientAddress = process.env.RECIPIENT        // e.g. 'inj1...'
const contractAddress = process.env.CW_20_ATOMIC_SWAP_CONTRACT_ADDRESS as string 
const cusdcAddress = process.env.CUSDC_CONTRACT_ADDRESS as string


const preimage = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
const hash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex')
const SWAP_ID = 'swap-02337775552081' // e.g. 'swap-cusdc-001'
export async function initializeSwapLedger() {
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
    const preimage = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
    const hash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex')
    console.log(`🔐 Announcing order from ${address}`)
  
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
 
    const cw20SendMsg = {
        send: {
          contract: contractAddress,
          amount: '10000000', // 10 CUSDC (6 decimals)
          msg: Buffer.from(JSON.stringify({
            create: {
              id: 'swap0031217389',
              hash,
              recipient: recipientAddress,
              expires: {
                at_height: expiresAtHeight
              }
            }
          })).toString('base64'),
        }
      }
    
  
    const msg = MsgExecuteContractCompat.fromJSON({
      sender: address,
      contractAddress: cusdcAddress, // CW20 token address
      msg: cw20SendMsg,
      funds: [], // no native funds sent
    })
  
    const tx = await broadcaster.broadcast({
      msgs: msg,
    })
  
    console.log('✅ CUSDC Swap announced!')
    console.log('Tx Hash:', tx.txHash)
    console.log('Hash (SHA256):', hash)
}

export async function fund_dst_escrow() {
const preimage = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
   const hash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex')
  console.log(`💰 Funding dst escrow with CUSDC from ${address}`)
  const swapId = SWAP_ID

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

  const expiresAtHeight = 90_000_000

  const escrowMsg = {
    create: {
      id: swapId,
      hash,
      recipient: recipientAddress,
      expires: {
        at_height: expiresAtHeight,
      },
    },
  }

  const cw20Msg = {
    send: {
      contract: contractAddress, // 🧠 Your swap contract address
      amount: '10000000',        // 💰 10 CUSDC (decimals = 6)
      msg: Buffer.from(JSON.stringify(escrowMsg)).toString('base64'),
    },
  }

  const msg = MsgExecuteContractCompat.fromJSON({
    sender: address,
    contractAddress: cusdcAddress, // 🪙 CUSDC CW20 contract
    msg: cw20Msg,
    funds: [], // no native INJ sent
  })

  const tx = await broadcaster.broadcast({ msgs: msg })

  console.log('✅ Counterparty funded dst escrow with CUSDC')
  console.log('Tx Hash:', tx.txHash)
  console.log('Hash (SHA256):', hash)
}

export async function claim_funds() {
    const swapId = SWAP_ID // e.g. 'swap-cusdc-001'
    const preimage = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
    console.log(`🔓 Claiming CUSDC from swap "${swapId}" by revealing preimage from ${address2}`)
  
    const broadcaster = new MsgBroadcasterWithPk({
      network: Network.Testnet,
      chainId: ChainId.Testnet,
      privateKey: wallet2,
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
      },
    }
  
    const msg = MsgExecuteContractCompat.fromJSON({
      sender: address2,
      contractAddress, // 👈 your atomic swap contract address
      msg: executeMsg,
      funds: [], // 👈 no funds sent when claiming
    })
  
    const tx = await broadcaster.broadcast({ msgs: msg })
  
    console.log('✅ CUSDC successfully claimed!')
    console.log('Tx Hash:', tx.txHash)
    console.log('Preimage:', preimage)
}


export async function fund_dst_escrow_with_params(
  preimage: string, 
  amount: string, 
  recipient: string, 
  expiresAtHeight: number,
  swapId: string
) {
  const hash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex')
  console.log(`💰 Funding dst escrow with ${amount} CUSDC from ${address}`)
  
  
  
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

  const escrowMsg = {
      create: {
          id: swapId,
          hash,
          recipient,
          expires: {
              at_height: expiresAtHeight,
          },
      },
  }

  const cw20Msg = {
      send: {
          contract: contractAddress,
          amount,
          msg: Buffer.from(JSON.stringify(escrowMsg)).toString('base64'),
      },
  }
  console.log("cw20Msg", cw20Msg)
  const msg = MsgExecuteContractCompat.fromJSON({
      sender: address,
      contractAddress: cusdcAddress,
      msg: cw20Msg,
      funds: [],
  })
  console.log("msggg", msg)
  const tx = await broadcaster.broadcast({ msgs: msg })

  await new Promise(resolve => setTimeout(resolve, 2000))

  
  console.log('✅ Destination escrow funded on Injective')
  console.log('Tx Hash:', tx.txHash)
  console.log('Swap ID:', swapId)
  
  return { swapId, txHash: tx.txHash }
}

export async function claim_funds_with_params(swapId: string, preimage: string) {
  console.log(`🔓 Claiming CUSDC from swap "${swapId}" from ${address2}`)
  
  const broadcaster = new MsgBroadcasterWithPk({
      network: Network.Testnet,
      chainId: ChainId.Testnet,
      privateKey: wallet2,
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
      },
  }

  const msg = MsgExecuteContractCompat.fromJSON({
      sender: address2,
      contractAddress,
      msg: executeMsg,
      funds: [],
  })

  const tx = await broadcaster.broadcast({ msgs: msg })
  
  console.log('✅ CUSDC successfully claimed!')
  console.log('Tx Hash:', tx.txHash)
  
  return tx.txHash
}

export async function claim_funds_with_params_resolver(swapId: string, preimage: string) {
  console.log(`🔓 Resolver claiming CUSDC from swap "${swapId}" from ${address}`) // Note: using wallet (resolver), not wallet2 (user)
  
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
      },
  }

  const msg = MsgExecuteContractCompat.fromJSON({
      sender: address, // Resolver address
      contractAddress,
      msg: executeMsg,
      funds: [],
  })

  const tx = await broadcaster.broadcast({ msgs: msg })
  
  console.log('✅ Resolver successfully claimed CUSDC!')
  console.log('Tx Hash:', tx.txHash)
  
  return tx.txHash
}