import express, { type Express } from "express";
import request from "supertest";
import { eq, like } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Shared, mutable identity state used by the mocked Clerk SDK. `vi.hoisted`
// makes it available inside the (hoisted) vi.mock factory below.
const clerk = vi.hoisted(() => ({
  userId: null as string | null,
}));

// requireAuth only needs getAuth(); wallet routes never resolve emails.
vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: clerk.userId }),
  clerkClient: { users: {} },
}));

// Controllable RevenueCat behaviour. The real verification calls a paid 3rd
// party; here we decide per-test whether a reported purchase verifies.
const rc = vi.hoisted(() => ({
  verifyResult: null as null | { rcPurchaseId: string; productId: string },
  configError: false,
}));

vi.mock("../lib/revenuecat", () => {
  class RevenueCatConfigError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "RevenueCatConfigError";
    }
  }
  return {
    RevenueCatConfigError,
    verifyPurchase: async () => {
      if (rc.configError) throw new RevenueCatConfigError("unavailable");
      return rc.verifyResult;
    },
    listOwnedPurchases: async () => [],
  };
});

import {
  db,
  walletsTable,
  walletTransactionsTable,
  rechargePurchasesTable,
  userItemsTable,
  dailyTaskClaimsTable,
  storeItemsTable,
  coinPackagesTable,
  dailyTasksTable,
} from "@workspace/db";
import { WELCOME_COINS } from "../lib/wallet";
import walletRouter from "./wallet";

// Unique tag per run so cleanup only ever touches this run's rows.
const TAG = `vitest_${Date.now()}`;
const USER_A = `userA_${TAG}`;
const USER_B = `userB_${TAG}`;

/** Make subsequent requests act as the given Clerk user (or sign out with null). */
function actAs(userId: string | null): void {
  clerk.userId = userId;
}

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(walletRouter);
});

async function cleanup(): Promise<void> {
  await db
    .delete(walletTransactionsTable)
    .where(like(walletTransactionsTable.userId, `%${TAG}%`));
  await db
    .delete(rechargePurchasesTable)
    .where(like(rechargePurchasesTable.userId, `%${TAG}%`));
  await db.delete(userItemsTable).where(like(userItemsTable.userId, `%${TAG}%`));
  await db.delete(dailyTaskClaimsTable).where(like(dailyTaskClaimsTable.userId, `%${TAG}%`));
  await db.delete(walletsTable).where(like(walletsTable.userId, `%${TAG}%`));
  await db.delete(storeItemsTable).where(like(storeItemsTable.name, `%${TAG}%`));
  await db.delete(coinPackagesTable).where(like(coinPackagesTable.name, `%${TAG}%`));
  await db.delete(dailyTasksTable).where(like(dailyTasksTable.label, `%${TAG}%`));
}

beforeEach(() => {
  rc.verifyResult = null;
  rc.configError = false;
});

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

/** Read a wallet's coin balance directly from the DB (0 if no row). */
async function coinsOf(userId: string): Promise<number> {
  const [w] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .limit(1);
  return w?.coins ?? 0;
}

describe("wallet authentication", () => {
  it("rejects unauthenticated wallet access with 401", async () => {
    actAs(null);
    await request(app).get(`/wallet/${USER_A}`).expect(401);
    await request(app).post(`/wallet/${USER_A}/ensure`).expect(401);
    await request(app).get(`/wallet/${USER_A}/transactions`).expect(401);
    await request(app)
      .post(`/wallet/${USER_A}/recharge`)
      .send({ packageId: 1, rcPurchaseId: "x" })
      .expect(401);
    await request(app)
      .post(`/wallet/${USER_A}/purchase`)
      .send({ itemId: 1 })
      .expect(401);
    await request(app)
      .post(`/wallet/${USER_A}/claim-task`)
      .send({ taskId: 1 })
      .expect(401);
  });
});

