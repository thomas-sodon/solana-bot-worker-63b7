/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import {
  SwapInstructionsResponse,
  SwapResponse,
} from '@jup-ag/api';
import {
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import {
  Connection,
  Keypair,
  SolanaJSONRPCError,
} from '@solana/web3.js';

import {
  buildRpcUrl,
  buildWallet,
  DEFAULT_TOKEN,
  newSplToken,
  RpcProvider,
} from './config';
import { JupiterError } from './errors/jupiter-error';
import { TransactionError } from './errors/transaction-error';
import {
  WorkerError,
  WorkerErrorType,
} from './errors/worker-error';
// import { TransactionType } from './helius-enums';
import {
  EnrichedTransaction,
  SwapEvent,
} from './helius-types';
import {
  buildJupiterSwapInstructions,
  buildJupiterSwapTransaction,
} from './jupiter';
import { sendToTelegramBot } from './telegram';
import {
  buildAndSignTransaction,
  buildAndSignTransactionInstructions,
  executeTransaction,
} from './transaction-handler';
import { getWalletTokenAmount } from './wallet';

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	TELEGRAM_CHAT_ID: number;
	MAX_SOL_BUY: number;
	MAX_USDC_BUY: number;
	HELIUS_API_KEY: string;
	QUICKNODE_API_KEY: string;
	JUPITER_API_KEY: string;
	TELEGRAM_BOT_TOKEN: string;
	WALLET_PUBLIC_KEY: string;
	WALLET_PRIVATE_KEY: string;
	// ENABLE_FULL_TRADES: boolean;
  ENABLE_EXECUTION: boolean;
}

export type EventProcessingResult = {
	signature: string | undefined;
	tokenMint: string;
};

export type WorkerContext = {
  connection: Connection;
  env: Env;
  wallet: Keypair;
}

addEventListener('fetch', event => {
  event.respondWith(async function () {
    const request = (await event.request.json());
    event.waitUntil(handleRequest(request));
    return new Response('Processing', { status: 200 });
  }());
});

const maxRetries = 25;

const buildWorkerContext = (): WorkerContext => {
  const env = {
		// @ts-ignore - These values will be set by Wrangler
		TELEGRAM_CHAT_ID: TELEGRAM_CHAT_ID,
		// @ts-ignore - These values will be set by Wrangler
		MAX_SOL_BUY: MAX_SOL_BUY,
		// @ts-ignore - These values will be set by Wrangler
		MAX_USDC_BUY: MAX_USDC_BUY,
		// @ts-ignore - These values will be set by Wrangler
		HELIUS_API_KEY: HELIUS_API_KEY,
		// @ts-ignore - These values will be set by Wrangler
		QUICKNODE_API_KEY: QUICKNODE_API_KEY,
		// @ts-ignore - These values will be set by Wrangler
		TELEGRAM_BOT_TOKEN: TELEGRAM_BOT_TOKEN,
		// @ts-ignore - These values will be set by Wrangler
		WALLET_PUBLIC_KEY: WALLET_PUBLIC_KEY,
		// @ts-ignore - These values will be set by Wrangler
		WALLET_PRIVATE_KEY: WALLET_PRIVATE_KEY,
		// @ts-ignore - These values will be set by Wrangler
		JUPITER_API_KEY: JUPITER_API_KEY,
		// @ts-ignore - These values will be set by Wrangler
    ENABLE_EXECUTION: ENABLE_EXECUTION,
	};
	const wallet = buildWallet(env.WALLET_PRIVATE_KEY);
	const RPC_URL = buildRpcUrl(env, RpcProvider.QUICKNODE);
  const connection = new Connection(RPC_URL);
  // await connection.getSlot();
  return {
    connection,
    env,
    wallet,
  }
}

export const progressIndicator = {
  orange: `\u{1F7E0}`,
  red: `\u{1F534}`,
  yellow: `\u{1F7E1}`,
  green: `\u{1F7E2}`,
  blue: `\u{1F535}`,
  purple: `\u{1F7E3}`,
  white: `\u{25CB}`,
}

export enum SwapProgress {
  SUCCESS = '\u{1F7E2} ----SWAP SUCCESS---',
  NOT_EXECUTED = `\u{1F7E0} ----SWAP NOT EXECUTED---`,
  ERROR = `\u{1F534} ----SWAP ERROR---`,
  IGNORED = `\u{25CB} ----MESSAGE IGNORED---`,
  SWAP_INVALID = `\u{1F7E1} ----SWAP INVALID---`,
  SWAP_IGNORED = `\u{1F7E3} ----SWAP IGNORED---`,
  PROCESSING = `\u{1F535} Processing`,
}

