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
import { adjustWallet, levelForXp, xpGainFor } from "../lib/wallet";
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
  it("derives levels from XP with the documented thresholds", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(400)).toBe(3);
    expect(levelForXp(1_000_000_000)).toBe(99);
  });

  it("awards XP only for real economic activity", () => {
    expect(xpGainFor("gift_sent", -500)).toBe(500);
    expect(xpGainFor("recharge", 1000)).toBe(1000);
    expect(xpGainFor("task_reward", 100)).toBe(100);
    expect(xpGainFor("purchase", -250)).toBe(250);
    expect(xpGainFor("adjust", 99999)).toBe(0);
    expect(xpGainFor("gift_received", 500)).toBe(0);
  });

  it("accumulates XP in the wallet and reports the level", async () => {
    actAs(ALICE);
    await request(app).post(`/wallet/${ALICE}/ensure`).expect(200);
    // 400 XP => level 3.
    await adjustWallet({ userId: ALICE, currency: "coins", amount: 300, type: "recharge" });
    await adjustWallet({ userId: ALICE, currency: "coins", amount: -100, type: "gift_sent" });

    const wallet = await request(app).get(`/wallet/${ALICE}`).expect(200);
    expect(wallet.body.xp).toBe(400);
    expect(wallet.body.level).toBe(3);
  });
});
