"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowDownUp, RefreshCw, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { fetchUSDCBalance, fetchINJBalance, getTokenBalance, formatBalance } from "@/lib/balance-utils"
import { detectNetwork, switchToBuildBearNetwork, CHAIN_CONFIGS } from "@/lib/chain-configs"
import { 
  executeCrossChainSwap,
  getSwapStatus, 
  SwapResponse, 
  SwapStatus 
} from "@/lib/swap-utils"
import { ethers } from "ethers"


interface WalletState {
  isConnected: boolean
  address: string
  fullAddress: string
  balance: string
  isLoadingBalance: boolean
}

const ethereumTokens = [{ symbol: "USDC", name: "USD Coin", logo: "/placeholder.svg?height=24&width=24" }]

const cosmosTokens = [
  { symbol: "INJ", name: "Injective", logo: "/placeholder.svg?height=24&width=24" }
]

export default function TokenSwap() {
  const [metamaskWallet, setMetamaskWallet] = useState<WalletState>({
    isConnected: false,
    address: "",
    fullAddress: "",
    balance: "0.000000",
    isLoadingBalance: false,
  })

  const [keplrWallet, setKeplrWallet] = useState<WalletState>({
    isConnected: false,
    address: "",
    fullAddress: "",
    balance: "0.000000",
    isLoadingBalance: false,
  })

  const [fromToken, setFromToken] = useState("USDC")
  const [toToken, setToToken] = useState("INJ")
  const [fromAmount, setFromAmount] = useState("")
  const [toAmount, setToAmount] = useState("")
  const [isSwapping, setIsSwapping] = useState(false)
  
  // Cross-chain swap state
  const [swapData, setSwapData] = useState<SwapResponse | null>(null)
  const [swapStatus, setSwapStatus] = useState<SwapStatus>({ step: 'failed', message: 'Swap not initiated', txHashes: {} })

  // Connect MetaMask
  const connectMetaMask = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        // First check if user is on the correct network
        const networkInfo = await detectNetwork()
        
        if (!networkInfo.isCorrectNetwork) {
          const switchNetwork = confirm(
            `You are not connected to the BuildBear testnet (Chain ID: ${CHAIN_CONFIGS.ethereum.chainId}). ` +
            "Would you like to switch networks?"
          )
          
          if (switchNetwork) {
            await switchToBuildBearNetwork()
          } else {
            alert("Please switch to BuildBear testnet to use this application.")
            return
          }
        }

        const accounts = await (window as any).ethereum.request({
          method: "eth_requestAccounts",
        })

        if (accounts.length > 0) {
          const fullAddress = accounts[0]
          const truncatedAddress = `${fullAddress.slice(0, 6)}...${fullAddress.slice(-4)}`
          
          // Set initial state with loading
          setMetamaskWallet({
            isConnected: true,
            address: truncatedAddress,
            fullAddress: fullAddress,
            balance: "0.000000",
            isLoadingBalance: true,
          })

          // Fetch real USDC balance
          try {
            const usdcBalance = await fetchUSDCBalance(fullAddress)
            setMetamaskWallet(prev => ({
              ...prev,
              balance: usdcBalance,
              isLoadingBalance: false,
            }))
          } catch (error) {
            console.error("Failed to fetch USDC balance:", error)
            setMetamaskWallet(prev => ({
              ...prev,
              balance: "0.000000",
              isLoadingBalance: false,
            }))
          }
        }
      } catch (error) {
        console.error("Failed to connect MetaMask:", error)
        alert("Failed to connect to MetaMask. Please make sure it's installed and try again.")
      }
    } else {
      alert("MetaMask is not installed!")
    }
  }

  // Connect Keplr
  const connectKeplr = async () => {
    if (typeof window !== "undefined" && (window as any).keplr) {
      try {
        await (window as any).keplr.enable("injective-888")
        const offlineSigner = (window as any).keplr.getOfflineSigner("injective-888")
        const accounts = await offlineSigner.getAccounts()

        if (accounts.length > 0) {
          const fullAddress = accounts[0].address
          const truncatedAddress = `${fullAddress.slice(0, 6)}...${fullAddress.slice(-4)}`
          
          // Set initial state with loading
          setKeplrWallet({
            isConnected: true,
            address: truncatedAddress,
            fullAddress: fullAddress,
            balance: "0.000000",
            isLoadingBalance: true,
          })

          // Fetch real INJ balance
          try {
            const injBalance = await fetchINJBalance(fullAddress)
            setKeplrWallet(prev => ({
              ...prev,
              balance: injBalance,
              isLoadingBalance: false,
            }))
          } catch (error) {
            console.error("Failed to fetch INJ balance:", error)
            setKeplrWallet(prev => ({
              ...prev,
              balance: "0.000000",
              isLoadingBalance: false,
            }))
          }
        }
      } catch (error) {
        console.error("Failed to connect Keplr:", error)
      }
    } else {
      alert("Keplr wallet is not installed!")
    }
  }

  // Refresh balances
  const refreshBalances = async () => {
    if (metamaskWallet.isConnected && metamaskWallet.fullAddress) {
      setMetamaskWallet(prev => ({ ...prev, isLoadingBalance: true }))
      try {
        const usdcBalance = await fetchUSDCBalance(metamaskWallet.fullAddress)
        setMetamaskWallet(prev => ({
          ...prev,
          balance: usdcBalance,
          isLoadingBalance: false,
        }))
      } catch (error) {
        console.error("Failed to refresh USDC balance:", error)
        setMetamaskWallet(prev => ({ ...prev, isLoadingBalance: false }))
      }
    }

    if (keplrWallet.isConnected && keplrWallet.fullAddress) {
      setKeplrWallet(prev => ({ ...prev, isLoadingBalance: true }))
      try {
        const injBalance = await fetchINJBalance(keplrWallet.fullAddress)
        setKeplrWallet(prev => ({
          ...prev,
          balance: injBalance,
          isLoadingBalance: false,
        }))
      } catch (error) {
        console.error("Failed to refresh INJ balance:", error)
        setKeplrWallet(prev => ({ ...prev, isLoadingBalance: false }))
      }
    }
  }

  // Get token details from either network
  const getTokenDetails = (symbol: string) => {
    const ethereumToken = ethereumTokens.find((token) => token.symbol === symbol)
    const cosmosToken = cosmosTokens.find((token) => token.symbol === symbol)
    return ethereumToken || cosmosToken
  }


  // FIX THIS

  // Handle amount changes
  const handleFromAmountChange = (value: string) => {
    setFromAmount(value)
    // Hardcoded exchange rate: 1000 USDC = 1 INJ
    const rate = 1 / 1000 // 0.001 INJ per USDC
    setToAmount(value ? (Number.parseFloat(value) * rate).toFixed(6) : "")
  }

  // Update swap status when dependencies change
  useEffect(() => {
    if (swapData) {
      const status = getSwapStatus(
        true,
        swapData.srcEscrowTx,
        swapData.dstFundingTx,
        swapData.claimTx,
        swapData.withdrawTx
      )
      setSwapStatus(status)
    }
  }, [swapData])

