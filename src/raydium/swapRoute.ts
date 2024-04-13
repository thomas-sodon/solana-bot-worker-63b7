import BN from 'bn.js';

import {
  ApiClmmPoolsItem,
  ApiPoolInfo,
  Clmm,
  Currency,
  CurrencyAmount,
  fetchMultipleMintInfos,
  MAINNET_PROGRAM_ID,
  Percent,
  Token,
  TokenAmount,
  TradeV2,
} from '@raydium-io/raydium-sdk';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
} from '@solana/web3.js';

import { makeTxVersion } from '../config';
import { formatAmmKeysToApi } from './formatAmmKeys';
import { formatClmmKeys } from './formatClmmKeys';
import {
  buildAndSendTx,
  getWalletTokenAccount,
} from './util';

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  inputToken: Token | Currency
  outputToken: Token | Currency
  inputTokenAmount: TokenAmount | CurrencyAmount
  slippage: Percent
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair

  feeConfig?: {
    feeBps: BN,
    feeAccount: PublicKey
  }
}

export async function routeSwap(connection: Connection, wallet: Keypair, input: TestTxInputInfo) {
  // -------- pre-action: fetch Clmm pools info and ammV2 pools info --------
  const clmmPools: ApiClmmPoolsItem[] = await formatClmmKeys(connection, MAINNET_PROGRAM_ID.CLMM.toString()) // If the clmm pool is not required for routing, then this variable can be configured as undefined
  const clmmList = Object.values(
    await Clmm.fetchMultiplePoolInfos({ connection, poolKeys: clmmPools, chainTime: new Date().getTime() / 1000 })
  ).map((i) => i.state)

  const sPool: ApiPoolInfo = await formatAmmKeysToApi(connection, MAINNET_PROGRAM_ID.AmmV4.toString(), true) // If the Liquidity pool is not required for routing, then this variable can be configured as undefined

  // -------- step 1: get all route --------
  const getRoute = TradeV2.getAllRoute({
    inputMint: input.inputToken instanceof Token ? input.inputToken.mint : PublicKey.default,
    outputMint: input.outputToken instanceof Token ? input.outputToken.mint : PublicKey.default,
    apiPoolList: sPool,
    clmmList,
  })

  // -------- step 2: fetch tick array and pool info --------
  const [tickCache, poolInfosCache] = await Promise.all([
    await Clmm.fetchMultiplePoolTickArrays({ connection, poolKeys: getRoute.needTickArray, batchRequest: true }),
    await TradeV2.fetchMultipleInfo({ connection, pools: getRoute.needSimulate, batchRequest: true }),
  ])

  // -------- step 3: calculation result of all route --------
  const [routeInfo] = TradeV2.getAllRouteComputeAmountOut({
    directPath: getRoute.directPath,
    routePathDict: getRoute.routePathDict,
    simulateCache: poolInfosCache,
    tickCache,
    inputTokenAmount: input.inputTokenAmount,
    outputToken: input.outputToken,
    slippage: input.slippage,
    chainTime: new Date().getTime() / 1000, // this chain time

    feeConfig: input.feeConfig,

    mintInfos: await fetchMultipleMintInfos({connection, mints: [
      ...clmmPools.map(i => [{mint: i.mintA, program: i.mintProgramIdA}, {mint: i.mintB, program: i.mintProgramIdB}]).flat().filter(i => i.program === TOKEN_2022_PROGRAM_ID.toString()).map(i => new PublicKey(i.mint)),
    ]}),

    epochInfo: await connection.getEpochInfo(),
  })

  // -------- step 4: create instructions by SDK function --------
  const { innerTransactions } = await TradeV2.makeSwapInstructionSimple({
    routeProgram: MAINNET_PROGRAM_ID.Router,
    connection,
    swapInfo: routeInfo,
    ownerInfo: {
      wallet: wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
      associatedOnly: true,
      checkCreateATAOwner: true,
    },
    
    computeBudgetConfig: { // if you want add compute instruction
      units: 400000, // compute instruction
      microLamports: 1, // fee add 1 * 400000 / 10 ** 9 SOL
    },
    makeTxVersion,
  })

  return { txids: await buildAndSendTx(connection, wallet, innerTransactions) }
}
