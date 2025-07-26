import { 
    MsgSend, 
    MsgExecuteContract,
    ChainRestAuthApi,
    ChainGrpcBankApi,
    createTransaction,
    TxClient,
    ChainRestTendermintApi,
    MsgBroadcaster
} from '@injectivelabs/sdk-ts';
import { Network, getNetworkEndpoints } from '@injectivelabs/networks';
import { Wallet as InjectiveWalletCore } from '@injectivelabs/wallet-ts';
import { BigNumberInBase } from '@injectivelabs/utils';

export class InjectiveWallet {
    private wallet: InjectiveWalletCore;
    private network: Network;
    private endpoints: any;
    private broadcaster: MsgBroadcaster;

    constructor(
        private mnemonic: string,
        network: Network = Network.Testnet
    ) {
        this.network = network;
        this.endpoints = getNetworkEndpoints(network);
        this.wallet = InjectiveWalletCore.fromMnemonic(mnemonic);
        this.broadcaster = new MsgBroadcaster({
            walletStrategy: this.wallet,
            network: this.network,
        });
    }

    async getAddress(): Promise<string> {
        return this.wallet.getInjectiveAddress();
    }

    async getBalance(denom: string): Promise<bigint> {
        const chainGrpcBankApi = new ChainGrpcBankApi(this.endpoints.grpc);
        const balance = await chainGrpcBankApi.fetchBalance({
            accountAddress: await this.getAddress(),
            denom
        });
        
        return BigInt(balance.amount);
    }

    // Similar to Aptos wallet's coin transfer
    async transfer(
        recipient: string,
        amount: bigint,
        denom: string
    ): Promise<{ txHash: string; blockHeight: number }> {
        const msg = MsgSend.fromJSON({
            srcInjectiveAddress: await this.getAddress(),
            dstInjectiveAddress: recipient,
            amount: {
                denom,
                amount: amount.toString()
            }
        });

        const result = await this.broadcaster.broadcast({
            msgs: [msg],
            injectiveAddress: await this.getAddress(),
        });

        return {
            txHash: result.txHash,
            blockHeight: result.height
        };
    }

    // Execute CosmWasm contract (atomic swap operations)
    async executeContract(
        contractAddress: string,
        msg: object,
        funds?: Array<{ denom: string; amount: string }>
    ): Promise<{ txHash: string; blockHeight: number }> {
        const executeMsg = MsgExecuteContract.fromJSON({
            sender: await this.getAddress(),
            contractAddress,
            msg,
            funds: funds || []
        });

        const result = await this.broadcaster.broadcast({
            msgs: [executeMsg],
            injectiveAddress: await this.getAddress(),
        });

        return {
            txHash: result.txHash,
            blockHeight: result.height
        };
    }

    // Query contract state
    async queryContract(contractAddress: string, query: object): Promise<any> {
        const chainGrpcWasmApi = new ChainGrpcWasmApi(this.endpoints.grpc);
        const result = await chainGrpcWasmApi.fetchSmartContractState(
            contractAddress,
            Buffer.from(JSON.stringify(query)).toString('base64')
        );
        
        return JSON.parse(Buffer.from(result.data, 'base64').toString());
    }

    // Similar to Aptos topUpFromDonor - fund account from faucet
    async fundFromFaucet(): Promise<void> {
        const address = await this.getAddress();
        const response = await fetch('https://testnet.faucet.injective.network/api/faucet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address })
        });
        
        if (!response.ok) {
            throw new Error(`Faucet request failed: ${response.statusText}`);
        }
    }
}