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