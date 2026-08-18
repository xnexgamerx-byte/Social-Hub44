import { and, eq, isNull, sql } from "drizzle-orm";
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
  publicId: string;
  coins: number;
  vPoints: number;
  vipLevel: number;
  vipType: string;
  xp: number;
  level: number;
}

/**
 * User level derived from lifetime XP: level n needs (n-1)^2 * 100 XP, capped
 * at 99. Level is always computed server-side from the stored XP.
 */
export function levelForXp(xp: number): number {
  if (xp <= 0) return 1;
  return Math.min(99, Math.floor(Math.sqrt(xp / 100)) + 1);
}

/**
 * XP granted for a ledger entry. Only real economic activity earns XP:
 * recharges, gift sends, store purchases and task rewards — one XP per unit
 * of currency moved. Manual admin adjustments earn nothing.
 */
export function xpGainFor(type: TxType, amount: number): number {
  switch (type) {
    case "recharge":
    case "gift_sent":
    case "purchase":
    case "task_reward":
      return Math.abs(amount);
    default:
      return 0;
  }
}

export function toWalletView(w: Wallet): WalletView {
  return {
    userId: w.userId,
    publicId: w.publicId ?? "",
    coins: w.coins,
    vPoints: w.vPoints,
    vipLevel: w.vipLevel,
    vipType: w.vipType,
    xp: w.xp,
    level: levelForXp(w.xp),
  };
}

/** Generate a random 8-digit public account id (10000000–99999999). */
function generatePublicId(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err != null &&
    (err as { code?: string }).code === "23505"
  );
}

/**
 * Assign a unique publicId to a wallet that does not have one yet (newly
 * created rows, or rows from before publicId existed). Retries on the rare
 * collision against the unique constraint.
 */
async function assignPublicId(userId: string): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await db
        .update(walletsTable)
        .set({ publicId: generatePublicId() })
        .where(and(eq(walletsTable.userId, userId), isNull(walletsTable.publicId)));
      return;
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 5) continue;
      throw err;
    }
  }
}

/**
 * Fixed, server-controlled welcome balance granted exactly once, when a user's
 * wallet is first created. Clients can NEVER influence the starting balance —
 * this is the only place a wallet's opening balance is defined, which prevents
 * an authenticated user from minting funds by seeding their own balance.
 */
export const WELCOME_COINS = 2000;
export const WELCOME_VPOINTS = 0;

/**
 * Share of a gift's coin value credited to the recipient as vPoints. This is
 * the earning side of the economy — coins are bought, vPoints are earned and
 * spent on cosmetics — and it is how paid hosts make money from a room.
 */
export const GIFT_RECIPIENT_SHARE = 0.3;

/** vPoints a recipient earns from a gift, with an optional host bonus. */
export function giftEarnings(price: number, bonusPercent = 0): number {
  const share = GIFT_RECIPIENT_SHARE + Math.max(0, bonusPercent) / 100;
  return Math.floor(price * share);
}

/**
 * Ensure a wallet row exists for the user. On first creation it is seeded with
 * the fixed WELCOME_* balance above. If the wallet already exists, its balances
 * are left untouched (first-write-wins via onConflictDoNothing).
 */
export async function ensureWallet(userId: string): Promise<Wallet> {
  await db
    .insert(walletsTable)
    .values({
      userId,
      publicId: generatePublicId(),
      coins: WELCOME_COINS,
      vPoints: WELCOME_VPOINTS,
    })
    .onConflictDoNothing({ target: walletsTable.userId });

  let [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .limit(1);

  // Backfill a publicId for legacy rows created before the column existed.
  if (wallet && !wallet.publicId) {
    await assignPublicId(userId);
    [wallet] = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId))
      .limit(1);
  }

  return wallet;
}

/** Look up a wallet by its public account id (null when not found). */
export async function getWalletByPublicId(
  publicId: string,
): Promise<Wallet | null> {
  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.publicId, publicId))
    .limit(1);
  return wallet ?? null;
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

  const xpGain = xpGainFor(type, amount);
  const [updated] = await tx
    .update(walletsTable)
    .set({
      ...(currency === "coins" ? { coins: next } : { vPoints: next }),
      ...(xpGain > 0 ? { xp: wallet.xp + xpGain } : {}),
    })
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
