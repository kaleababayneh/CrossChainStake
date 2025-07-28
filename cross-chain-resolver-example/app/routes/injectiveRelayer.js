// routes/injectiveRelayer.js - LEAN ESCROW FACTORY MONITOR & MESSAGE SENDER
import express from 'express'
import { JsonRpcProvider, Contract, ethers } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config({ path: '../.env' })
const router = express.Router()

const ESCROW_FACTORY_ABI = [
  "event SrcEscrowCreated(tuple(bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) srcImmutables, tuple(uint256 maker, uint256 amount, uint256 token, uint256 safetyDeposit, uint256 chainId) dstImmutablesComplement)"
]

class EscrowRelayer {
  constructor() {
    // Validate required environment variables
    this.ethereumRpcUrl = 'http://localhost:8545'
    this.escrowFactoryAddress = process.env.ESCROW_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000'
    this.resolverWebhookUrl = process.env.RESOLVER_WEBHOOK_URL // Optional webhook instead of polling
    this.maxHistoryBlocks = parseInt(process.env.MAX_HISTORY_BLOCKS) || 100
    this.cleanupInterval = parseInt(process.env.CLEANUP_INTERVAL_MS) || 300000 // 5 min
    
    // Initialize provider with retry logic
    this.ethereumProvider = new JsonRpcProvider(this.ethereumRpcUrl)
    this.escrowContract = null
    this.isConnected = false
    
    // Memory management
    this.detectedEscrows = new Map()
    this.pendingQueue = new Map()
    this.lastProcessedBlock = 0
    this.maxDetectedHistory = 1000 // Prevent memory bloat
    
    // Start cleanup timer
    setInterval(() => this.cleanup(), this.cleanupInterval)
    
    console.log(`🔧 Relayer configured:`)
    console.log(`   RPC: ${this.ethereumRpcUrl}`)
    console.log(`   Factory: ${this.escrowFactoryAddress || 'Will be set dynamically'}`)
    console.log(`   Webhook: ${this.resolverWebhookUrl || 'Disabled (using polling)'}`)
  }

  // Initialize with deployed factory address
  async initialize(factoryAddress) {
    this.escrowFactoryAddress = factoryAddress
    await this.connectToContract()
    console.log(`🏭 Initialized with EscrowFactory: ${factoryAddress}`)
  }

  // Connect to contract with retry logic
  async connectToContract() {
    if (!this.escrowFactoryAddress) {
      throw new Error('Factory address not set')
    }

    try {
      this.escrowContract = new Contract(
        this.escrowFactoryAddress,
        ESCROW_FACTORY_ABI,
        this.ethereumProvider
      )
      
      // Test connection
      await this.ethereumProvider.getBlockNumber()
      this.isConnected = true
      console.log(`✅ Connected to Ethereum node`)
    } catch (error) {
      this.isConnected = false
      console.error(`❌ Failed to connect to Ethereum node:`, error.message)
      throw error
    }
  }

  // Main monitoring function
  async monitorEscrowCreation() {
    if (!this.escrowContract || !this.isConnected) {
      console.log('⏳ Contract not ready, skipping monitoring cycle')
      return
    }

    try {
      const latestBlock = await this.ethereumProvider.getBlockNumber()
      const fromBlock = Math.max(this.lastProcessedBlock + 1, latestBlock - this.maxHistoryBlocks)
      
      if (fromBlock > latestBlock) {
        return // No new blocks
      }

      // Query for new SrcEscrowCreated events
      const filter = this.escrowContract.filters.SrcEscrowCreated()
      const events = await this.escrowContract.queryFilter(filter, fromBlock, latestBlock)

      for (const event of events) {
        await this.processEscrowEvent(event)
      }

      this.lastProcessedBlock = latestBlock
      
      if (events.length > 0) {
        console.log(`📊 Processed ${events.length} escrow events (block ${latestBlock})`)
      }
    } catch (error) {
      console.error(`❌ Monitoring error:`, error.message)
      this.isConnected = false
      
      // Attempt reconnection on next cycle
      setTimeout(() => this.connectToContract().catch(() => {}), 5000)
    }
  }

