export enum TransactionErrorType {
  SLIPPAGE = 'Blockhash expired',
  BLOCKHASH_EXPIRED = 'Blockhash expired'
}

export class TransactionError extends Error {
  constructor(public readonly transactionErrorType: TransactionErrorType, message?: string) {
    super(message ? `${transactionErrorType.toString()}: ${message}`: `${transactionErrorType.toString()}`);
    this.name = 'TransactionError';
  }
}