const handleRequest = async (event: any) => {
	let messageToSendTransfer = '';
	let response = new Response('Event received', { status: 200 });
  const wc = buildWorkerContext();

  let description;
	try {
    const requestBodyArray = event as EnrichedTransaction[];
		const requestBody = requestBodyArray[0];
		const { type, events, source } = requestBody;
    ({description} = requestBody);
    sendToTelegramBot(wc, `${SwapProgress.PROCESSING.toString()}: ${description}`); // Send to Telegram
		if (type === 'SWAP' && events) {
			const { swap: swapEvent } = events;
			if (swapEvent) {
				messageToSendTransfer = await processSwapEvent(wc, source, swapEvent, requestBody);
			} else {
        messageToSendTransfer = `${SwapProgress.ERROR.toString()}\n` + `Swap event not found\n`;
      }
		}
		else {
      const requestJson = JSON.stringify(requestBody, null, 2);
      const ignoredMessage = `${SwapProgress.IGNORED.toString()}\n` +
      `${requestJson}\n`;
      console.log(ignoredMessage);
		  messageToSendTransfer =
		  `${ignoredMessage}`;
		}
		response = new Response('Logged.', { status: 200 });
	} catch (e) {
    if((e instanceof SolanaJSONRPCError && e.message.includes('could not find account')) || (e instanceof WorkerError && e.workerErrorType === WorkerErrorType.NO_TOKEN_BALANCE) ){
      messageToSendTransfer =
      `${SwapProgress.SWAP_INVALID.toString()}\n` +
      `${description}\n`;
    } else {
      console.log(`Event Errored: ${JSON.stringify(event, null, 2)}`);
      messageToSendTransfer =
      `${SwapProgress.ERROR.toString()}\n` +
      `${description}\n` +
      `${JSON.stringify((e as Error).message, null, 2)}\n`+
      `${JSON.stringify((e as Error).stack, null, 2)}\n`;
    }
    console.log('Some Error: ', messageToSendTransfer);
		response = new Response('Unknown Error', { status: 500 });
	} finally {
		await sendToTelegramBot(wc, messageToSendTransfer); // Send to Telegram
	}
	return response;
};

const processSwapEvent = async (
	wc: WorkerContext,
	source: String,
	swapEvent: SwapEvent,
  requestBody: EnrichedTransaction,
): Promise<string> => {
  let { timestamp, description, feePayer } = requestBody;
  console.log(`Processing Swap Event: ${description}`);
  const { inputTokenAmount, outputToken, tokenMint } = await extractInputOutputTokens(wc, swapEvent);
  console.log('extractInputOutputTokens');
  console.log(`Input Token Amount: ${JSON.stringify(inputTokenAmount, null, 2)}`);
  console.log(`Output Token: ${JSON.stringify(outputToken, null, 2)}`);
  console.log(`Token Mint: ${tokenMint}`);
	let signature;
	if (inputTokenAmount && outputToken) {
    // if(source === 'JUPITER'){
      signature = await processSwapEventJupiter(wc, inputTokenAmount, outputToken);
      console.log('processSwapEventJupiter');
    // }
	}
  let messageToSendTransfer;

  if (signature) {
    const timestampString = new Date(timestamp * 1000).toLocaleString(); // Convert Unix timestamp to readable date-time
    // const signatureLink = `https://xray.helius.xyz/tx/${signature}`;
    const rugcheckLink = `https://rugcheck.xyz/tokens/${tokenMint}`;
    const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;
    const solscanLink = `https://solscan.io/tx/${signature}`;
    const explorerLink = `https://explorer.solana.com/tx/${signature}`;
    const traderLink = `https://birdeye.so/profile/${feePayer}?chain=solana`;
    messageToSendTransfer =
      `${SwapProgress.SUCCESS.toString()}\n` +
      `Trader: ${feePayer}\n${traderLink}\n` +
      `Description:\n${description}\n` +
      `Timestamp:\n${timestampString}\n` +
      // `Signature:\n${signatureLink}\n` +
      `Transaction Links:\n${solscanLink}\n${explorerLink}\n` +
      `Rugcheck Link:\n${rugcheckLink}\n` +
      `DexScreener Link:\n${dexScreenerLink}\n` +
      `Source: ${source}\n`;
  } else {
    console.log(`Swap ignored: ${description}`);
    messageToSendTransfer = `${SwapProgress.IGNORED.toString()}\nSource: ${source}\n`;
    if (!description) {
      messageToSendTransfer += `${JSON.stringify(requestBody, null, 2)}`;
    } else {
      messageToSendTransfer += `${description}\n`;
    }
  }
  console.log('processSwapEvent')
	return messageToSendTransfer;
};

