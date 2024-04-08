/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// import { EnrichedTransaction, SwapEvent, TransactionType } from "helius-sdk";
import { Connection, VersionedTransaction, TransactionSignature, Keypair, BlockheightBasedTransactionConfirmationStrategy } from '@solana/web3.js';
// import { DefaultApi, QuoteResponse, createJupiterApiClient } from '@jup-ag/api';
import bs58 from 'bs58';

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
  HELIUS_API_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  WALLET_PUBLIC_KEY: string;
  WALLET_PRIVATE_KEY: string;
}

const nativeMint = "So11111111111111111111111111111111111111112";

export type EventProcessingResult = {
  txId: string;
  tokenMint: string;
  quoteResponse?: any;
}

export default <ExportedHandler<Env>>{
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const payer = Keypair.fromSecretKey(bs58.decode(env.WALLET_PRIVATE_KEY || ''));
    const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;
    // const helius = new Helius(env.HELIUS_API_KEY); // Initialize Helius SDK
    // const HELIUS_WEBHOOK_URL = `https://api.helius.xyz/v0/webhooks/?api-key=${env.HELIUS_API_KEY}`;
    let messageToSendTransfer = '';
    let response = new Response('Event received', {status: 200});
    try {
      const connection = new Connection(HELIUS_RPC_URL);
      const requestBodyArray = (await request.json()) as any[];
      const requestBody = requestBodyArray[0];
      console.log(`Received request: ${JSON.stringify(requestBody, null, 2)}`);
      const { description, type, events } = requestBody;
      if(type === 'SWAP') {
        const { swap, source } = events;
        if(swap){
          const {txId, tokenMint} = await handleSwapEvent(connection, env, payer, swap);

          let { timestamp, signature } = requestBody;
          const timestampString = new Date(timestamp * 1000).toLocaleString(); // Convert Unix timestamp to readable date-time
          signature = `https://xray.helius.xyz/tx/${signature}`
          const rugcheckLink = `https://rugcheck.xyz/tokens/${tokenMint}`;
          const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;
          const txLink = `https://solscan.io/tx/${txId}`;
          messageToSendTransfer = 
          `----SWAP SUCCESS---\n`+
          `Description:\n${description}\n`+
          `Timestamp:\n${timestampString}\n`+
          `Signature:\n${signature}\n`+
          `Transaction Link:\n${txLink}\n`+
          `Rugcheck Link:\n${rugcheckLink}\n`+
          `DexScreener Link:\n${dexScreenerLink}\n`+
          `Source: ${source}\n`;
        }
      }

      response =  new Response('Logged.', {status: 200});
    } catch(e) {
      console.log('Unknown Error:', e);
      messageToSendTransfer = 
      `----SWAP ERROR---\n`+
      `${JSON.stringify(e, null, 2)}\n`;
      response = new Response('Unknown Error', {status: 500});
    } finally {
      await sendToTelegramBot(env, messageToSendTransfer); // Send to Telegram
    }
    return response;
  },
};
      // const swapTransaction = await executeJupiterTransaction(quoteResponse);
      // const { signature } = swapTransaction;
      // const messageToSendSwap = 
      // `----SWAP---\n`+
      // `Description:\n${description}\n` +
      // `Signature:\n${signature}\n` +
      // `Timestamp:\n${new Date().toLocaleString()}\n` + 
      // `Swap Transaction:\n${JSON.stringify(swapTransaction, null, 2)}`;
      // await sendToTelegramBot(env, messageToSendSwap); // Send to Telegram
