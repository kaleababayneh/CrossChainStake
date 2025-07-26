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



const preimage = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
const hash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex')

async function initializeSwapLedger() {
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

export async function anounce_order(hash: string) {
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

  // Fixed preimage value (32 bytes in hex format)
  

  const expiresAtHeight = 90_000_000 // or use block height + N buffer

  // Compose the message according to your Rust contract
  const executeMsg = {
    create: {
      id: 'swap00312',
      hash,
      recipient: recipientAddress,
      expires: {
        at_height: expiresAtHeight
      }
    }
  }

  const funds = [{
    amount: '1000000000000', // 1 INJ (18 decimals)
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

  console.log('✅ Swap announced!')
  console.log('Tx Hash:', tx.txHash)
  console.log('Preimage (hex):', preimage)
  console.log('Hash (SHA256):', hash)
}

export async function fund_dst_escrow(hash: string) {
  console.log(`💰 Funding dst escrow with INJ from ${address}`)

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

  const executeMsg = {
    create: {
      id: 'swap125',
      hash,
      recipient: recipientAddress,
      expires: {
        at_height: expiresAtHeight,
      },
    },
  }

  const funds = [{
    amount: '50000000000000', // 0.5 INJ
    denom: 'inj',
  }]

  const msg = MsgExecuteContractCompat.fromJSON({
    sender: address,
    contractAddress,
    msg: executeMsg,
    funds,
  })

  const tx = await broadcaster.broadcast({ msgs: msg })

  console.log('✅ Counterparty funded dst escrow with INJ')
  console.log('Tx Hash:', tx.txHash)
  console.log('Preimage:', preimage)
  console.log('Hash (SHA256):', hash)
}

export async function claim_funds(swapId: string, preimage: string) {

    console.log(`🔓 Claiming funds from swap ${swapId} by revealing preimage from ${address2}`)
  
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
      funds: [], // no funds needed
    })
  
    const tx = await broadcaster.broadcast({ msgs: msg })
  
    console.log('✅ Funds claimed successfully!')
    console.log('Tx Hash:', tx.txHash)
    console.log('Preimage:', preimage)
}