describe("wallet cross-user isolation", () => {
  it("blocks user B from touching user A's wallet with 403", async () => {
    actAs(USER_B);
    await request(app).get(`/wallet/${USER_A}`).expect(403);
    await request(app).post(`/wallet/${USER_A}/ensure`).expect(403);
    await request(app).get(`/wallet/${USER_A}/transactions`).expect(403);
    await request(app).get(`/wallet/${USER_A}/items`).expect(403);
    await request(app).get(`/wallet/${USER_A}/task-claims`).expect(403);
    await request(app)
      .post(`/wallet/${USER_A}/recharge`)
      .send({ packageId: 1, rcPurchaseId: "x" })
      .expect(403);
    await request(app)
      .post(`/wallet/${USER_A}/recharge/reconcile`)
      .expect(403);
    await request(app)
      .post(`/wallet/${USER_A}/purchase`)
      .send({ itemId: 1 })
      .expect(403);
    await request(app)
      .post(`/wallet/${USER_A}/claim-task`)
      .send({ taskId: 1 })
      .expect(403);
    await request(app)
      .post(`/wallet/${USER_A}/equip`)
      .send({ itemId: 1 })
      .expect(403);
  });

  it("does not create user A's wallet when user B probes it", async () => {
    actAs(USER_B);
    await request(app).post(`/wallet/${USER_A}/ensure`).expect(403);
    const [row] = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, USER_A))
      .limit(1);
    expect(row).toBeUndefined();
  });
});

describe("wallet welcome balance", () => {
  it("grants exactly the fixed welcome balance and ignores client-supplied amounts", async () => {
    actAs(USER_A);
    const res = await request(app)
      .post(`/wallet/${USER_A}/ensure`)
      // Client tries to seed an inflated opening balance — must be ignored.
      .send({ coins: 999999, vPoints: 999999 })
      .expect(200);
    expect(res.body.coins).toBe(WELCOME_COINS);
    expect(res.body.vPoints).toBe(0);
  });

  it("is idempotent: re-ensuring never re-credits the welcome balance", async () => {
    actAs(USER_A);
    await request(app).post(`/wallet/${USER_A}/ensure`).expect(200);
    const res = await request(app)
      .post(`/wallet/${USER_A}/ensure`)
      .send({ coins: 5000 })
      .expect(200);
    expect(res.body.coins).toBe(WELCOME_COINS);
    expect(await coinsOf(USER_A)).toBe(WELCOME_COINS);
  });
});

describe("claim-task money movement", () => {
  it("credits exactly the task reward and refuses a second claim the same day", async () => {
    const [task] = await db
      .insert(dailyTasksTable)
      .values({ label: `Task ${TAG}`, reward: 150, active: true })
      .returning();

    actAs(USER_A);
    await request(app).post(`/wallet/${USER_A}/ensure`).expect(200);

    const first = await request(app)
      .post(`/wallet/${USER_A}/claim-task`)
      .send({ taskId: task.id })
      .expect(200);
    expect(first.body.coins).toBe(WELCOME_COINS + 150);

    // Same-day re-claim is rejected and does not credit again.
    await request(app)
      .post(`/wallet/${USER_A}/claim-task`)
      .send({ taskId: task.id })
      .expect(400);
    expect(await coinsOf(USER_A)).toBe(WELCOME_COINS + 150);
  });

  it("rejects claiming an inactive task and credits nothing", async () => {
    const [task] = await db
      .insert(dailyTasksTable)
      .values({ label: `Task ${TAG}`, reward: 500, active: false })
      .returning();

    actAs(USER_A);
    await request(app).post(`/wallet/${USER_A}/ensure`).expect(200);
    await request(app)
      .post(`/wallet/${USER_A}/claim-task`)
      .send({ taskId: task.id })
      .expect(404);
    expect(await coinsOf(USER_A)).toBe(WELCOME_COINS);
  });
});

