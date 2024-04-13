
export const JUPITER_ERROR_TYPES: Record<string, string> = {
	QUOTE_FAIL: 'Failed to obtain quote',
	SWAP_TRANSACTION_FAIL: 'Failed to the get swap transaction for provided quote',
	SWAP_INSTRUCTIONS_FAIL: 'Failed to the get swap transaction for provided quote'
};
Object.freeze(JUPITER_ERROR_TYPES);

export type JupiterErrorType = typeof JUPITER_ERROR_TYPES[keyof typeof JUPITER_ERROR_TYPES];

export class JupiterError extends Error {
  constructor(public readonly jupiterErrorType: JupiterErrorType, message?: string) {
    super(message ? `${JUPITER_ERROR_TYPES[jupiterErrorType]}: ${message}`: `${JUPITER_ERROR_TYPES[jupiterErrorType]}`);
    this.name = 'JupiterError';
  }
}