import express, { type Express } from "express";
import request from "supertest";
import { like, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({
  userId: null as string | null,
}));

vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: clerk.userId }),
  clerkClient: {
    users: {
      getUser: async () => {
        throw new Error("not needed");
      },
      getUserList: async () => ({ data: [] }),
    },
  },
}));

import { db, followsTable, walletsTable, walletTransactionsTable } from "@workspace/db";
import {
  adjustWallet,
  costOfLevel,
  levelForXp,
  levelProgress,
  xpGainFor,
  LEVEL_ONE_COST,
} from "../lib/wallet";
import followsRouter from "./follows";
import walletRouter from "./wallet";

const TAG = `vitest_${Date.now()}`;
const ALICE = `user_fl_alice_${TAG}`;
const BOB = `user_fl_bob_${TAG}`;

function actAs(userId: string | null): void {
  clerk.userId = userId;
}

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(followsRouter);
  app.use(walletRouter);
});

async function cleanup(): Promise<void> {
  await db
    .delete(followsTable)
    .where(
      or(like(followsTable.followerId, `%${TAG}%`), like(followsTable.followedId, `%${TAG}%`)),
    );
  await db.delete(walletTransactionsTable).where(like(walletTransactionsTable.userId, `%${TAG}%`));
  await db.delete(walletsTable).where(like(walletsTable.userId, `%${TAG}%`));
}

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("follow relationships", () => {
  it("requires authentication", async () => {
    actAs(null);
    await request(app).post("/follow").send({ targetUserId: BOB }).expect(401);
    await request(app).delete(`/follow/${BOB}`).expect(401);
    await request(app).get(`/follow/stats/${BOB}`).expect(401);
  });

  it("refuses following yourself", async () => {
    actAs(ALICE);
    await request(app).post("/follow").send({ targetUserId: ALICE }).expect(400);
  });

  it("follows and unfollows idempotently with correct counts", async () => {
    actAs(ALICE);
    const first = await request(app).post("/follow").send({ targetUserId: BOB }).expect(200);
    expect(first.body).toMatchObject({ userId: BOB, followers: 1, isFollowedByMe: true });

    // Following again does not double-count.
    const second = await request(app).post("/follow").send({ targetUserId: BOB }).expect(200);
    expect(second.body.followers).toBe(1);

    // Bob sees one follower and is not following Alice.
    actAs(BOB);
    const bobStats = await request(app).get(`/follow/stats/${BOB}`).expect(200);
    expect(bobStats.body).toMatchObject({ followers: 1, following: 0, isFollowedByMe: false });
    const aliceStats = await request(app).get(`/follow/stats/${ALICE}`).expect(200);
    expect(aliceStats.body).toMatchObject({ followers: 0, following: 1 });

    actAs(ALICE);
    const removed = await request(app).delete(`/follow/${BOB}`).expect(200);
    expect(removed.body).toMatchObject({ followers: 0, isFollowedByMe: false });
  });
});

describe("XP and level", () => {
  it("starts a new account at level 0, not 1", () => {
    // An untouched account showing level 1 makes the first real level
    // worthless. The reference app shows a fresh profile as level 0.
    expect(levelForXp(0)).toBe(0);
    expect(levelForXp(2_999)).toBe(0);
  });

  it("costs 3,000 spent coins to reach level 1", () => {
    expect(levelForXp(LEVEL_ONE_COST)).toBe(1);
    expect(costOfLevel(1)).toBe(3_000);
    // The old curve reached level 3 on 400 XP, so a single daily reward moved
    // someone two levels and the number meant nothing.
    expect(levelForXp(400)).toBe(0);
  });

  it("grows steeply enough that high levels stay rare", () => {
    expect(costOfLevel(10)).toBe(300_000);
    expect(costOfLevel(50)).toBe(7_500_000);
    // Levels are strictly increasing in cost.
    for (let n = 1; n < 50; n++) {
      expect(costOfLevel(n + 1)).toBeGreaterThan(costOfLevel(n));
    }
  });

  it("caps rather than running away on an absurd balance", () => {
    expect(levelForXp(1_000_000_000)).toBe(50);
  });

  it("counts spending, and only spending", () => {
    expect(xpGainFor("gift_sent", -500)).toBe(500);
    expect(xpGainFor("purchase", -250)).toBe(250);

    // Buying coins is not spending them; free coins are not spending at all.
    // Both used to grant XP, which is why a new account levelled up without
    // ever paying for anything.
    expect(xpGainFor("recharge", 1000)).toBe(0);
    expect(xpGainFor("task_reward", 100)).toBe(0);

    expect(xpGainFor("adjust", 99999)).toBe(0);
    expect(xpGainFor("adjust", -99999)).toBe(0);
    expect(xpGainFor("gift_received", 500)).toBe(0);

    // Cosmetics bought with earned diamonds are not real spending.
    expect(xpGainFor("purchase", -250, "V")).toBe(0);
  });

  it("reports progress toward the next level", () => {
    const p = levelProgress(5_000);
    expect(p.level).toBe(1);
    expect(p.current).toBe(5_000);
    expect(p.nextAt).toBe(12_000);
  });

  it("accumulates XP in the wallet and reports the level", async () => {
    actAs(ALICE);
    await request(app).post(`/wallet/${ALICE}/ensure`).expect(200);
    // Topping up 5,000 coins moves nothing: buying coins is not spending.
    await adjustWallet({ userId: ALICE, currency: "coins", amount: 5_000, type: "recharge" });
    const afterRecharge = await request(app).get(`/wallet/${ALICE}`).expect(200);
    expect(afterRecharge.body.xp).toBe(0);
    expect(afterRecharge.body.level).toBe(0);

    // Giving 3,000 of them away does.
    await adjustWallet({ userId: ALICE, currency: "coins", amount: -3_000, type: "gift_sent" });
    const afterGift = await request(app).get(`/wallet/${ALICE}`).expect(200);
    expect(afterGift.body.xp).toBe(3_000);
    expect(afterGift.body.level).toBe(1);
  });
});
