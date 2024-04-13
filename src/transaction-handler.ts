import bs58 from 'bs58';
import * as nacl from 'tweetnacl';

import {
  AccountMeta,
  Instruction,
  SwapInstructionsResponse,
  SwapResponse,
} from '@jup-ag/api';
import {
  AddressLookupTableAccount,
  Connection,
  Keypair,
  PublicKey,
  SignatureStatus,
  TransactionInstruction,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from '@solana/web3.js';

import {
  TRANSACTION_ERROR_TYPES,
  TransactionError,
} from './errors/transaction-error';

export const TRANSACTION_RESULT = {
	...TRANSACTION_ERROR_TYPES,
	SUCCESS: 'Transaction succeeded',
};
Object.freeze(TRANSACTION_RESULT);

export type SigningResult = {
	rawTransaction: Uint8Array;
	lastValidBlockHeight: number;
	signature: string;
};

export const buildAndSignTransactionInstructions = async (
	connection: Connection,
	wallet: Keypair,
	swapInstructionsResponse: SwapInstructionsResponse
): Promise<SigningResult> => {
	const { cleanupInstruction, computeBudgetInstructions, setupInstructions, addressLookupTableAddresses, swapInstruction } =
		swapInstructionsResponse;
	const instructions: TransactionInstruction[] = [
		...computeBudgetInstructions.map(instructionDataToTransactionInstruction),
		...setupInstructions.map(instructionDataToTransactionInstruction),
		instructionDataToTransactionInstruction(swapInstruction),
		instructionDataToTransactionInstruction(cleanupInstruction),
	].filter((ix) => ix !== null) as TransactionInstruction[];

	const addressLookupTableAccounts = await getAddressLookupTableAccounts(addressLookupTableAddresses, connection);

	const blockhashResponse = await connection.getLatestBlockhashAndContext('confirmed');
	const lastValidBlockHeight = blockhashResponse.context.slot + 150;

	const messageV0 = new TransactionMessage({
		payerKey: wallet.publicKey,
		recentBlockhash: blockhashResponse.value.blockhash,
		instructions,
	}).compileToV0Message(addressLookupTableAccounts);

	const transaction = new VersionedTransaction(messageV0);

	const message = messageV0.serialize();
	const signature = nacl.sign.detached(message, wallet.secretKey);
	transaction.addSignature(wallet.publicKey, Buffer.from(signature));
	const rawTransaction = transaction.serialize();

	return { signature: bs58.encode(signature), rawTransaction, lastValidBlockHeight };
};

export const buildAndSignTransaction = (wallet: Keypair, swapResponse: SwapResponse): SigningResult => {
	// deserialize the transaction
	const transaction = VersionedTransaction.deserialize(Buffer.from(swapResponse.swapTransaction, 'base64'));
	// sign the transaction
	transaction.sign([wallet]);
	return {
		rawTransaction: transaction.serialize(),
		lastValidBlockHeight: swapResponse.lastValidBlockHeight + 150,
		signature: bs58.encode(transaction.signatures[0]),
	};
};

export const executeTransaction = async (connection: Connection, signingResult: SigningResult): Promise<TransactionSignature> => {
	const { rawTransaction, lastValidBlockHeight, signature } = signingResult;
	let blockheight = await connection.getBlockHeight();
	const startTime = new Date();
	let txSuccess = false;
	while (blockheight < lastValidBlockHeight) {
		connection.sendRawTransaction(rawTransaction, {
			skipPreflight: true,
			// maxRetries: 0,
		});
		await sleep(2500);
		txSuccess = await checkSignatureStatus(connection, signature, startTime);
		if (txSuccess) {
			break;
		}
		blockheight = await connection.getBlockHeight();
	}
	if (!txSuccess) {
		throw new TransactionError(TRANSACTION_ERROR_TYPES.BLOCKHASH_EXPIRED, `${logElapsedTime(startTime, signature)}`);
	}
	return signature;
};

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

const logElapsedTime = (startTime: Date, signature: string, status?: SignatureStatus) => {
	const endTime = new Date();
	const elapsed = (endTime.getTime() - startTime.getTime()) / 1000;
	return `Elapsed time: ${elapsed} seconds for ${signature} with status (${JSON.stringify(status, null, 2)})`;
};

const checkSignatureStatus = async (connection: Connection, signature: string, startTime: Date) => {
	const { value: status } = await connection.getSignatureStatus(signature);
	let txSuccess = false;
	if (status && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')) {
		txSuccess = true;
		const someError = status.err as any;
		if (someError) {
			if (someError.InstructionError && someError.InstructionError.length >= 2 && someError.InstructionError[1].Custom === 6001) {
				throw new TransactionError(TRANSACTION_ERROR_TYPES.SLIPPAGE, `${logElapsedTime(startTime, signature, status)}`);
			}
			throw new TransactionError(TRANSACTION_ERROR_TYPES.UNKNOWN, `${logElapsedTime(startTime, signature, status)}`);
		}
		console.log(`${TRANSACTION_RESULT.SUCCESS}. ${logElapsedTime(startTime, signature, status)}`);
	} else if (status) {
		console.log(`Status for ${signature}: ${JSON.stringify(status, null, 2)}`);
	}
	return txSuccess;
};

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const instructionDataToTransactionInstruction = (instruction: Instruction | undefined) => {
	if (instruction === null || instruction === undefined) return null;
	return new TransactionInstruction({
		programId: new PublicKey(instruction.programId),
		keys: instruction.accounts.map((key: AccountMeta) => ({
			pubkey: new PublicKey(key.pubkey),
			isSigner: key.isSigner,
			isWritable: key.isWritable,
		})),
		data: Buffer.from(instruction.data, 'base64'),
	});
};

const getAddressLookupTableAccounts = async (keys: string[], connection: Connection): Promise<AddressLookupTableAccount[]> => {
	const addressLookupTableAccountInfos = await connection.getMultipleAccountsInfo(keys.map((key) => new PublicKey(key)));

	return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
		const addressLookupTableAddress = keys[index];
		if (accountInfo) {
			const addressLookupTableAccount = new AddressLookupTableAccount({
				key: new PublicKey(addressLookupTableAddress),
				state: AddressLookupTableAccount.deserialize(accountInfo.data),
			});
			acc.push(addressLookupTableAccount);
		}

		return acc;
	}, new Array<AddressLookupTableAccount>());
};