describe("purchase money movement", () => {
  it("debits exactly the item price and grants ownership once", async () => {
    const [item] = await db
      .insert(storeItemsTable)
      .values({ name: `Frame ${TAG}`, category: "إطارات", price: 300, currency: "coins", active: true })
      .returning();

    actAs(USER_A);
    await request(app).post(`/wallet/${USER_A}/ensure`).expect(200);

    const res = await request(app)
      .post(`/wallet/${USER_A}/purchase`)
      .send({ itemId: item.id })
      .expect(200);
    expect(res.body.wallet.coins).toBe(WELCOME_COINS - 300);

    // Buying the same item again is rejected and never double-charges.
    await request(app)
      .post(`/wallet/${USER_A}/purchase`)
      .send({ itemId: item.id })
      .expect(400);
    expect(await coinsOf(USER_A)).toBe(WELCOME_COINS - 300);
  });

  it("refuses a purchase the wallet cannot afford and charges nothing", async () => {
    const [item] = await db
      .insert(storeItemsTable)
      .values({
        name: `Frame ${TAG}`,
        category: "إطارات",
        price: WELCOME_COINS + 1,
        currency: "coins",
        active: true,
      })
      .returning();

    actAs(USER_A);
    await request(app).post(`/wallet/${USER_A}/ensure`).expect(200);
    await request(app)
      .post(`/wallet/${USER_A}/purchase`)
      .send({ itemId: item.id })
      .expect(400);
    expect(await coinsOf(USER_A)).toBe(WELCOME_COINS);

    // Ownership must not have been granted on a failed purchase.
    const owned = await db
      .select()
      .from(userItemsTable)
      .where(eq(userItemsTable.userId, USER_A));
    expect(owned).toHaveLength(0);
  });
});

describe("recharge money movement", () => {
  async function seedPackage(): Promise<{ id: number; total: number }> {
    const [pkg] = await db
      .insert(coinPackagesTable)
      .values({
        name: `Pack ${TAG}`,
        coins: 1000,
        bonus: 200,
        productId: `prod_${TAG}`,
        active: true,
      })
      .returning();
    return { id: pkg.id, total: pkg.coins + pkg.bonus };
  }

  it("credits nothing when the purchase cannot be verified", async () => {
    const pkg = await seedPackage();
    rc.verifyResult = null; // verification fails

    actAs(USER_A);
    await request(app).post(`/wallet/${USER_A}/ensure`).expect(200);
    await request(app)
      .post(`/wallet/${USER_A}/recharge`)
      .send({ packageId: pkg.id, rcPurchaseId: `rc_${TAG}_1` })
      .expect(402);

    expect(await coinsOf(USER_A)).toBe(WELCOME_COINS);
    const redemptions = await db
      .select()
      .from(rechargePurchasesTable)
      .where(eq(rechargePurchasesTable.userId, USER_A));
    expect(redemptions).toHaveLength(0);
  });

  it("credits the package total once for a verified purchase and never twice on replay", async () => {
    const pkg = await seedPackage();
    const rcPurchaseId = `rc_${TAG}_2`;
    rc.verifyResult = { rcPurchaseId, productId: `prod_${TAG}` };

    actAs(USER_A);
    await request(app).post(`/wallet/${USER_A}/ensure`).expect(200);

    const first = await request(app)
      .post(`/wallet/${USER_A}/recharge`)
      .send({ packageId: pkg.id, rcPurchaseId })
      .expect(200);
    expect(first.body.coins).toBe(WELCOME_COINS + pkg.total);

    // Replaying the exact same purchase id must not credit again.
    const replay = await request(app)
      .post(`/wallet/${USER_A}/recharge`)
      .send({ packageId: pkg.id, rcPurchaseId })
      .expect(200);
    expect(replay.body.coins).toBe(WELCOME_COINS + pkg.total);
    expect(await coinsOf(USER_A)).toBe(WELCOME_COINS + pkg.total);
  });
});
