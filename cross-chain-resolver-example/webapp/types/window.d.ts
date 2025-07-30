interface Window {
  ethereum?: {
    request: (args: { method: string; params?: any[] }) => Promise<any>
    on: (event: string, callback: (accounts: string[]) => void) => void
    removeListener: (event: string, callback: (accounts: string[]) => void) => void
    isMetaMask?: boolean
  }
  keplr?: {
    enable: (chainId: string) => Promise<void>
    getOfflineSigner: (chainId: string) => any
    getKey: (chainId: string) => Promise<any>
  }
} 