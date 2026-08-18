import express, { type Express } from "express";
import request from "supertest";
import { like, or, eq } from "drizzle-orm";
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

import {
  db,
  referralsTable,
  hostsTable,
  hostSessionsTable,
  roomEventsTable,
  roomsTable,
  pushTokensTable,
  profilesTable,
  walletsTable,
  walletTransactionsTable,
} from "@workspace/db";
import { ensureWallet, giftEarnings, GIFT_RECIPIENT_SHARE } from "../lib/wallet";
import growthRouter, { REFERRER_REWARD, REFERRED_REWARD } from "./growth";
import walletRouter from "./wallet";

const TAG = `vitest_${Date.now()}`;
const ALICE = `user_gr_alice_${TAG}`;
const BOB = `user_gr_bob_${TAG}`;
const OWNER = `user_gr_owner_${TAG}`;
const OWNER_EMAIL = `owner-${TAG}@test.local`;

function actAs(userId: string | null): void {
  clerk.userId = userId;
}

let app: Express;
let originalAdminEmails: string | undefined;
let roomId: number;

beforeAll(async () => {
  originalAdminEmails = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = OWNER_EMAIL;
  clerk.emailByUserId.set(OWNER, OWNER_EMAIL);
  clerk.userIdByEmail.set(OWNER_EMAIL, OWNER);

  app = express();
  app.use(express.json());
  app.use(growthRouter);
  app.use(walletRouter);

  const [room] = await db
    .insert(roomsTable)
    .values({ name: `Room ${TAG}`, ownerId: `owner_${TAG}`, active: true })
    .returning();
  roomId = room.id;
});

async function cleanup(): Promise<void> {
  await db
    .delete(referralsTable)
    .where(or(like(referralsTable.referrerId, `%${TAG}%`), like(referralsTable.referredId, `%${TAG}%`)));
  await db.delete(hostSessionsTable).where(like(hostSessionsTable.userId, `%${TAG}%`));
  await db.delete(hostsTable).where(like(hostsTable.userId, `%${TAG}%`));
  await db.delete(pushTokensTable).where(like(pushTokensTable.userId, `%${TAG}%`));
  await db.delete(profilesTable).where(like(profilesTable.userId, `%${TAG}%`));
  await db.delete(walletTransactionsTable).where(like(walletTransactionsTable.userId, `%${TAG}%`));
  await db.delete(walletsTable).where(like(walletsTable.userId, `%${TAG}%`));
}

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.delete(roomEventsTable).where(eq(roomEventsTable.roomId, roomId));
  await db.delete(roomsTable).where(eq(roomsTable.id, roomId));
  if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe("invite rewards", () => {
  it("requires authentication", async () => {
    actAs(null);
    await request(app).get("/referrals/me").expect(401);
    await request(app).post("/referrals/claim").send({ code: "12345678" }).expect(401);
  });

  it("hands out my public account id as the invite code", async () => {
    actAs(ALICE);
    const res = await request(app).get("/referrals/me").expect(200);
    expect(res.body.code).toMatch(/^\d{8}$/);
    expect(res.body.invitedCount).toBe(0);
    expect(res.body.hasClaimed).toBe(false);
  });

  it("rejects an unknown code and my own code", async () => {
    actAs(ALICE);
    const mine = await request(app).get("/referrals/me").expect(200);
    await request(app).post("/referrals/claim").send({ code: "00000001" }).expect(400);
    await request(app).post("/referrals/claim").send({ code: mine.body.code }).expect(400);
  });

  it("credits both sides once, and refuses a second claim", async () => {
    actAs(ALICE);
    const alice = await request(app).get("/referrals/me").expect(200);
    const aliceBefore = await request(app).get(`/wallet/${ALICE}`).expect(200);

    actAs(BOB);
    const bobBefore = await request(app).get(`/wallet/${BOB}`).expect(200);
    const claimed = await request(app)
      .post("/referrals/claim")
      .send({ code: alice.body.code })
      .expect(200);
    expect(claimed.body.hasClaimed).toBe(true);

    const bobAfter = await request(app).get(`/wallet/${BOB}`).expect(200);
    expect(bobAfter.body.coins).toBe(bobBefore.body.coins + REFERRED_REWARD);

    actAs(ALICE);
    const aliceAfter = await request(app).get(`/wallet/${ALICE}`).expect(200);
    expect(aliceAfter.body.coins).toBe(aliceBefore.body.coins + REFERRER_REWARD);
    const aliceStatus = await request(app).get("/referrals/me").expect(200);
    expect(aliceStatus.body.invitedCount).toBe(1);

    // A second claim must not pay again.
    actAs(BOB);
    await request(app).post("/referrals/claim").send({ code: alice.body.code }).expect(400);
    const bobFinal = await request(app).get(`/wallet/${BOB}`).expect(200);
    expect(bobFinal.body.coins).toBe(bobAfter.body.coins);
  });
});