  // Process individual escrow event
  async processEscrowEvent(event) {
    const [srcImmutables, dstImmutablesComplement] = event.args
    const orderHash = srcImmutables.orderHash

    if (this.detectedEscrows.has(orderHash)) {
      return // Already processed
    }

    const escrowInfo = {
      id: orderHash,
      hashlock: srcImmutables.hashlock,
      maker: srcImmutables.maker.toString(),
      taker: srcImmutables.taker.toString(),
      token: srcImmutables.token.toString(),
      amount: srcImmutables.amount.toString(),
      safetyDeposit: srcImmutables.safetyDeposit.toString(),
      timelocks: srcImmutables.timelocks.toString(),
      dstChainId: dstImmutablesComplement.chainId.toString(),
      dstToken: dstImmutablesComplement.token.toString(),
      dstAmount: dstImmutablesComplement.amount.toString(),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      detectedAt: Date.now()
    }

    // Store escrow
    this.detectedEscrows.set(orderHash, escrowInfo)
    this.pendingQueue.set(orderHash, escrowInfo)

    console.log(`🔍 New escrow detected: ${orderHash.slice(0, 10)}...`)
    console.log(`   Amount: ${ethers.formatUnits(srcImmutables.amount, 6)} tokens`)

    // Notify resolver (webhook or polling)
    if (this.resolverWebhookUrl) {
      await this.notifyResolver(escrowInfo)
    }
  }

  // Optional webhook notification to resolver
  async notifyResolver(escrowInfo) {
    try {
      const response = await fetch(this.resolverWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'new_escrow', data: escrowInfo })
      })
      
      if (response.ok) {
        console.log(`📤 Notified resolver via webhook`)
      } else {
        console.warn(`⚠️  Webhook notification failed: ${response.status}`)
      }
    } catch (error) {
      console.warn(`⚠️  Webhook error:`, error.message)
    }
  }

  // Cleanup old processed escrows to prevent memory bloat
  cleanup() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000) // 24 hours
    let cleaned = 0

    for (const [orderHash, escrow] of this.detectedEscrows.entries()) {
      if (escrow.status === 'processed_by_resolver' && escrow.detectedAt < cutoffTime) {
        this.detectedEscrows.delete(orderHash)
        cleaned++
      }
    }

    // Also limit total history size
    if (this.detectedEscrows.size > this.maxDetectedHistory) {
      const sorted = Array.from(this.detectedEscrows.entries())
        .sort(([,a], [,b]) => a.detectedAt - b.detectedAt)
      
      const toRemove = sorted.slice(0, sorted.length - this.maxDetectedHistory)
      toRemove.forEach(([orderHash]) => this.detectedEscrows.delete(orderHash))
      cleaned += toRemove.length
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old escrow records`)
    }
  }

  // API methods for resolver
  getPendingEscrows() {
    return Array.from(this.pendingQueue.values())
  }

  markEscrowProcessed(escrowId) {
    this.pendingQueue.delete(escrowId)
    if (this.detectedEscrows.has(escrowId)) {
      this.detectedEscrows.get(escrowId).status = 'processed_by_resolver'
      this.detectedEscrows.get(escrowId).processedAt = Date.now()
    }
    console.log(`✅ Marked escrow processed: ${escrowId.slice(0, 10)}...`)
  }

  getEscrowInfo(escrowId) {
    return this.detectedEscrows.get(escrowId)
  }

  getStats() {
    return {
      isConnected: this.isConnected,
      escrowFactoryAddress: this.escrowFactoryAddress,
      lastProcessedBlock: this.lastProcessedBlock,
      totalDetected: this.detectedEscrows.size,
      pendingQueue: this.pendingQueue.size,
      memoryUsage: process.memoryUsage()
    }
  }

  async start(intervalMs = 3000) {
    console.log(`🚀 Starting Escrow Relayer (${intervalMs}ms intervals)`)
    
    // Initial connection if factory address is set
    if (this.escrowFactoryAddress) {
      await this.connectToContract()
    }
    
    // Start monitoring loop
    setInterval(() => this.monitorEscrowCreation(), intervalMs)
  }
}

// Initialize singleton relayer
const relayer = new EscrowRelayer()
relayer.start()

// Lean REST API
router.get('/status', (req, res) => res.json(relayer.getStats()))
router.get('/pending', (req, res) => res.json(relayer.getPendingEscrows()))
router.get('/escrow/:escrowId', (req, res) => {
  const escrow = relayer.getEscrowInfo(req.params.escrowId)
  escrow ? res.json(escrow) : res.status(404).json({ error: 'Escrow not found' })
})

router.post('/mark-processed/:escrowId', (req, res) => {
  relayer.markEscrowProcessed(req.params.escrowId)
  res.json({ success: true })
})

router.post('/initialize', async (req, res) => {
  try {
    const { factoryAddress, srcChainUrl } = req.body
    if (!factoryAddress) {
      return res.status(400).json({ error: 'factoryAddress required' })
    }
    
    // Update RPC URL if provided (for anvil integration)
    if (srcChainUrl) {
      relayer.ethereumRpcUrl = srcChainUrl
      relayer.ethereumProvider = null // Reset provider to force reconnection
      console.log(`🔧 Updated RPC URL to: ${srcChainUrl}`)
    }
    
    await relayer.initialize(factoryAddress)
    res.json({ 
      success: true, 
      message: `Initialized with factory: ${factoryAddress}`,
      rpcUrl: relayer.ethereumRpcUrl
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
export { relayer }
