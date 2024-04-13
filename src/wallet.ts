import bs58 from 'bs58';

import { TokenAmount } from '@raydium-io/raydium-sdk';
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  AccountInfo,
  Connection,
  Keypair,
  ParsedAccountData,
  PublicKey,
} from '@solana/web3.js';

import { newTokenAmount } from './config';

export const buildWallet = (privateKey: string) => {
    return Keypair.fromSecretKey(bs58.decode(privateKey));
}

export const buildWalletBalances = async (connection: Connection, wallet: Keypair) => {
// Fetch all token accounts by owner
const parsedTokenAccounts = await connection.getParsedTokenAccountsByOwner(
    wallet.publicKey,
    {
      programId: TOKEN_PROGRAM_ID,
    }
  );
  
  // Loop through each token account to get the balance
  parsedTokenAccounts.value.forEach((account: {
    pubkey: PublicKey;
    account: AccountInfo<ParsedAccountData>;
}) => {
    const tokenAmount = account.account.data.parsed.info.tokenAmount;
    console.log(`Token Mint: ${account.account.data.parsed.info.mint}`);
    console.log(`Balance: ${tokenAmount.uiAmountString}`);
  });
    return {
        'SOL': 0,
        'WSOL': 0,
    }
}

export const getWalletTokenAmount = async (connection: Connection, tokenMint: string, owner: PublicKey): Promise<TokenAmount> => {
    const tokenAddress = getAssociatedTokenAddressSync(new PublicKey(tokenMint), owner);
    const info = await connection.getTokenAccountBalance(tokenAddress);
    return newTokenAmount(tokenMint.toString(), info.value.amount, info.value.decimals);
}
