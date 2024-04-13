import bs58 from 'bs58';

import {
  BigNumberish,
  Currency,
  ENDPOINT as _ENDPOINT,
  LOOKUP_TABLE_CACHE,
  RAYDIUM_MAINNET,
  Token,
  TOKEN_PROGRAM_ID,
  TokenAmount,
  TxVersion,
} from '@raydium-io/raydium-sdk';
import {
  Keypair,
  PublicKey,
} from '@solana/web3.js';

import { Env } from './worker';

export enum RpcProvider {
  HELIUS,
  QUICKNODE
}

export const buildRpcUrl = (env: Env, rpcProvider: RpcProvider) => {
  switch (rpcProvider) {
    case RpcProvider.QUICKNODE:
      return `https://black-holy-flower.solana-mainnet.quiknode.pro/${env.QUICKNODE_API_KEY}/`;
    case RpcProvider.HELIUS:
      return `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;;
  }
};
export const buildWallet = (privateKey: string) => Keypair.fromSecretKey(bs58.decode(privateKey));

// export const rpcToken: string | undefined = undefined

export class SomeToken {
  constructor(private readonly mint: string, private readonly amount: string){}
}

export const ENDPOINT = _ENDPOINT;

export const RAYDIUM_MAINNET_API = RAYDIUM_MAINNET;

export const makeTxVersion = TxVersion.V0; // LEGACY

export const addLookupTableInfo = LOOKUP_TABLE_CACHE // only mainnet. other = undefined

export const newSplToken = (mint: string, decimals: number) => new Token(TOKEN_PROGRAM_ID, new PublicKey(mint), decimals);

export const newTokenAmount = (mint: string, amount: BigNumberish, decimals: number) => new TokenAmount(newSplToken(mint, decimals), amount)

export const newNativeTokenAmount = (amount: BigNumberish) => new TokenAmount(DEFAULT_TOKEN.WSOL, amount)

export const nativeMint = 'So11111111111111111111111111111111111111112';

export const DEFAULT_TOKEN = {
  'SOL': new Currency(9, 'USDC', 'USDC'),
  'WSOL': new Token(TOKEN_PROGRAM_ID, new PublicKey(nativeMint), 9, 'WSOL', 'WSOL'),
  'USDC': new Token(TOKEN_PROGRAM_ID, new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), 6, 'USDC', 'USDC'),
  'RAY': new Token(TOKEN_PROGRAM_ID, new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY'),
  'RAY_USDC-LP': new Token(TOKEN_PROGRAM_ID, new PublicKey('FGYXP4vBkMEtKhxrmEBcWN8VNmXX8qNgEJpENKDETZ4Y'), 6, 'RAY-USDC', 'RAY-USDC'),
}