const processSwapEventJupiter = async (wc: WorkerContext, inputTokenAmount: TokenAmount, outputToken: Token): Promise<string | undefined> => {
  const { connection, env, wallet } = wc;
  let swapResponse;
	let swapSuccess;
	const MAX_NUM_ATTEMPTS = 5;
	let attempts = 0;
  const useInstructions = false;
  let signature;
  while (swapSuccess !== true && attempts <= MAX_NUM_ATTEMPTS) {
    try {
      console.log('buildJupiterSwap before');
      if (useInstructions) {
        swapResponse = await buildJupiterSwapInstructions(env, wallet, inputTokenAmount, outputToken);
      } else {
        swapResponse = await buildJupiterSwapTransaction(env, wallet, inputTokenAmount, outputToken);
      }

      console.log('buildJupiterSwap');

      if (swapResponse) {
        let signingResult;
        if (useInstructions) {
          signingResult = await buildAndSignTransactionInstructions(connection, wallet, swapResponse as SwapInstructionsResponse);
        } else {
          signingResult = buildAndSignTransaction(wallet, swapResponse as SwapResponse);
        }
        if(env.ENABLE_EXECUTION === true){
          signature = await executeTransaction(wc, signingResult);
          console.log('executeTransaction');
        } else {
          signature = 'notexecuted';
        }
        break;
      }
    } catch (e) {
      if ((e instanceof TransactionError || e instanceof JupiterError) && attempts >= MAX_NUM_ATTEMPTS) {
        console.log(`Transaction failed after ${MAX_NUM_ATTEMPTS} attempts: ${e.message}`);
        throw e;
      } else if (!(e instanceof TransactionError || e instanceof JupiterError)) {
        throw e;
      } else {
        console.log(`Attempt ${attempts} failed. Retrying... ${e.message}`);
      }
    } finally {
      attempts += 1;
    }
  }
  return signature;
}

const extractInputOutputTokens = async (wc: WorkerContext, swapEvent: SwapEvent): Promise<{inputTokenAmount: TokenAmount, outputToken: Token, tokenMint: string}> => {
  const { nativeInput, nativeOutput, tokenInputs, tokenOutputs } = swapEvent;
	let inputTokenAmount: TokenAmount | undefined;
	let outputToken: Token | undefined;
	let tokenMint: string | undefined;
	if (nativeInput && tokenOutputs.length > 0) {
		tokenMint = tokenOutputs[0].mint;
		// const amount = nativeInput.amount;
		inputTokenAmount = new TokenAmount(DEFAULT_TOKEN.WSOL, wc.env.MAX_SOL_BUY);
		// outputToken = DEFAULT_TOKEN.USDC;
		outputToken = newSplToken(tokenOutputs[0].mint, tokenOutputs[0].rawTokenAmount.decimals);
	} else if (tokenInputs.length > 0 && nativeOutput) {
		tokenMint = tokenInputs[0].mint;
    // Obtain token balance from the wallet
    inputTokenAmount = await getWalletTokenAmount(wc.connection, tokenInputs[0].mint, wc.wallet.publicKey);
		// const { decimals } = tokenInputs[0].rawTokenAmount;
		// inputTokenAmount = newTokenAmount(tokenInputs[0].mint, tokenBalance.value.amount, decimals);
		// inputTokenAmount = new TokenAmount(DEFAULT_TOKEN.USDC, env.MAX_USDC_BUY);
		outputToken = DEFAULT_TOKEN.WSOL;
		//  inputTokenAmount = newTokenAmount(tokenInputs[0].mint, tokenInputs[0].rawTokenAmount.tokenAmount, tokenInputs[0].rawTokenAmount.decimals);
	} else if (tokenInputs.length > 0 && tokenOutputs.length > 0) {
		// quoteResponse = await getJupiterQuote(jupiterApi, tokenInputs[0].mint, tokenOutputs[0].mint, parseInt(tokenInputs[0].rawTokenAmount.tokenAmount));
		// tokenMint = tokenOutputs[0].mint;
	}
  // console.log(`Input Token Amount: ${JSON.stringify(inputTokenAmount, null, 2)}`);
  // console.log(`Output Token: ${JSON.stringify(outputToken, null, 2)}`);
  // console.log(`Token Mint: ${tokenMint}`);

  if(!inputTokenAmount || !outputToken || !tokenMint){
    if(!inputTokenAmount){
      throw new WorkerError(WorkerErrorType.SWAP_NOT_SUPPORTED, `Token balance not found for ${tokenMint}`);
    }
    throw new WorkerError(WorkerErrorType.SWAP_NOT_SUPPORTED, `Swap not currently supported`);
  }

  return {inputTokenAmount, outputToken, tokenMint};
}