const handleSwapEvent = async (connection: Connection, env: Env, payer: Keypair, swapEvent: any): Promise<EventProcessingResult> => {
  const {nativeInput, tokenInputs, tokenOutputs, nativeOutput } = swapEvent;
  // const jupiterQuoteApi = createJupiterApiClient();
  let tokenMint;
    let quoteResponse;
    console.log({swapEvent});
    if (nativeInput && tokenOutputs.length > 0) {
      quoteResponse = await getJupiterQuote(nativeMint, tokenOutputs[0].mint, nativeInput.amount);
      tokenMint = tokenOutputs[0].mint;
    } else if (tokenInputs.length > 0 && nativeOutput) {
      quoteResponse = await getJupiterQuote(tokenInputs[0].mint, nativeMint, parseInt(tokenInputs[0].rawTokenAmount.tokenAmount));
      tokenMint = tokenInputs[0].mint;
    }
    let txId = '';
    console.log({quoteResponse});
    // if(quoteResponse) {
    //   const swapTransaction = await serializeJupiterTransaction(payer, quoteResponse);
    //   console.log({swapTransaction});
    //   // const transaction = signTransaction(payer, swapTransaction);
    //   // txId = await executeTransaction(connection, transaction);
    // }
    return {
      quoteResponse,
      txId,
      tokenMint: tokenOutputs[0].mint
  };
}

// Write a function to execute a transaction using the Jupiter API
const getJupiterQuote = async (inputMint: string, outputMint: string, amount: number): Promise<any> => {
    // const quoteResponse = await jupiterQuoteApi.quoteGet({
    //   inputMint,
    //   outputMint,
    //   amount,
    //   computeAutoSlippage: true,
    //   // platformFeeBps: 10,
    //   // asLegacyTransaction: true, // legacy transaction, default is versoined transaction
    // })
    console.log({inputMint, outputMint, amount});
    const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&computeAutoSlippage=true`;
    console.log({url});
    const quoteResponse = await (await fetch(url)).json();
    return quoteResponse;
} 

// const serializeJupiterTransaction = async (jupiterQuoteApi: DefaultApi, payer: Keypair, quoteResponse: QuoteResponse): Promise<string> => {
//   const { swapTransaction } = await jupiterQuoteApi.swapPost({
//     swapRequest:{
//       // quoteResponse from /quote api
//       quoteResponse,
//       // user public key to be used for the swap
//       userPublicKey: payer.publicKey.toString(),
//       // auto wrap and unwrap SOL. default is true
//       // wrapAndUnwrapSol: true,
//       prioritizationFeeLamports: 10000,
//       // feeAccount is optional. Use if you want to charge a fee.  feeBps must have been passed in /quote API.
//       // feeAccount: "fee_account_public_key"
//     }
//   })
//   return swapTransaction;
// }

const signTransaction = (payer: Keypair, swapTransaction: string): VersionedTransaction => {
  // deserialize the transaction
  const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
  console.log(transaction);

  // sign the transaction
  transaction.sign([payer]);
  return transaction;
}

const executeTransaction = async (connection: Connection, transaction: VersionedTransaction): Promise<TransactionSignature> => {
  // Execute the transaction
  const rawTransaction = transaction.serialize();
  const signature = await connection.sendRawTransaction(rawTransaction);
  const latestBlockHash = await connection.getLatestBlockhash()
  const confirmStrategy: BlockheightBasedTransactionConfirmationStrategy = {
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: signature
  }
  const confirmTransactionResult = await connection.confirmTransaction(confirmStrategy);
  console.log({confirmTransactionResult});
  return signature;
}


async function sendToTelegramBot(env: Env, message: string) {
	const TELEGRAM_BOT_URL = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
	const response = await fetch(`${TELEGRAM_BOT_URL}/sendMessage`, {
	  method: 'POST',
	  headers: {
		  'Content-Type': 'application/json',
	  },
	  body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: message, 
      parse_mode: "HTML"
	  }),
	});
	const responseData = await response.json();

	if (!response.ok) {
	  throw new Error(`Failed to send message to Telegram: ${JSON.stringify(responseData, null, 2)}`);
	}
  return responseData;
}

// const editWebhook = async (helius: Helius, accountAddresses: string[]): Promise<Webhook> => {
//   const webhookID = "f07b6cc6-5631-46e8-837d-f1ff3239d5a1";
//   const webhookURL = "https://solana-bot-worker-63b7.thomas-sodon.workers.dev";

//    const webhook = await helius.editWebhook(webhookID, {
//       webhookURL: "https://solana-bot-worker-63b7.thomas-sodon.workers.dev",
//       transactionTypes: [TransactionType.ANY],
//       accountAddresses,
//       webhookType: WebhookType.ENHANCED
//     });
//   return webhook;
// };