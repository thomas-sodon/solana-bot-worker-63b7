export enum WorkerErrorType {
    SWAP_NOT_SUPPORTED = 'Swap not currently supported',
    NO_TOKEN_BALANCE = 'No token balance',
}
  
  
  export class WorkerError extends Error {
    constructor(public readonly workerErrorType: WorkerErrorType, message?: string) {
      super(message ? `${workerErrorType.toString()}: ${message}`: `${workerErrorType.toString()}`);
      this.name = 'WorkerError';
    }
  }