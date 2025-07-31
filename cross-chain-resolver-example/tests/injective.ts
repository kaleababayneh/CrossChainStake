import { ethers } from "ethers";
import { createHash } from 'crypto';
import { InjectiveWallet } from './injective-wallet';
import * as dotenv from 'dotenv';

dotenv.config();

// Using mnemonic phrases
const mnemonic = process.env.MNEMONIC as string;
const mnemonic2 = process.env.MNEMONIC2 as string;

// Initialize wallets (will be done async)
let wallet: InjectiveWallet;
let wallet2: InjectiveWallet;
let address: string;
let address2: string;

// Initialize wallets
async function initWallets() {
  if (!wallet) {
    wallet = await InjectiveWallet.create(mnemonic);
    address = wallet.getAddress();
  }
  if (!wallet2) {
    wallet2 = await InjectiveWallet.create(mnemonic2);
    address2 = wallet2.getAddress();
  }
}

const codeId = 33343; // e.g. "33340"
const contractLabel = 'CW20 Atomic Swap';
const recipientAddress = process.env.RECIPIENT; // e.g. 'inj1...'
const contractAddress = process.env.CW_20_ATOMIC_SWAP_CONTRACT_ADDRESS as string;
const cusdcAddress = process.env.CUSDC_CONTRACT_ADDRESS as string;

const preimage = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const hash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex');
const SWAP_ID = 'swap-02337775552081'; // e.g. 'swap-cusdc-001'

export async function initializeSwapLedger() {
  await initWallets();
  
  // Note: Contract instantiation in CosmJS would require different approach
  // This is a placeholder - you'll need to implement contract instantiation
  // if you're deploying new contracts
  
  console.log('✅ Contract instantiation not implemented in CosmJS version');
  console.log('Use existing contract address:', contractAddress);
}

export async function anounce_order() {
  await initWallets();
  
  const preimage = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
  const hash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex');
  console.log(`🔐 Announcing order from ${address}`);

  const expiresAtHeight = 90_000_000;
  const swapId = 'swap-cusdc-001';

  const executeMsg = {
    create: {
      id: swapId,
      hash,
      recipient: recipientAddress,
      expires: {
        at_height: expiresAtHeight
      }
    }
  };

  const funds = [{
    amount: '10000000000000000', // 0.001 INJ in wei (18 decimals)
    denom: 'inj'
  }];

  const txHash = await wallet.sendExecuteMsg(contractAddress, executeMsg, funds);

  console.log('✅ CUSDC Swap announced!');
  console.log('Tx Hash:', txHash);
  console.log('Hash (SHA256):', hash);
}

export async function fund_dst_escrow() {
  await initWallets();
  
  const preimage = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
  const hash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex');
  console.log(`💰 Funding dst escrow with CUSDC from ${address}`);
  const swapId = SWAP_ID;

  const expiresAtHeight = 90_000_000;

  const executeMsg = {
    create: {
      id: swapId,
      hash,
      recipient: recipientAddress,
      expires: {
        at_height: expiresAtHeight,
      },
    },
  };

  const funds = [{
    amount: '10000000000000000', // 0.001 INJ (18 decimals)
    denom: 'inj',
  }];

  const txHash = await wallet.sendExecuteMsg(contractAddress, executeMsg, funds);

  console.log('✅ Counterparty funded dst escrow with CUSDC');
  console.log('Tx Hash:', txHash);
  console.log('Hash (SHA256):', hash);
}

export async function claim_funds() {
  await initWallets();
  
  const swapId = SWAP_ID; // e.g. 'swap-cusdc-001'
  const preimage = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
  console.log(`🔓 Claiming CUSDC from swap "${swapId}" by revealing preimage from ${address2}`);

  const executeMsg = {
    release: {
      id: swapId,
      preimage,
    },
  };

  const txHash = await wallet2.sendExecuteMsg(contractAddress, executeMsg, []);

  console.log('✅ CUSDC successfully claimed!');
  console.log('Tx Hash:', txHash);
  console.log('Preimage:', preimage);
}

export async function fund_dst_escrow_with_params(
  preimage: string, 
  amount: string, 
  recipient: string, 
  expiresAtHeight: number,
  swapId: string
) {
  await initWallets();
  
  const hash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex');
  console.log(`💰 Funding dst escrow with ${amount} CUSDC from ${address}`);

  const executeMsg = {
    create: {
      id: swapId,
      hash,
      recipient,
      expires: {
        at_height: expiresAtHeight,
      },
    },
  };

  const funds = [
    {
      amount: amount, // native INJ amount in uinj
      denom: 'inj',
    },
  ];

  const txHash = await wallet.sendExecuteMsg(contractAddress, executeMsg, funds);

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('✅ Destination escrow funded on Injective');
  console.log('Tx Hash:', txHash);
  console.log('Swap ID:', swapId);
  
  return { swapId, txHash };
}

export async function claim_funds_with_params(swapId: string, preimage: string) {
  await initWallets();
  
  console.log(`🔓 Claiming CUSDC from swap "${swapId}" from ${address2}`);

  const executeMsg = {
    release: {
      id: swapId,
      preimage,
    },
  };

  const txHash = await wallet2.sendExecuteMsg(contractAddress, executeMsg, []);

  console.log('✅ Native INJ successfully claimed!');
  console.log('Tx Hash:', txHash);
  
  return txHash;
}

export async function claim_funds_with_params_resolver(swapId: string, preimage: string) {
  await initWallets();
  
  console.log(`🔓 Resolver claiming CUSDC from swap "${swapId}" from ${address}`); // Note: using wallet (resolver), not wallet2 (user)

  const executeMsg = {
    release: {
      id: swapId,
      preimage,
    },
  };

  const txHash = await wallet.sendExecuteMsg(contractAddress, executeMsg, []);

  console.log('✅ Resolver successfully claimed native INJ!');
  console.log('Tx Hash:', txHash);

  return txHash;
}