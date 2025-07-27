// routes/injectiveResolver.js - CORRECTED TO PROCESS ESCROW FACTORY EVENTS
import express from 'express'
import { Network } from '@injectivelabs/networks'
import { ChainGrpcWasmApi } from '@injectivelabs/sdk-ts'
import { 
  MsgExecuteContractCompat, 
  PrivateKey, 
  MsgBroadcasterWithPk 
} from '@injectivelabs/sdk-ts'
import { ChainId } from '@injectivelabs/ts-types'
import { createHash } from 'crypto'
import { ethers } from 'ethers'
import * as dotenv from 'dotenv'
import { relayer } from './injectiveRelayer.js'

dotenv.config({ path: '../.env' })
const router = express.Router()

class EscrowResolver {
  constructor() {
    this.mnemonic = process.env.RESOLVER_MNEMONIC 
    this.wallet = PrivateKey.fromMnemonic(this.mnemonic)
    this.address = this.wallet.toAddress().toBech32()
    
    // Injective configuration for escrow creation
    this.injectiveCw20Address = process.env.CUSDC_CONTRACT_ADDRESS
    this.injectiveEscrowAddress = process.env.CW_20_ATOMIC_SWAP_CONTRACT_ADDRESS
    
    this.injectiveProvider = new ChainGrpcWasmApi(Network.Testnet)
    this.broadcaster = new MsgBroadcasterWithPk({
      network: Network.Testnet,
      chainId: ChainId.Testnet,
      privateKey: this.wallet,
      endpoints: {
        indexer: 'https://testnet.sentry.exchange.grpc-web.injective.network',
        grpc: 'https://testnet.sentry.chain.grpc-web.injective.network',
        rest: 'https://testnet.sentry.lcd.injective.network',
      },
    })

    this.processedEscrows = new Map() // Track escrows we've already processed
    this.createdEscrows = new Map()  // Track Injective escrows we've created
  }

  async processPendingEscrows() {
    try {
      const pendingEscrows = relayer.getPendingEscrows()
      
      for (const escrowInfo of pendingEscrows) {
        if (!this.processedEscrows.has(escrowInfo.id)) {
          await this.createInjectiveEscrow(escrowInfo)
          relayer.markEscrowProcessed(escrowInfo.id)
          this.processedEscrows.set(escrowInfo.id, escrowInfo)
        }
      }
    } catch (error) {
      console.error('❌ Error processing pending escrows:', error.message)
    }
  }

  async createInjectiveEscrow(escrowInfo) {
    try {
      console.log(`💫 Creating Injective escrow for order ${escrowInfo.id}`)
      console.log(`   Source amount: ${ethers.formatUnits(escrowInfo.amount, 6)} USDC`)
      console.log(`   Destination amount: ${ethers.formatUnits(escrowInfo.dstAmount, 6)} CUSDC`)
      
      // Use a deterministic secret for testing (in production, this would be securely generated)
      const preimage = escrowInfo.hashlock.slice(2) // Remove 0x prefix
      const hash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex')
      
      // Create the escrow on Injective side
      const executeMsg = {
        create: {
          id: escrowInfo.id,
          hash: '0x' + hash,
          recipient: this.convertAddressToInjective(escrowInfo.maker), // Convert maker address
          expires: { at_height: 90_000_000 } // High block number for testing
        }
      }

      const cw20Msg = {
        send: {
          contract: this.injectiveEscrowAddress,
          amount: escrowInfo.dstAmount, // Use destination amount
          msg: Buffer.from(JSON.stringify(executeMsg)).toString('base64')
        }
      }

      const msg = MsgExecuteContractCompat.fromJSON({
        sender: this.address,
        contractAddress: this.injectiveCw20Address,
        msg: cw20Msg,
        funds: [] // No native INJ sent
      })

      console.log(`📤 Broadcasting Injective escrow creation...`)
      const tx = await this.broadcaster.broadcast({ msgs: [msg] })
      
      const createdEscrow = {
        ...escrowInfo,
        injectiveEscrowTx: tx.txHash,
        preimage,
        hash: '0x' + hash,
        injectiveRecipient: this.convertAddressToInjective(escrowInfo.maker),
        createdAt: Date.now(),
        status: 'created'
      }
      
      this.createdEscrows.set(escrowInfo.id, createdEscrow)

      console.log(`✅ Injective escrow created!`)
      console.log(`   Tx Hash: ${tx.txHash}`)
      console.log(`   Hash: 0x${hash}`)
      console.log(`   Recipient: ${this.convertAddressToInjective(escrowInfo.maker)}`)
      
    } catch (error) {
      console.error(`❌ Error creating Injective escrow for ${escrowInfo.id}:`, error.message)
      console.error(error)
    }
  }

  // Convert Ethereum address to Injective format (simplified)
  convertAddressToInjective(ethereumAddress) {
    // For testing purposes, return a placeholder Injective address
    // In production, you'd need proper address conversion
    return 'inj1...' + ethereumAddress.slice(-10)
  }

  // API method to manually trigger secret reveal (for testing)
  async revealSecret(escrowId) {
    const escrow = this.createdEscrows.get(escrowId)
    if (!escrow) {
      throw new Error('Escrow not found')
    }

    try {
      const executeMsg = {
        claim: {
          id: escrowId,
          preimage: escrow.preimage
        }
      }

      const msg = MsgExecuteContractCompat.fromJSON({
        sender: this.address,
        contractAddress: this.injectiveEscrowAddress,
        msg: executeMsg,
        funds: []
      })

      const tx = await this.broadcaster.broadcast({ msgs: [msg] })
      
      escrow.claimTx = tx.txHash
      escrow.status = 'claimed'
      escrow.claimedAt = Date.now()

      console.log(`🎯 Secret revealed for escrow ${escrowId}, tx: ${tx.txHash}`)
      return tx.txHash
    } catch (error) {
      console.error(`❌ Error revealing secret for ${escrowId}:`, error.message)
      throw error
    }
  }

  async start(intervalMs = 3000) {
    console.log(`🚀 Starting Escrow Resolver (interval: ${intervalMs}ms)`)
    console.log(`   Injective Address: ${this.address}`)
    console.log(`   CW20 Contract: ${this.injectiveCw20Address}`)
    console.log(`   Escrow Contract: ${this.injectiveEscrowAddress}`)
    
    setInterval(() => this.processPendingEscrows(), intervalMs)
  }
}

const resolver = new EscrowResolver()
resolver.start()

// Routes
router.get('/status', (req, res) => {
  res.json({
    status: 'active',
    injectiveAddress: resolver.address,
    processedEscrows: resolver.processedEscrows.size,
    createdEscrows: resolver.createdEscrows.size,
    pendingFromRelayer: relayer.getPendingEscrows().length
  })
})

router.get('/escrows', (req, res) => {
  const escrows = Array.from(resolver.createdEscrows.values())
  res.json(escrows)
})

router.get('/processed', (req, res) => {
  const processed = Array.from(resolver.processedEscrows.values())
  res.json(processed)
})

router.post('/reveal/:escrowId', async (req, res) => {
  try {
    const txHash = await resolver.revealSecret(req.params.escrowId)
    res.json({ success: true, txHash })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router