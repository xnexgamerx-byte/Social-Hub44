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
 * Coins that must be *spent* to reach level 1, taken from the reference app,
 * where the first level reads "0 / 3000".
 *
 * The old curve needed 100 XP for level 2, so a single task reward pushed a
 * brand new account up a level and levels meant nothing.
 */
export const LEVEL_ONE_COST = 3_000;
/**
 * Growth exponent. 2 gives level n at 3,000 x n^2 — level 10 at 300k spent,
 * level 50 at 7.5M. Only the level-1 anchor comes from the reference app; the
 * curve past it is a design choice, and this constant is where to tune it.
 */
const LEVEL_EXPONENT = 2;
const MAX_LEVEL = 50;

/** Coins that must have been spent to hold a given level. */
export function costOfLevel(level: number): number {
  if (level <= 0) return 0;
  return Math.round(LEVEL_ONE_COST * Math.pow(level, LEVEL_EXPONENT));
}

/**
 * Level from lifetime spending.
 *
 * Starts at 0, not 1: a new account has spent nothing and the reference app
 * shows it as level 0. Presenting an untouched account as level 1 makes the
 * first real level worth nothing.
 */
export function levelForXp(xp: number): number {
  if (xp < LEVEL_ONE_COST) return 0;
  const level = Math.floor(Math.pow(xp / LEVEL_ONE_COST, 1 / LEVEL_EXPONENT));
  return Math.min(MAX_LEVEL, level);
}

/** Coins still needed for the next level, and where this level began. */
export function levelProgress(xp: number): {
  level: number;
  current: number;
  nextAt: number;
} {
  const level = levelForXp(xp);
  return {
    level,
    current: Math.max(0, xp),
    nextAt: level >= MAX_LEVEL ? costOfLevel(MAX_LEVEL) : costOfLevel(level + 1),
  };
}

/**
 * XP granted for a ledger entry — which is to say, coins *spent*.
 *
 * The reference app is explicit that the level tracks spending, not wealth:
 * gifts sent and store purchases count, while buying coins does not, and
 * neither do free coins from tasks. That distinction is the whole point —
 * otherwise a user levels up by claiming daily rewards without ever spending
 * anything, which is what was happening here.
 *
 * An allowlist rather than a denylist: any spend type added later earns
 * nothing until someone deliberately includes it. Game spending is excluded
 * by the reference rules and stays excluded by default.
 */
const LEVELLING_TYPES = new Set<TxType>(["gift_sent", "purchase"]);

export function xpGainFor(type: TxType, amount: number, currency: Currency = "coins"): number {
  // Cosmetics bought with earned diamonds are not spending real money.
  if (currency !== "coins") return 0;
  // Credits are not spending; only a debit moves the level.
  if (amount >= 0) return 0;
  if (!LEVELLING_TYPES.has(type)) return 0;
  return -amount;
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

  const xpGain = xpGainFor(type, amount, currency);
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
