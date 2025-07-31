import {
  DirectSecp256k1HdWallet,
  OfflineDirectSigner,
} from '@cosmjs/proto-signing'
import {
  SigningStargateClient,
  StargateClient,
  DeliverTxResponse,
} from '@cosmjs/stargate'
import {
  SigningCosmWasmClient,
  CosmWasmClient,
} from '@cosmjs/cosmwasm-stargate'
import { Coin } from '@cosmjs/amino'

export class InjectiveWallet {
  public wallet: DirectSecp256k1HdWallet | null = null
  public address: string = ''
  private stargateClient?: SigningStargateClient
  private cosmwasmClient?: SigningCosmWasmClient
  private queryClient?: CosmWasmClient
  private mnemonic: string
  private isInitialized = false
  
  // Injective testnet endpoints
  private readonly rpcEndpoint = 'https://testnet.sentry.tm.injective.network:443'
  private readonly prefix = 'inj'

  constructor(mnemonic: string) {
    this.mnemonic = mnemonic
  }

  // Initialize the wallet (must be called after construction)
  public async init(): Promise<void> {
    if (this.isInitialized) return
    
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
      this.mnemonic,
      { prefix: this.prefix }
    )
    
    const accounts = await wallet.getAccounts()
    this.wallet = wallet
    this.address = accounts[0].address

    // Initialize clients
    this.stargateClient = await SigningStargateClient.connectWithSigner(
      this.rpcEndpoint,
      wallet
    )
    
    this.cosmwasmClient = await SigningCosmWasmClient.connectWithSigner(
      this.rpcEndpoint,
      wallet
    )

    this.queryClient = await CosmWasmClient.connect(this.rpcEndpoint)
    this.isInitialized = true
  }

  // Static factory method for easier initialization
  public static async create(mnemonic: string): Promise<InjectiveWallet> {
    const wallet = new InjectiveWallet(mnemonic)
    await wallet.init()
    return wallet
  }

  public getAddress(): string {
    return this.address
  }

  public async getNativeBalance(denom: string): Promise<string> {
    if (!this.stargateClient) {
      throw new Error('Wallet not initialized. Call init() first.')
    }

    const balance = await this.stargateClient.getBalance(this.address, denom)
    return balance.amount
  }

  public async getTokenBalance(cw20Address: string): Promise<string> {
    if (!this.queryClient) {
      throw new Error('Wallet not initialized. Call init() first.')
    }

    const query = {
      balance: {
        address: this.address
      }
    }

    const result = await this.queryClient.queryContractSmart(cw20Address, query)
    return result.balance
  }

  public async getAllowance(cw20Address: string, spender: string): Promise<string> {
    if (!this.queryClient) {
      throw new Error('Wallet not initialized. Call init() first.')
    }

    const query = {
      allowance: {
        owner: this.address,
        spender
      }
    }

    const result = await this.queryClient.queryContractSmart(cw20Address, query)
    return result.allowance
  }

  public async approveToken(cw20Address: string, spender: string, amount: string): Promise<string> {
    if (!this.cosmwasmClient) {
      throw new Error('Wallet not initialized. Call init() first.')
    }

    const msg = {
      increase_allowance: {
        spender,
        amount
      }
    }

    const fee = {
      amount: [{ denom: 'inj', amount: '500000000000000' }],
      gas: '2000000',
    }

    const result = await this.cosmwasmClient.execute(
      this.address,
      cw20Address,
      msg,
      fee,
      undefined,
      []
    )

    return result.transactionHash
  }

  public async transferToken(cw20Address: string, to: string, amount: string): Promise<string> {
    if (!this.cosmwasmClient) {
      throw new Error('Wallet not initialized. Call init() first.')
    }

    const msg = {
      transfer: {
        recipient: to,
        amount
      }
    }

    const fee = {
      amount: [{ denom: 'inj', amount: '500000000000000' }],
      gas: '2000000',
    }

    const result = await this.cosmwasmClient.execute(
      this.address,
      cw20Address,
      msg,
      fee,
      undefined,
      []
    )

    return result.transactionHash
  }

  public async sendNative(to: string, amount: string, denom = 'inj'): Promise<string> {
    if (!this.stargateClient) {
      throw new Error('Wallet not initialized. Call init() first.')
    }

    const sendAmount: Coin = {
      denom,
      amount
    }

    const fee = {
      amount: [{ denom: 'inj', amount: '500000000000000' }],
      gas: '2000000',
    }

    const result = await this.stargateClient.sendTokens(
      this.address,
      to,
      [sendAmount],
      fee
    )

    return result.transactionHash
  }

  public async sendExecuteMsg(
    contractAddress: string,
    msg: object,
    funds: { denom: string; amount: string }[] = []
  ): Promise<string> {
    if (!this.cosmwasmClient) {
      throw new Error('Wallet not initialized. Call init() first.')
    }

    const fee = {
      amount: [{ denom: 'inj', amount: '500000000000000' }],
      gas: '2000000',
    }

    const fundsCoins: Coin[] = funds.map(f => ({
      denom: f.denom,
      amount: f.amount
    }))

    const result = await this.cosmwasmClient.execute(
      this.address,
      contractAddress,
      msg,
      fee,
      undefined,
      fundsCoins
    )

    return result.transactionHash
  }
}
  