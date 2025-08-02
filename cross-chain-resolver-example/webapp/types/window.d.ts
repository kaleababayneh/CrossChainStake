interface Window {
  ethereum?: {
    request: (args: { method: string; params?: any[] }) => Promise<any>
    on: (event: string, callback: (accounts: string[]) => void) => void
    removeListener: (event: string, callback: (accounts: string[]) => void) => void
    isMetaMask?: boolean
  }
   keplr: {
      enable: (chainId: string) => Promise<void>;
      getOfflineSigner: (chainId: string) => any;
      getKey: (chainId: string) => Promise<any>;
      sendTx: (chainId: string, tx: Uint8Array, mode: string) => Promise<Uint8Array>; // Add this
      signDirect: (chainId: string, signer: string, signDoc: any) => Promise<any>; // Add this too
    };
  }

