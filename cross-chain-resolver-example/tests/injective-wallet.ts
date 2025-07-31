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

    public async getTokenBalance(cw20Address: string): Promise<string> {
      const query = {
        balance: {
          address: this.address
        }
      }
  
      const res = await this.wasmApi.fetchSmartContractState(cw20Address, Buffer.from(JSON.stringify(query)).toString('base64'))
      return JSON.parse(Buffer.from(res.data).toString()).balance
    }

  }