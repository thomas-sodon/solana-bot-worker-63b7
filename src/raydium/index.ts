import {
  Percent,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import {
  Connection,
  Keypair,
} from '@solana/web3.js';

import { routeSwap } from './swapRoute';
import { getWalletTokenAccount } from './util';

export async function buildAndSerializeSwap(connection: Connection, wallet: Keypair, inputTokenAmount: TokenAmount, outputToken: Token): 
  Promise<{txids: string[];}> {
    const slippage = new Percent(5, 100);
    const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)
  
    return routeSwap(connection, wallet, {
      inputToken: inputTokenAmount.token,
      outputToken: outputToken,
      inputTokenAmount,
      slippage,
      walletTokenAccounts,
      wallet,
      // feeConfig: {
      //   feeBps: new BN(25),
      //   feeAccount: Keypair.generate().publicKey // test
      // }
    });
  }