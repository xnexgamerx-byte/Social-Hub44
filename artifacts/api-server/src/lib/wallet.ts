import { and, eq, sql } from "drizzle-orm";
import {
  db,
  walletsTable,
  walletTransactionsTable,
  type Wallet,
} from "@workspace/db";

export type Currency = "coins" | "V";

/** Transaction executor type accepted by the *Tx helpers. */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type TxType =
  | "recharge"
  | "purchase"
  | "gift_sent"
  | "gift_received"
  | "task_reward"
  | "adjust";

export interface WalletView {
  userId: string;
  coins: number;
  vPoints: number;
}

export function toWalletView(w: Wallet): WalletView {
  return { userId: w.userId, coins: w.coins, vPoints: w.vPoints };
}

/**
 * Ensure a wallet row exists for the user. On first creation it is seeded
 * with the provided initial balances (used to migrate local AsyncStorage
 * balances). If the wallet already exists, its balances are left untouched.
 */
export async function ensureWallet(
  userId: string,
  initialCoins = 0,
  initialVPoints = 0,
): Promise<Wallet> {
  await db
    .insert(walletsTable)
    .values({ userId, coins: initialCoins, vPoints: initialVPoints })
    .onConflictDoNothing({ target: walletsTable.userId });

  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .limit(1);

  return wallet;
}

export class InsufficientBalanceError extends Error {
  constructor(public currency: Currency) {
    super("الرصيد غير كافٍ");
    this.name = "InsufficientBalanceError";
  }
}

interface AdjustParams {
  userId: string;
  currency: Currency;
  amount: number;
  type: TxType;
  description?: string;
  refId?: string;
}

/**
 * Core balance adjustment that runs inside a caller-supplied transaction.
 * Use this when the wallet change must be atomic with other writes (e.g.
 * inserting ownership in the same transaction as the debit).
 */
export async function adjustWalletTx(
  tx: DbTx,
  params: AdjustParams,
): Promise<Wallet> {
  const { userId, currency, amount, type } = params;
  const description = params.description ?? "";
  const refId = params.refId ?? "";

  // Lock the wallet row for the duration of the transaction.
  const [locked] = await tx
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .for("update")
    .limit(1);

  let wallet = locked;
  if (!wallet) {
    await tx
      .insert(walletsTable)
      .values({ userId, coins: 0, vPoints: 0 })
      .onConflictDoNothing({ target: walletsTable.userId });
    [wallet] = await tx
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId))
      .for("update")
      .limit(1);
  }

  const current = currency === "coins" ? wallet.coins : wallet.vPoints;
  const next = current + amount;
  if (next < 0) throw new InsufficientBalanceError(currency);

  const [updated] = await tx
    .update(walletsTable)
    .set(currency === "coins" ? { coins: next } : { vPoints: next })
    .where(eq(walletsTable.userId, userId))
    .returning();

  await tx.insert(walletTransactionsTable).values({
    userId,
    currency,
    amount,
    balanceAfter: next,
    type,
    description,
    refId,
  });

  return updated;
}

/**
 * Atomically adjust a wallet balance and append a ledger entry in its own
 * transaction. `amount` is signed: positive credits, negative debits. Debits
 * that would drive the balance below zero throw InsufficientBalanceError.
 */
export async function adjustWallet(params: AdjustParams): Promise<Wallet> {
  return db.transaction((tx) => adjustWalletTx(tx, params));
}

export { sql, and };