describe("gift earnings", () => {
  it("gives the recipient the documented share, plus any host bonus", () => {
    expect(GIFT_RECIPIENT_SHARE).toBe(0.3);
    expect(giftEarnings(1000)).toBe(300);
    expect(giftEarnings(1000, 20)).toBe(500);
    expect(giftEarnings(10)).toBe(3);
    // Never negative, never rewards a nonsense bonus.
    expect(giftEarnings(100, -50)).toBe(30);
  });
});

describe("paid hosts", () => {
  it("is admin-only", async () => {
    actAs(ALICE);
    await request(app).get("/hosts").expect(403);
    await request(app).post("/hosts").send({ publicId: "123" }).expect(403);
    await request(app).delete(`/hosts/${ALICE}`).expect(403);
  });

  it("grants and revokes host status by public account id", async () => {
    const wallet = await ensureWallet(BOB);
    await db.insert(profilesTable).values({ userId: BOB, name: `Bob ${TAG}` });

    actAs(OWNER);
    const created = await request(app)
      .post("/hosts")
      .send({ publicId: wallet.publicId, bonusSharePercent: 10 })
      .expect(201);
    expect(created.body.userId).toBe(BOB);
    expect(created.body.bonusSharePercent).toBe(10);

    // The profile mirrors the badge for cheap list rendering.
    const [profile] = await db
      .select({ isHost: profilesTable.isHost })
      .from(profilesTable)
      .where(eq(profilesTable.userId, BOB))
      .limit(1);
    expect(profile.isHost).toBe(true);

    // Duplicates are refused.
    await request(app).post("/hosts").send({ publicId: wallet.publicId }).expect(400);

    const listed = await request(app).get("/hosts").expect(200);
    expect(listed.body.some((h: { userId: string }) => h.userId === BOB)).toBe(true);

    await request(app).delete(`/hosts/${BOB}`).expect(204);
    await request(app).delete(`/hosts/${BOB}`).expect(404);
  });

  it("rejects an unknown account id", async () => {
    actAs(OWNER);
    await request(app).post("/hosts").send({ publicId: "99999999" }).expect(400);
  });

  it("totals tracked minutes into weekly and lifetime hours", async () => {
    const wallet = await ensureWallet(BOB);
    await db.insert(profilesTable).values({ userId: BOB, name: `Bob ${TAG}` });
    actAs(OWNER);
    await request(app).post("/hosts").send({ publicId: wallet.publicId }).expect(201);

    const now = new Date();
    const longAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    await db.insert(hostSessionsTable).values([
      { userId: BOB, roomId: "r1", startedAt: now, endedAt: now, minutes: 45 },
      { userId: BOB, roomId: "r1", startedAt: longAgo, endedAt: longAgo, minutes: 120 },
    ]);

    const listed = await request(app).get("/hosts").expect(200);
    const bob = listed.body.find((h: { userId: string }) => h.userId === BOB);
    expect(bob.minutesTotal).toBe(165);
    expect(bob.minutesThisWeek).toBe(45);
  });
});

describe("scheduled sessions", () => {
  it("lists publicly but only admins can schedule", async () => {
    actAs(null);
    await request(app).get("/room-events").expect(200);
    actAs(ALICE);
    await request(app)
      .post("/room-events")
      .send({ roomId, title: "x", startsAt: new Date().toISOString() })
      .expect(403);
  });

  it("creates an upcoming session and cancels it", async () => {
    actAs(OWNER);
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const created = await request(app)
      .post("/room-events")
      .send({ roomId, title: `سهرة ${TAG}`, startsAt: soon, weekday: 4 })
      .expect(201);
    expect(created.body.roomName).toBe(`Room ${TAG}`);

    const listed = await request(app).get("/room-events").expect(200);
    expect(listed.body.some((e: { id: number }) => e.id === created.body.id)).toBe(true);

    await request(app).delete(`/room-events/${created.body.id}`).expect(204);
    await request(app).delete(`/room-events/${created.body.id}`).expect(404);
  });

  it("refuses an unknown room or a bad date", async () => {
    actAs(OWNER);
    await request(app)
      .post("/room-events")
      .send({ roomId: 999999, title: "x", startsAt: new Date().toISOString() })
      .expect(400);
    await request(app)
      .post("/room-events")
      .send({ roomId, title: "x", startsAt: "not-a-date" })
      .expect(400);
  });
});

describe("push registration", () => {
  it("requires authentication", async () => {
    actAs(null);
    await request(app).post("/push/register").send({ token: "ExponentPushToken[x]" }).expect(401);
  });

  it("stores a token and moves it when another account registers it", async () => {
    const token = `ExponentPushToken[${TAG}]`;
    actAs(ALICE);
    await request(app).post("/push/register").send({ token, platform: "android" }).expect(204);
    // Re-registering is idempotent, not a duplicate row.
    await request(app).post("/push/register").send({ token, platform: "android" }).expect(204);

    actAs(BOB);
    await request(app).post("/push/register").send({ token, platform: "ios" }).expect(204);

    const rows = await db
      .select()
      .from(pushTokensTable)
      .where(eq(pushTokensTable.token, token));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(BOB);
  });
});