// Handle complete cross-chain swap (all steps in one function)
const handleSwap = async () => {
  if (!metamaskWallet.isConnected || !keplrWallet.isConnected) {
    alert("Please connect both wallets to proceed with the swap")
    return
  }

  if (!fromAmount || Number.parseFloat(fromAmount) <= 0) {
    alert("Please enter a valid amount to swap")
    return
  }

  setIsSwapping(true)

  try {
    console.log('🚀 STARTING COMPLETE CROSS-CHAIN SWAP')
    console.log('From amount:', fromAmount, fromToken)
    console.log('To amount:', toAmount, toToken)
    console.log('User address (Ethereum):', metamaskWallet.fullAddress)
    console.log('User address (Injective):', keplrWallet.fullAddress)
    
    // ✅ Determine swap direction dynamically
    const isEvmToInj = fromToken === "USDC" // true for USDC->INJ, false for INJ->USDC
    console.log('Swap direction (EVM to Injective):', isEvmToInj)
    const secretBytes =  Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
    

    let makerAmountReq: string
    let takerAmountReq: string
    
    if (isEvmToInj) {
      // EVM to Injective: User gives USDC (maker), expects INJ (taker)
      makerAmountReq = fromAmount // USDC amount user is giving
      takerAmountReq = toAmount   // INJ amount user expects to receive
    } else {
      // Injective to EVM: User gives INJ (maker), expects USDC (taker)  
      makerAmountReq = fromAmount // INJ amount user is giving
      takerAmountReq = toAmount   // USDC amount user expects to receive
    }

    const result = await executeCrossChainSwap(
      makerAmountReq,
      takerAmountReq,
      metamaskWallet.fullAddress,
      keplrWallet.fullAddress,
      isEvmToInj, // ✅ Pass boolean value,
      secretBytes

    )

    console.log('🎉 CROSS-CHAIN SWAP COMPLETED!')
    console.log('Result:', result)

    // Update UI state
    //setSwapData(result)
    //alert('Cross-chain swap completed successfully!')

  } catch (error) {
    console.error('Cross-chain swap failed:', error)
    alert(`Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    setIsSwapping(false)
  }
}
  // Reset swap state
  const resetSwap = () => {
    setSwapData(null)
    setFromAmount("")
    setToAmount("")
  }

  // Reverse swap direction
  const reverseSwap = () => {
    const tempToken = fromToken
    const tempAmount = fromAmount

    // Set new from token to first available cosmos token
    setFromToken(toToken)
    // Set new to token to first available ethereum token
    setToToken(tempToken)
    setFromAmount(toAmount)
    setToAmount(tempAmount)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-black relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent"></div>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg"></div>
          <h1 className="text-3xl font-bold text-white tracking-tight">CrossSwap</h1>
          <div className="text-xs text-gray-400 mt-1">BuildBear Testnet ↔ Injective</div>
        </div>

        {/* Wallet Connection Buttons */}
        <div className="flex space-x-3">
          <Button
            onClick={connectMetaMask}
            variant={metamaskWallet.isConnected ? "secondary" : "outline"}
            size="sm"
            className="flex items-center space-x-2 min-w-[140px] rounded-xl font-medium border-white/20 hover:border-white/40 transition-all duration-200"
          >
            <img src="/placeholder.svg?height=20&width=20" alt="MetaMask" className="w-5 h-5 rounded-md" />
            <span className="text-sm font-medium">
              {metamaskWallet.isConnected ? metamaskWallet.address : "MetaMask"}
            </span>
          </Button>

          <Button
            onClick={connectKeplr}
            variant={keplrWallet.isConnected ? "secondary" : "outline"}
            size="sm"
            className="flex items-center space-x-2 min-w-[130px] rounded-xl font-medium border-white/20 hover:border-white/40 transition-all duration-200"
          >
            <img src="/placeholder.svg?height=20&width=20" alt="Keplr" className="w-5 h-5 rounded-md" />
            <span className="text-sm font-medium">{keplrWallet.isConnected ? keplrWallet.address : "Keplr"}</span>
          </Button>
        </div>
      </header>

      {/* Main Swap Interface */}
      <div className="relative z-10 flex justify-center items-center min-h-[calc(100vh-140px)] px-4">
        <Card className="w-full max-w-lg p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Swap Tokens</h2>
              <p className="text-gray-400 text-sm font-medium">Cross-chain bridge between Ethereum and Cosmos</p>
            </div>

            {/* From Token - Ethereum Only */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-300">From (Ethereum)</label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={fromAmount}
                  onChange={(e) => handleFromAmountChange(e.target.value)}
                  className="pr-40 h-16 bg-white/5 border-white/20 text-white placeholder:text-gray-500 rounded-2xl text-lg font-medium focus:border-blue-500/50 transition-all duration-200"
                />
                <Select value={fromToken} onValueChange={setFromToken}>
                  <SelectTrigger className="absolute right-3 top-1/2 -translate-y-1/2 w-32 h-10 bg-white/10 border-white/20 text-white rounded-xl hover:bg-white/20 transition-all duration-200">
                    <SelectValue>
                      <div className="flex items-center space-x-2">
                        <img
                          src={getTokenDetails(fromToken)?.logo || "/placeholder.svg?query=usdc+coin+logo"}
                          alt={fromToken}
                          className="w-5 h-5 rounded-full"
                        />
                        <span className="font-semibold">{fromToken}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-gray-900/95 backdrop-blur-xl border-white/20">
                    {/* Ethereum Network Header */}
                    <div className="px-3 py-2 text-xs font-bold text-gray-400 flex items-center space-x-2">
                      <img src="/placeholder.svg?height=16&width=16" alt="Ethereum" className="w-4 h-4 rounded-full" />
                      <span>ETHEREUM NETWORK</span>
                    </div>
                    {ethereumTokens.map((token) => (
                      <SelectItem key={token.symbol} value={token.symbol} className="pl-8 rounded-xl hover:bg-white/10">
                        <div className="flex items-center space-x-3">
                          <img
                            src={token.logo || "/placeholder.svg?query=usdc+coin+logo"}
                            alt={token.name}
                            className="w-5 h-5 rounded-full"
                          />
                          <div>
                            <span className="font-semibold">{token.symbol}</span>
                            <span className="text-xs text-gray-400 ml-2">{token.name}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {metamaskWallet.isConnected && (
                <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
                  <span>
                    Balance:{" "}
                    <span className="text-white font-semibold">
                      {metamaskWallet.isLoadingBalance ? (
                        <span className="inline-flex items-center space-x-1">
                          <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Loading...</span>
                        </span>
                      ) : (
                        formatBalance(metamaskWallet.balance, fromToken)
                      )}
                    </span>
                  </span>
                  <Button
                    onClick={refreshBalances}
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-gray-400 hover:text-white"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Swap Direction Button */}
            <div className="flex justify-center">
              <Button
                onClick={reverseSwap}
                variant="ghost"
                size="sm"
                className="rounded-full p-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40 transition-all duration-200"
              >
                <ArrowDownUp className="w-5 h-5" />
              </Button>
            </div>

            {/* To Token - Cosmos Only */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-300">To (Cosmos)</label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={toAmount}
                  readOnly
                  className="pr-40 h-16 bg-white/5 border-white/20 text-white placeholder:text-gray-500 rounded-2xl text-lg font-medium"
                />
                <Select value={toToken} onValueChange={setToToken}>
                  <SelectTrigger className="absolute right-3 top-1/2 -translate-y-1/2 w-32 h-10 bg-white/10 border-white/20 text-white rounded-xl hover:bg-white/20 transition-all duration-200">
                    <SelectValue>
                      <div className="flex items-center space-x-2">
                        <img
                          src={getTokenDetails(toToken)?.logo || "/placeholder.svg?query=injective+logo"}
                          alt={toToken}
                          className="w-5 h-5 rounded-full"
                        />
                        <span className="font-semibold">{toToken}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-gray-900/95 backdrop-blur-xl border-white/20">
                    {/* Cosmos Network Header */}
                    <div className="px-3 py-2 text-xs font-bold text-gray-400 flex items-center space-x-2">
                      <img src="/placeholder.svg?height=16&width=16" alt="Cosmos" className="w-4 h-4 rounded-full" />
                      <span>COSMOS NETWORK</span>
                    </div>
                    {cosmosTokens.map((token) => (
                      <SelectItem key={token.symbol} value={token.symbol} className="pl-8 rounded-xl hover:bg-white/10">
                        <div className="flex items-center space-x-3">
                          <img
                            src={
                              token.logo ||
                              (token.symbol === "INJ"
                                ? "/placeholder.svg?query=injective+teal+logo"
                                : "/placeholder.svg?query=neutron+black+logo")
                            }
                            alt={token.name}
                            className="w-5 h-5 rounded-full"
                          />
                          <div>
                            <span className="font-semibold">{token.symbol}</span>
                            <span className="text-xs text-gray-400 ml-2">{token.name}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {keplrWallet.isConnected && (
                <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
                  <span>
                    Balance:{" "}
                    <span className="text-white font-semibold">
                      {keplrWallet.isLoadingBalance ? (
                        <span className="inline-flex items-center space-x-1">
                          <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Loading...</span>
                        </span>
                      ) : (
                        formatBalance(keplrWallet.balance, toToken)
                      )}
                    </span>
                  </span>
                  <Button
                    onClick={refreshBalances}
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-gray-400 hover:text-white"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Exchange Rate */}
            {fromAmount && toAmount && (
              <div className="text-center text-sm text-gray-300 bg-white/5 rounded-2xl p-4 border border-white/10">
                <span className="font-medium">Exchange Rate: </span>
                <span className="font-bold text-white">
                  1 {fromToken} = {(Number.parseFloat(toAmount) / Number.parseFloat(fromAmount)).toFixed(6)} {toToken}
                </span>
              </div>
            )}

            {/* Swap Status */}
            {swapData && (
              <div className="space-y-4">
                <Alert className="bg-green-500/10 border-green-500/20 text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{swapStatus.message}</AlertDescription>
                </Alert>

                {/* Transaction Details */}
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-gray-300">Transaction Details</div>
                  
                  {swapData.srcEscrowTx && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Source Escrow:</span>
                      <span className="text-blue-400 font-mono">{swapData.srcEscrowTx.slice(0, 10)}...</span>
                    </div>
                  )}

                  {swapData.dstFundingTx && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Destination Funding:</span>
                      <span className="text-purple-400 font-mono">{swapData.dstFundingTx.slice(0, 10)}...</span>
                    </div>
                  )}

                  {swapData.claimTx && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Claim Transaction:</span>
                      <span className="text-green-400 font-mono">{swapData.claimTx.slice(0, 10)}...</span>
                    </div>
                  )}

                  {swapData.withdrawTx && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Withdrawal Transaction:</span>
                      <span className="text-yellow-400 font-mono">{swapData.withdrawTx.slice(0, 10)}...</span>
                    </div>
                  )}
                </div>

                {/* Reset button */}
                <Button
                  onClick={resetSwap}
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10"
                >
                  Start New Swap
                </Button>
              </div>
            )}

            {/* Swap Button */}
            {!swapData && (
              <Button
                onClick={handleSwap}
                disabled={isSwapping || !fromAmount || !metamaskWallet.isConnected || !keplrWallet.isConnected}
                className="w-full h-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
              >
                {isSwapping ? (
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Executing Cross-Chain Swap...</span>
                  </div>
                ) : !metamaskWallet.isConnected || !keplrWallet.isConnected ? (
                  "Connect Wallets to Swap"
                ) : (
                  "Execute Cross-Chain Swap"
                )}
              </Button>
            )}

            {/* Connection Status */}
            <div className="flex justify-between text-xs text-gray-400 pt-2">
              <span
                className={`flex items-center space-x-2 font-medium ${metamaskWallet.isConnected ? "text-green-400" : "text-red-400"}`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${metamaskWallet.isConnected ? "bg-green-400" : "bg-red-400"}`}
                ></div>
                <span>Ethereum Network</span>
              </span>
              <span
                className={`flex items-center space-x-2 font-medium ${keplrWallet.isConnected ? "text-green-400" : "text-red-400"}`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${keplrWallet.isConnected ? "bg-green-400" : "bg-red-400"}`}
                ></div>
                <span>Cosmos Network</span>
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center text-gray-500 text-sm pb-8">
        <p className="font-medium">
          Powered by <span className="text-white font-semibold">CrossSwap</span> • Ethereum ↔ Cosmos Bridge
        </p>
      </footer>
    </div>
  )
}