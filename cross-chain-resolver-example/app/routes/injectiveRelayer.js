// routes/injectiveRelayer.js - CORRECTED TO MONITOR ESCROW FACTORY
import express from 'express'
import { JsonRpcProvider, Contract, ethers } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

// Correct ABI for EscrowFactory contract - only the events we need
const ESCROW_FACTORY_ABI = [
  "event SrcEscrowCreated(tuple(bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) srcImmutables, tuple(uint256 maker, uint256 amount, uint256 token, uint256 safetyDeposit, uint256 chainId) dstImmutablesComplement)",
  "event DstEscrowCreated(address escrow, bytes32 hashlock, uint256 taker)"
]

class EscrowRelayer {
  constructor() {
    // Monitor the EscrowFactory contract, not a generic swap contract
    this.escrowFactoryAddress = process.env.ESCROW_FACTORY_ADDRESS
    this.ethereumProvider = new JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'http://localhost:8545')
    
    if (!this.escrowFactoryAddress) {
      console.warn('⚠️  ESCROW_FACTORY_ADDRESS not set, will use test-deployed address')
    }

    this.escrowContract = null // Will be set when factory address is known
    
    // Track detected escrows (queue for resolver)
    this.detectedEscrows = new Map()
    this.pendingQueue = new Map()
    this.lastProcessedBlock = 0
  }

  // Initialize with the deployed escrow factory address (called from test)
  initialize(factoryAddress) {
    this.escrowFactoryAddress = factoryAddress
    this.escrowContract = new Contract(
      this.escrowFactoryAddress,
      ESCROW_FACTORY_ABI,
      this.ethereumProvider
    )
    console.log(`🏭 Initialized with EscrowFactory at: ${factoryAddress}`)
  }

  async monitorEscrowCreation() {
    if (!this.escrowContract) {
      console.log('⏳ EscrowFactory not initialized yet, skipping monitoring')
      return
    }

    try {
      const latestBlock = await this.ethereumProvider.getBlockNumber()
      
      // Don't re-process blocks we've already seen
      const fromBlock = Math.max(this.lastProcessedBlock + 1, latestBlock - 100)
      
      if (fromBlock > latestBlock) {
        return // No new blocks to process
      }

      // Monitor SrcEscrowCreated events (when source escrow is deployed)
      const filter = this.escrowContract.filters.SrcEscrowCreated()
      const events = await this.escrowContract.queryFilter(filter, fromBlock, latestBlock)

      for (const event of events) {
        const [srcImmutables, dstImmutablesComplement] = event.args
        
        const escrowInfo = {
          id: srcImmutables.orderHash, // Use orderHash as unique ID
          hashlock: srcImmutables.hashlock,
          maker: srcImmutables.maker,
          taker: srcImmutables.taker,
          token: srcImmutables.token,
          amount: srcImmutables.amount.toString(),
          safetyDeposit: srcImmutables.safetyDeposit.toString(),
          timelocks: srcImmutables.timelocks.toString(),
          dstChainId: dstImmutablesComplement.chainId.toString(),
          dstToken: dstImmutablesComplement.token,
          dstAmount: dstImmutablesComplement.amount.toString(),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          detectedAt: Date.now(),
          type: 'src_escrow_created'
        }

        if (!this.detectedEscrows.has(srcImmutables.orderHash)) {
          this.detectedEscrows.set(srcImmutables.orderHash, escrowInfo)
          this.pendingQueue.set(srcImmutables.orderHash, escrowInfo)
          console.log(`🔍 New source escrow detected: ${srcImmutables.orderHash}`)
          console.log(`   Amount: ${ethers.formatUnits(srcImmutables.amount, 6)} USDC`)
          console.log(`   Block: ${event.blockNumber}`)
        }
      }

      this.lastProcessedBlock = latestBlock
      if (events.length > 0) {
        console.log(`📊 Processed ${events.length} new escrow events up to block ${latestBlock}`)
      }
    } catch (error) {
      console.error('❌ Error monitoring escrow creation:', error.message)
    }
  }

  // API for resolver to get pending escrows
  getPendingEscrows() {
    return Array.from(this.pendingQueue.values())
  }

  // API for resolver to mark escrow as processed
  markEscrowProcessed(escrowId) {
    this.pendingQueue.delete(escrowId)
    if (this.detectedEscrows.has(escrowId)) {
      this.detectedEscrows.get(escrowId).status = 'processed_by_resolver'
    }
    console.log(`✅ Marked escrow ${escrowId} as processed`)
  }

  // Get specific escrow info
  getEscrowInfo(escrowId) {
    return this.detectedEscrows.get(escrowId)
  }

  async start(intervalMs = 5000) {
    console.log(`🚀 Starting Escrow Monitor (interval: ${intervalMs}ms)`)
    
    // Initial setup
    if (this.escrowFactoryAddress) {
      this.initialize(this.escrowFactoryAddress)
    }
    
    // Start monitoring
    setInterval(() => this.monitorEscrowCreation(), intervalMs)
  }
}

const relayer = new EscrowRelayer()
relayer.start()

// Routes
router.get('/status', (req, res) => {
  res.json({
    status: 'monitoring',
    escrowFactoryAddress: relayer.escrowFactoryAddress,
    detectedEscrows: relayer.detectedEscrows.size,
    pendingQueue: relayer.pendingQueue.size,
    lastProcessedBlock: relayer.lastProcessedBlock
  })
})

router.get('/pending', (req, res) => {
  res.json(relayer.getPendingEscrows())
})

router.get('/escrow/:escrowId', (req, res) => {
  const escrowInfo = relayer.getEscrowInfo(req.params.escrowId)
  if (escrowInfo) {
    res.json(escrowInfo)
  } else {
    res.status(404).json({ error: 'Escrow not found' })
  }
})

router.post('/mark-processed/:escrowId', (req, res) => {
  relayer.markEscrowProcessed(req.params.escrowId)
  res.json({ success: true })
})

router.post('/initialize', (req, res) => {
  const { factoryAddress } = req.body
  if (factoryAddress) {
    relayer.initialize(factoryAddress)
    res.json({ success: true, message: `Initialized with factory: ${factoryAddress}` })
  } else {
    res.status(400).json({ error: 'factoryAddress required' })
  }
})

export default router
export { relayer }