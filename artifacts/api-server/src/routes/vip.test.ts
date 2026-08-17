import express, { type Express } from "express";
import request from "supertest";
import { like } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({
  userId: null as string | null,
  emailByUserId: new Map<string, string>(),
  userIdByEmail: new Map<string, string>(),
}));

vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: clerk.userId }),
  clerkClient: {
    users: {
      getUser: async (userId: string) => {
        const email = clerk.emailByUserId.get(userId);
        if (!email) throw new Error("user not found");
        return {
          primaryEmailAddressId: "e1",
          emailAddresses: [{ id: "e1", emailAddress: email }],
        };
      },
      getUserList: async () => ({ data: [] }),
    },
  },
}));

import { db, vipTiersTable, walletsTable, walletTransactionsTable } from "@workspace/db";
import { adjustWallet } from "../lib/wallet";
import walletRouter from "./wallet";

const TAG = `vitest_${Date.now()}`;
const ALICE = `user_vip_alice_${TAG}`;
const BOB = `user_vip_bob_${TAG}`;
// A level unlikely to collide with the seeded 1..16 tiers.
const TIER_LEVEL = 97;
const TIER_POINTS = 5_000;

function actAs(userId: string | null): void {
  clerk.userId = userId;
}

let app: Express;

beforeAll(async () => {
  for (const uid of [ALICE, BOB]) {
    clerk.emailByUserId.set(uid, `${uid}@test.local`);
  }
  app = express();
  app.use(express.json());
  app.use(walletRouter);

  await db.insert(vipTiersTable).values({
    level: TIER_LEVEL,
    type: "vip",
    pointsRequired: TIER_POINTS,
    color: `#000 ${TAG}`,
    features: [],
    active: true,
  });
});

async function cleanup(): Promise<void> {
  await db.delete(walletTransactionsTable).where(like(walletTransactionsTable.userId, `%${TAG}%`));
  await db.delete(walletsTable).where(like(walletsTable.userId, `%${TAG}%`));
}

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.delete(vipTiersTable).where(like(vipTiersTable.color, `%${TAG}%`));
});

describe("VIP activation", () => {
  it("rejects unauthenticated activation with 401", async () => {
    actAs(null);
    await request(app)
      .post(`/wallet/${ALICE}/vip`)
      .send({ level: TIER_LEVEL, type: "vip" })
      .expect(401);
  });

  it("rejects activating another user's VIP with 403", async () => {
    actAs(ALICE);
    await request(app)
      .post(`/wallet/${BOB}/vip`)
      .send({ level: TIER_LEVEL, type: "vip" })
      .expect(403);
  });

  it("returns 404 for a tier that does not exist", async () => {
    actAs(ALICE);
    await request(app)
      .post(`/wallet/${ALICE}/vip`)
      .send({ level: 9999, type: "vip" })
      .expect(404);
  });

  it("refuses activation when vPoints are below the tier requirement", async () => {
    actAs(ALICE);
    const res = await request(app)
      .post(`/wallet/${ALICE}/vip`)
      .send({ level: TIER_LEVEL, type: "vip" })
      .expect(400);
    expect(res.body.error).toBeTruthy();

    // The wallet must remain without VIP.
    const wallet = await request(app).get(`/wallet/${ALICE}`).expect(200);
    expect(wallet.body.vipLevel).toBe(0);
    expect(wallet.body.vipType).toBe("");
  });

  it("activates the tier once the wallet has enough vPoints", async () => {
    actAs(ALICE);
    // Create the wallet, then credit enough V server-side.
    await request(app).post(`/wallet/${ALICE}/ensure`).expect(200);
    await adjustWallet({
      userId: ALICE,
      currency: "V",
      amount: TIER_POINTS,
      type: "adjust",
      description: "test grant",
    });

    const res = await request(app)
      .post(`/wallet/${ALICE}/vip`)
      .send({ level: TIER_LEVEL, type: "vip" })
      .expect(200);
    expect(res.body.vipLevel).toBe(TIER_LEVEL);
    expect(res.body.vipType).toBe("vip");

    // Activation is a status change, not a spend: vPoints stay untouched.
    expect(res.body.vPoints).toBe(TIER_POINTS);
  });
});
