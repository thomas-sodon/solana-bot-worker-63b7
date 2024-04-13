
export const TRANSACTION_ERROR_TYPES: Record<string, string> = {
	BLOCKHASH_EXPIRED: 'Blockhash expired',
	SLIPPAGE: 'Transaction encountered slippage'
};
Object.freeze(TRANSACTION_ERROR_TYPES);

export type TransactionErrorType = typeof TRANSACTION_ERROR_TYPES[keyof typeof TRANSACTION_ERROR_TYPES];

export class TransactionError extends Error {
  constructor(public readonly transactionErrorType: TransactionErrorType, message?: string) {
    super(message ? `${TRANSACTION_ERROR_TYPES[transactionErrorType]}: ${message}`: `${TRANSACTION_ERROR_TYPES[transactionErrorType]}`);
    this.name = 'TransactionError';
  }
}