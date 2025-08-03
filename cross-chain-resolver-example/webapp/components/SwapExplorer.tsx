"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Clock, AlertCircle, ExternalLink, ArrowRight, X } from "lucide-react"
import { SwapResponse, SwapStatus } from "@/lib/swap-utils"

interface SwapStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  txHash?: string
  explorerUrl?: string
  network: 'evm' | 'injective'
}

interface SwapExplorerProps {
  isVisible: boolean
  onClose: () => void
  swapData: SwapResponse | null
  swapStatus: SwapStatus
  isSwapping: boolean
  fromToken: string
  toToken: string
}

const EXPLORER_URLS = {
  evm: "https://explorer.buildbear.io/appalling-thepunisher-3e7a9d1c",
  injective: "https://testnet.explorer.injective.network"
}

export function SwapExplorer({ 
  isVisible, 
  onClose, 
  swapData, 
  swapStatus, 
  isSwapping,
  fromToken,
  toToken 
}: SwapExplorerProps) {
  const [steps, setSteps] = useState<SwapStep[]>([])

  // Initialize steps based on swap direction
  useEffect(() => {
    const isEvmToInj = fromToken === "USDC"
    
    if (isEvmToInj) {
      // EVM → Injective flow
      setSteps([
        {
          id: 'approve',
          title: 'Token Approval',
          description: `Approve ${fromToken} for cross-chain transfer`,
          status: 'pending',
          network: 'evm'
        },
        {
          id: 'src_escrow',
          title: 'Source Escrow Deployment',
          description: 'Deploy escrow contract on Ethereum',
          status: 'pending',
          network: 'evm'
        },
        {
          id: 'dst_funding',
          title: 'Destination Funding',
          description: 'Fund escrow on Injective network',
          status: 'pending',
          network: 'injective'
        },
        {
          id: 'claim',
          title: 'Claim Funds',
          description: `Claim ${toToken} on Injective`,
          status: 'pending',
          network: 'injective'
        },
        {
          id: 'withdraw',
          title: 'Resolver Withdrawal',
          description: 'Resolver withdraws from source escrow',
          status: 'pending',
          network: 'evm'
        }
      ])
    } else {
      // Injective → EVM flow (gasless)
      setSteps([
        {
          id: 'fee_grant',
          title: 'Fee Grant',
          description: 'Resolver grants fee allowance for gasless transaction',
          status: 'pending',
          network: 'injective'
        },
        {
          id: 'gasless_swap',
          title: 'Gasless Swap Creation',
          description: `Lock ${fromToken} on Injective (gasless)`,
          status: 'pending',
          network: 'injective'
        },
        {
          id: 'reverse_order',
          title: 'Reverse Order Fill',
          description: 'Resolver fills reverse order on Ethereum',
          status: 'pending',
          network: 'evm'
        },
        {
          id: 'evm_withdraw',
          title: 'EVM Withdrawal',
          description: 'Resolver withdraws from EVM escrow',
          status: 'pending',
          network: 'evm'
        },
        {
          id: 'transfer',
          title: 'Final Transfer',
          description: `Transfer ${toToken} to your wallet`,
          status: 'pending',
          network: 'evm'
        },
        {
          id: 'inj_claim',
          title: 'Injective Claim',
          description: 'Resolver claims on Injective',
          status: 'pending',
          network: 'injective'
        }
      ])
    }
  }, [fromToken, toToken])

  // Track step updates from callbacks
  const [stepUpdates, setStepUpdates] = useState<Record<string, { status: 'in_progress' | 'completed' | 'failed', txHash?: string, message?: string }>>({})

  // Update step statuses based on swap progress and real-time updates
  useEffect(() => {
    setSteps(prevSteps => prevSteps.map(step => {
      // Check for real-time updates first (these come from callbacks)
      const update = stepUpdates[step.id]
      if (update) {
        return {
          ...step,
          status: update.status,
          txHash: update.txHash,
          explorerUrl: update.txHash ? 
            (step.network === 'evm' ? `${EXPLORER_URLS.evm}/tx/${update.txHash}` : `${EXPLORER_URLS.injective}/transaction/${update.txHash}`) 
            : undefined
        }
      }

      // Fallback to swapData for backwards compatibility
      if (swapData?.srcEscrowTx && (step.id === 'src_escrow' || step.id === 'approve')) {
        return {
          ...step,
          status: 'completed',
          txHash: step.id === 'src_escrow' ? swapData.srcEscrowTx : undefined,
          explorerUrl: step.id === 'src_escrow' ? `${EXPLORER_URLS.evm}/tx/${swapData.srcEscrowTx}` : undefined
        }
      }

      if (swapData?.dstFundingTx && (step.id === 'dst_funding' || step.id === 'fee_grant' || step.id === 'gasless_swap')) {
        return {
          ...step,
          status: 'completed',
          txHash: step.id === 'dst_funding' || step.id === 'gasless_swap' ? swapData.dstFundingTx : undefined,
          explorerUrl: (step.id === 'dst_funding' || step.id === 'gasless_swap') ? `${EXPLORER_URLS.injective}/transaction/${swapData.dstFundingTx}` : undefined
        }
      }

      if (swapData?.claimTx && (step.id === 'claim' || step.id === 'inj_claim')) {
        return {
          ...step,
          status: 'completed',
          txHash: swapData.claimTx,
          explorerUrl: `${EXPLORER_URLS.injective}/transaction/${swapData.claimTx}`
        }
      }

      if (swapData?.withdrawTx && (step.id === 'withdraw' || step.id === 'transfer')) {
        return {
          ...step,
          status: 'completed',
          txHash: step.id === 'withdraw' || step.id === 'transfer' ? swapData.withdrawTx : undefined,
          explorerUrl: (step.id === 'withdraw' || step.id === 'transfer') ? `${EXPLORER_URLS.evm}/tx/${swapData.withdrawTx}` : undefined
        }
      }

      return step
    }))
  }, [swapData, stepUpdates])

  // Expose a method to update steps from parent component
  useEffect(() => {
    // Add a global method that the parent can call
    const handleStepUpdate = (stepId: string, status: 'in_progress' | 'completed' | 'failed', txHash?: string, message?: string) => {
      console.log(`📱 Sidebar Update: ${stepId} - ${status}`, { txHash, message })
      setStepUpdates(prev => ({
        ...prev,
        [stepId]: { status, txHash, message }
      }))
    }

    // Store in window for parent access
    if (typeof window !== 'undefined') {
      (window as any).updateSwapStep = handleStepUpdate
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).updateSwapStep
      }
    }
  }, [])

  // Reset step updates when sidebar closes or swap resets
  useEffect(() => {
    if (!isVisible && !isSwapping) {
      setStepUpdates({})
    }
  }, [isVisible, isSwapping])

  const getStepIcon = (status: SwapStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-400 animate-pulse" />
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-400" />
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
    }
  }

  const getNetworkIcon = (network: 'evm' | 'injective') => {
    return network === 'evm' ? '/ethereum.svg' : '/inj.svg'
  }

  const getNetworkName = (network: 'evm' | 'injective') => {
    return network === 'evm' ? 'Ethereum' : 'Injective'
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end">
      <Card className="w-96 h-full bg-gray-900/95 backdrop-blur-xl border-l border-white/20 rounded-none overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Swap Explorer</h3>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-3 text-sm">
            <div className="flex items-center space-x-2">
              <img src={getNetworkIcon('evm')} alt="From" className="w-4 h-4" />
              <span className="text-gray-300">{fromToken}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-500" />
            <div className="flex items-center space-x-2">
              <img src={getNetworkIcon('injective')} alt="To" className="w-4 h-4" />
              <span className="text-gray-300">{toToken}</span>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={step.id} className="relative">
                {/* Connection line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-6 top-10 w-0.5 h-6 bg-gray-700" />
                )}
                
                <div className="flex items-start space-x-4">
                  {/* Step icon */}
                  <div className="relative z-10 bg-gray-900 p-1">
                    {getStepIcon(step.status)}
                  </div>
                  
                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-semibold text-white text-sm">{step.title}</h4>
                      <img 
                        src={getNetworkIcon(step.network)} 
                        alt={getNetworkName(step.network)}
                        className="w-3 h-3"
                      />
                    </div>
                    
                    <p className="text-xs text-gray-400 mb-2">
                      {stepUpdates[step.id]?.message || step.description}
                    </p>
                    
                    {/* Transaction link */}
                    {step.txHash && step.explorerUrl && (
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={() => window.open(step.explorerUrl, '_blank')}
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs border-white/20 text-gray-300 hover:text-white hover:border-white/40 transition-all duration-200"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          <span className="font-mono text-xs">
                            {step.txHash.slice(0, 8)}...{step.txHash.slice(-6)}
                          </span>
                        </Button>
                      </div>
                    )}
                    
                    {/* Progress bar for in-progress steps */}
                    {step.status === 'in_progress' && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-700 rounded-full h-1.5">
                          <div className="bg-blue-400 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                        </div>
                      </div>
                    )}
                    
                    {/* Status indicator with dynamic message */}
                    {step.status === 'in_progress' && (
                      <div className="mt-2">
                        <div className="flex items-center space-x-2 text-xs text-blue-400">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                          <span>{stepUpdates[step.id]?.message || 'Processing...'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10">
          <div className="text-xs text-gray-500 space-y-2">
            <div className="flex items-center justify-between">
              <span>Status:</span>
              <span className="text-white font-medium">{swapStatus.message}</span>
            </div>
            <div className="flex space-x-4">
              <a 
                href={EXPLORER_URLS.evm}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
              >
                <ExternalLink className="w-3 h-3" />
                <span>EVM Explorer</span>
              </a>
              <a 
                href={EXPLORER_URLS.injective}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 flex items-center space-x-1"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Injective Explorer</span>
              </a>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}