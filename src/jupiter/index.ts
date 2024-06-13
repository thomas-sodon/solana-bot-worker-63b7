import {
  createJupiterApiClient,
  DefaultApi,
  QuoteResponse,
  SwapInstructionsResponse,
  SwapResponse,
} from '@jup-ag/api';
import {
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import { Keypair } from '@solana/web3.js';

import {
  JUPITER_ERROR_TYPES,
  JupiterError,
} from '../errors/jupiter-error';
import { Env } from '../worker';

const prioritizationFeeLamports = 'auto';
const buildBasePath = (apikey: string) => `https://jupiter-swap-api.quiknode.pro/${apikey}`; // Jupiter API base path

export async function buildJupiterSwapTransaction(env: Env, payer: Keypair, inputTokenAmount: TokenAmount, outputToken: Token): Promise<SwapResponse> {
  const jupiterApi = createJupiterApiClient({
    basePath: buildBasePath(env.JUPITER_API_KEY),
  });
  const quoteResponse = await getJupiterQuote(jupiterApi, inputTokenAmount.token.mint.toString(), outputToken.mint.toString(), inputTokenAmount.raw.toString(10));
  return getJupiterSwapTransaction(jupiterApi, payer, quoteResponse);
}

export async function buildJupiterSwapInstructions(env: Env, payer: Keypair, inputTokenAmount: TokenAmount, outputToken: Token): Promise<SwapInstructionsResponse> {
  const jupiterApi = createJupiterApiClient({
    basePath: buildBasePath(env.JUPITER_API_KEY),
  });
  console.log('getJupiterQuote: ')
  const quoteResponse = await getJupiterQuote(jupiterApi, inputTokenAmount.token.mint.toString(), outputToken.mint.toString(), inputTokenAmount.raw.toString(10));
  console.log('getJupiterSwapInstructions: ')
  return getJupiterSwapInstructions(jupiterApi, payer, quoteResponse);
}

const getJupiterQuote = async (jupiterApi: DefaultApi, inputMint: string, outputMint: string, amount: string): Promise<QuoteResponse> => {
  const quoteResponse = await jupiterApi.quoteGet({
    inputMint,
    outputMint,
    amount: amount as unknown as number,
    computeAutoSlippage: true,
    // platformFeeBps: 10,
    // asLegacyTransaction: true, // legacy transaction, default is versioned transaction
  })
  if((quoteResponse && (quoteResponse as any).error) || !quoteResponse) {
    throw new JupiterError(JUPITER_ERROR_TYPES.QUOTE_FAIL, `${(quoteResponse as any).error}`);
  }
  return quoteResponse;
} 

const getJupiterSwapTransaction = async (jupiterApi: DefaultApi, payer: Keypair, quoteResponse: QuoteResponse): Promise<SwapResponse> => {
  const swapResponse = await jupiterApi.swapPost({
    swapRequest:{
      // quoteResponse from /quote api
      quoteResponse,
      // user public key to be used for the swap
      userPublicKey: payer.publicKey.toString(),
      // auto wrap and unwrap SOL. default is true
      wrapAndUnwrapSol: true,
      prioritizationFeeLamports,
      dynamicComputeUnitLimit: true
      // feeAccount is optional. Use if you want to charge a fee.  feeBps must have been passed in /quote API.
      // feeAccount: "fee_account_public_key"
    }
  })
  if((swapResponse && (swapResponse as any).error) || !swapResponse) {
    throw new JupiterError(JUPITER_ERROR_TYPES.SWAP_TRANSACTION_FAIL, `${(swapResponse as any).error}`);
  }
  // console.log(`swapResponse: (${JSON.stringify(swapResponse, null, 2)})`);
  return swapResponse;
}

const getJupiterSwapInstructions = async (jupiterApi: DefaultApi, payer: Keypair, quoteResponse: QuoteResponse): Promise<SwapInstructionsResponse> => {
  const swapInstructionsResponse = await jupiterApi.swapInstructionsPost({
    swapRequest:{
      // quoteResponse from /quote api
      quoteResponse,
      // user public key to be used for the swap
      userPublicKey: payer.publicKey.toString(),
      // auto wrap and unwrap SOL. default is true
      wrapAndUnwrapSol: true,
      prioritizationFeeLamports: 'auto',
      dynamicComputeUnitLimit: true
      // feeAccount is optional. Use if you want to charge a fee.  feeBps must have been passed in /quote API.
      // feeAccount: "fee_account_public_key"
    }
  })
  if((swapInstructionsResponse && (swapInstructionsResponse as any).error) || !swapInstructionsResponse) {
    throw new JupiterError(JUPITER_ERROR_TYPES.SWAP_INSTRUCTIONS_FAIL, `${(swapInstructionsResponse as any).error}`);
  }
  // console.log(`swapInstructionsResponse: (${JSON.stringify(swapInstructionsResponse, null, 2)})`);
  return swapInstructionsResponse;
}