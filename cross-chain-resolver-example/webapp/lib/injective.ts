//import { AptosAccount, AptosClient, TxnBuilderTypes, BCS } from "aptos";
import { ethers} from "ethers";
import { createHash } from 'crypto';
import {
  MsgExecuteContractCompat,
  MsgInstantiateContract,
  PrivateKey,
  MsgBroadcasterWithPk,
} from '@injectivelabs/sdk-ts'
import { keccak256 } from 'ethers'
import * as dotenv from 'dotenv'
import {  Network } from '@injectivelabs/networks'
import { ChainId} from '@injectivelabs/ts-types';

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