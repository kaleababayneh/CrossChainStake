import {
    PrivateKey,
    MsgExecuteContractCompat,
    MsgBroadcasterWithPk,
    ChainGrpcWasmApi,
    ChainGrpcBankApi
  } from '@injectivelabs/sdk-ts'
  import { Network, getNetworkEndpoints } from '@injectivelabs/networks'
  import { ChainId } from '@injectivelabs/ts-types'

  
  export class InjectiveWallet {
    public readonly wallet: PrivateKey
    public readonly address: string
    public readonly broadcaster: MsgBroadcasterWithPk
    public readonly wasmApi: ChainGrpcWasmApi
    public readonly bankApi: ChainGrpcBankApi
  
    constructor(mnemonic: string) {
      this.wallet = PrivateKey.fromMnemonic(mnemonic)
      this.address = this.wallet.toAddress().toBech32()
  
      const endpoints = getNetworkEndpoints(Network.Testnet)
  
      this.broadcaster = new MsgBroadcasterWithPk({
        privateKey: this.wallet,
        network: Network.Testnet,
        chainId: ChainId.Testnet,
        endpoints
      })
  
      this.wasmApi = new ChainGrpcWasmApi(endpoints.grpc)
      this.bankApi = new ChainGrpcBankApi(endpoints.grpc)
    }
  
    public getAddress(): string {
      return this.address
    }
  
    public async getNativeBalance(denom: string): Promise<string> {
      const balanced = await this.bankApi.fetchBalance({
        accountAddress: this.address,
        denom
      })
  
      return balanced.amount.toString() 
    }
  
    public async getTokenBalance(cw20Address: string): Promise<string> {
      const query = {
        balance: {
          address: this.address
        }
      }
  
      const res = await this.wasmApi.fetchSmartContractState(cw20Address, Buffer.from(JSON.stringify(query)).toString('base64'))
      return JSON.parse(Buffer.from(res.data).toString()).balance
    }
  
    public async getAllowance(cw20Address: string, spender: string): Promise<string> {
      const query = {
        allowance: {
          owner: this.address,
          spender
        }
      }
  
      const res = await this.wasmApi.fetchSmartContractState(cw20Address, Buffer.from(JSON.stringify(query)).toString('base64'))
      return JSON.parse(Buffer.from(res.data).toString()).allowance
    }
  
    public async approveToken(cw20Address: string, spender: string, amount: string): Promise<string> {
      const msg = {
        increase_allowance: {
          spender,
          amount
        }
      }
  
      const tx = await this.broadcaster.broadcast({
        msgs: MsgExecuteContractCompat.fromJSON({
          sender: this.address,
          contractAddress: cw20Address,
          msg,
          funds: []
        })
      })
  
      return tx.txHash
    }
  
    public async transferToken(cw20Address: string, to: string, amount: string): Promise<string> {
      const msg = {
        transfer: {
          recipient: to,
          amount
        }
      }
  
      const tx = await this.broadcaster.broadcast({
        msgs: MsgExecuteContractCompat.fromJSON({
          sender: this.address,
          contractAddress: cw20Address,
          msg,
          funds: []
        })
      })
  
      return tx.txHash
    }
  
    public async sendNative(to: string, amount: string, denom = 'inj'): Promise<string> {
      const msg = MsgExecuteContractCompat.fromJSON({
        sender: this.address,
        contractAddress: to,
        msg: {},
        funds: [{
          denom,
          amount
        }]
      })
  
      const tx = await this.broadcaster.broadcast({ msgs: msg })
      return tx.txHash
    }
  
    public async sendExecuteMsg(
      contractAddress: string,
      msg: object,
      funds: { denom: string; amount: string }[] = []
    ): Promise<string> {
      const tx = await this.broadcaster.broadcast({
        msgs: MsgExecuteContractCompat.fromJSON({
          sender: this.address,
          contractAddress,
          msg,
          funds
        })
      })
  
      return tx.txHash
    }
  }
  