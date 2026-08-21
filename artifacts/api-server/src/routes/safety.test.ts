import express, { type Express } from "express";
import request from "supertest";
import { eq, like, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({
  userId: null as string | null,
  emailByUserId: new Map<string, string>(),
  userIdByEmail: new Map<string, string>(),
  deleted: [] as string[],
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
      deleteUser: async (userId: string) => {
        clerk.deleted.push(userId);
      },
    },
  },
}));

import {
  db,
  blocksTable,
  reportsTable,
  bansTable,
  roomKicksTable,
  profilesTable,
  postsTable,
  roomsTable,
  walletsTable,
  walletTransactionsTable,
} from "@workspace/db";
import { ensureWallet } from "../lib/wallet";
import { sendDm } from "../lib/dm";
import { activeBan, isBlockedBetween, isKickedFromRoom } from "../lib/safety";
import safetyRouter from "./safety";
import profilesRouter from "./profiles";

const TAG = `vitest_${Date.now()}`;
const ALICE = `user_sf_alice_${TAG}`;
const BOB = `user_sf_bob_${TAG}`;
const OWNER = `user_sf_owner_${TAG}`;
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
  app.use(safetyRouter);
  app.use(profilesRouter);

  const [room] = await db
    .insert(roomsTable)
    .values({ name: `Room ${TAG}`, ownerId: ALICE, active: true })
    .returning();
  roomId = room.id;
});

async function cleanup(): Promise<void> {
  await db
    .delete(blocksTable)
    .where(or(like(blocksTable.blockerId, `%${TAG}%`), like(blocksTable.blockedId, `%${TAG}%`)));
  await db.delete(reportsTable).where(like(reportsTable.reporterId, `%${TAG}%`));
  await db.delete(bansTable).where(like(bansTable.userId, `%${TAG}%`));
  await db.delete(roomKicksTable).where(like(roomKicksTable.userId, `%${TAG}%`));
  await db.delete(postsTable).where(like(postsTable.userId, `%${TAG}%`));
  await db.delete(profilesTable).where(like(profilesTable.userId, `%${TAG}%`));
  await db.delete(walletTransactionsTable).where(like(walletTransactionsTable.userId, `%${TAG}%`));
  await db.delete(walletsTable).where(like(walletsTable.userId, `%${TAG}%`));
  clerk.deleted.length = 0;
}

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.delete(roomsTable).where(eq(roomsTable.id, roomId));
  if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe("blocking", () => {
  it("requires authentication", async () => {
    actAs(null);
    await request(app).get("/blocks").expect(401);
    await request(app).post("/blocks").send({ targetUserId: BOB }).expect(401);
  });

  it("refuses self-blocking", async () => {
    actAs(ALICE);
    await request(app).post("/blocks").send({ targetUserId: ALICE }).expect(400);
  });

  it("blocks idempotently and lists the block", async () => {
    actAs(ALICE);
    await request(app).post("/blocks").send({ targetUserId: BOB }).expect(204);
    await request(app).post("/blocks").send({ targetUserId: BOB }).expect(204);

    const listed = await request(app).get("/blocks").expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].userId).toBe(BOB);
  });

  it("is enforced in BOTH directions for messaging", async () => {
    actAs(ALICE);
    await request(app).post("/blocks").send({ targetUserId: BOB }).expect(204);
    expect(await isBlockedBetween(ALICE, BOB)).toBe(true);
    expect(await isBlockedBetween(BOB, ALICE)).toBe(true);

    // The blocker cannot message out...
    await expect(
      sendDm({ fromUserId: ALICE, fromName: "A", fromAvatar: "", toUserId: BOB, text: "hi" }),
    ).rejects.toThrow();
    // ...and, critically, the blocked user cannot message in.
    await expect(
      sendDm({ fromUserId: BOB, fromName: "B", fromAvatar: "", toUserId: ALICE, text: "hi" }),
    ).rejects.toThrow();
  });

  it("hides blocked accounts from the user directory", async () => {
    actAs(ALICE);
    await request(app).post("/profiles/me").send({ name: `A ${TAG}` }).expect(200);
    actAs(BOB);
    await request(app).post("/profiles/me").send({ name: `B ${TAG}` }).expect(200);

    actAs(ALICE);
    const before = await request(app).get("/profiles").expect(200);
    expect(before.body.some((p: { userId: string }) => p.userId === BOB)).toBe(true);

    await request(app).post("/blocks").send({ targetUserId: BOB }).expect(204);
    const after = await request(app).get("/profiles").expect(200);
    expect(after.body.some((p: { userId: string }) => p.userId === BOB)).toBe(false);

    // And symmetrically for the blocked user.
    actAs(BOB);
    const bobSees = await request(app).get("/profiles").expect(200);
    expect(bobSees.body.some((p: { userId: string }) => p.userId === ALICE)).toBe(false);
  });

  it("unblocking restores messaging", async () => {
    actAs(ALICE);
    await request(app).post("/blocks").send({ targetUserId: BOB }).expect(204);
    await request(app).delete(`/blocks/${BOB}`).expect(204);
    expect(await isBlockedBetween(ALICE, BOB)).toBe(false);
  });
});

describe("reporting", () => {
  it("requires authentication and a known reason", async () => {
    actAs(null);
    await request(app)
      .post("/reports")
      .send({ targetType: "user", targetId: BOB, reason: "spam" })
      .expect(401);

    actAs(ALICE);
    await request(app)
      .post("/reports")
      .send({ targetType: "user", targetId: BOB, reason: "not-a-reason" })
      .expect(400);
  });

  it("refuses reporting your own content", async () => {
    actAs(ALICE);
    await request(app)
      .post("/reports")
      .send({ targetType: "user", targetId: ALICE, reason: "spam" })
      .expect(400);
  });

  it("snapshots the reported content so a later delete cannot hide it", async () => {
    const [post] = await db
      .insert(postsTable)
      .values({ userId: BOB, text: `offending ${TAG}`, authorName: "B" })
      .returning();

    actAs(ALICE);
    await request(app)
      .post("/reports")
      .send({ targetType: "post", targetId: String(post.id), reason: "harassment" })
      .expect(204);

    // Author deletes the evidence.
    await db.delete(postsTable).where(eq(postsTable.id, post.id));

    actAs(OWNER);
    const queue = await request(app).get("/reports").expect(200);
    const row = queue.body.find((r: { targetId: string }) => r.targetId === String(post.id));
    expect(row.snapshot).toContain(`offending ${TAG}`);
    expect(row.targetUserId).toBe(BOB);
  });

  it("keeps the review queue admin-only and records the resolution", async () => {
    actAs(ALICE);
    await request(app).get("/reports").expect(403);
    await request(app)
      .post("/reports")
      .send({ targetType: "user", targetId: BOB, reason: "spam" })
      .expect(204);

    actAs(OWNER);
    const queue = await request(app).get("/reports").expect(200);
    const id = queue.body[0].id as number;
    expect(queue.body[0].status).toBe("open");

    await request(app).patch(`/reports/${id}`).send({ status: "actioned" }).expect(204);
    const after = await request(app).get("/reports").expect(200);
    expect(after.body.find((r: { id: number }) => r.id === id).status).toBe("actioned");
  });
});

describe("suspensions", () => {
  it("is admin-only", async () => {
    actAs(ALICE);
    await request(app).get("/bans").expect(403);
    await request(app).post("/bans").send({ publicId: "1" }).expect(403);
  });

  it("suspends by public id, blocks the account, and lifts cleanly", async () => {
    const wallet = await ensureWallet(BOB);
    actAs(OWNER);
    await request(app)
      .post("/bans")
      .send({ publicId: wallet.publicId, reason: "إساءة", days: 3 })
      .expect(204);

    const ban = await activeBan(BOB);
    expect(ban).not.toBeNull();
    expect(ban!.expiresAt).toBeInstanceOf(Date);

    // The suspended user is refused by requireAuth.
    actAs(BOB);
    await request(app).get("/blocks").expect(403);

    actAs(OWNER);
    await request(app).delete(`/bans/${BOB}`).expect(204);
    expect(await activeBan(BOB)).toBeNull();
    actAs(BOB);
    await request(app).get("/blocks").expect(200);
  });

  it("treats an elapsed suspension as expired", async () => {
    await db.insert(bansTable).values({
      userId: BOB,
      reason: "old",
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await activeBan(BOB)).toBeNull();
  });

  it("refuses to suspend an admin", async () => {
    const wallet = await ensureWallet(OWNER);
    actAs(OWNER);
    await request(app).post("/bans").send({ publicId: wallet.publicId }).expect(400);
  });
});

describe("room removal", () => {
  it("only the room owner or an admin may remove someone", async () => {
    actAs(BOB);
    await request(app).post(`/rooms/${roomId}/kick`).send({ userId: ALICE }).expect(403);

    actAs(ALICE); // room owner
    const res = await request(app)
      .post(`/rooms/${roomId}/kick`)
      .send({ userId: BOB })
      .expect(200);
    expect(res.body.minutes).toBeGreaterThan(0);
    expect(await isKickedFromRoom(String(roomId), BOB)).toBe(true);
  });

  it("refuses kicking yourself and unknown rooms", async () => {
    actAs(ALICE);
    await request(app).post(`/rooms/${roomId}/kick`).send({ userId: ALICE }).expect(400);
    await request(app).post("/rooms/999999/kick").send({ userId: BOB }).expect(404);
  });
});

describe("account deletion", () => {
  it("requires authentication", async () => {
    actAs(null);
    await request(app).delete("/account").expect(401);
  });

  it("removes the user's content and the identity itself", async () => {
    await ensureWallet(ALICE);
    await db.insert(profilesTable).values({ userId: ALICE, name: `A ${TAG}` });
    await db.insert(postsTable).values({ userId: ALICE, text: `mine ${TAG}` });
    await db.insert(blocksTable).values({ blockerId: ALICE, blockedId: BOB });

    actAs(ALICE);
    await request(app).delete("/account").expect(204);

    const profiles = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, ALICE));
    const posts = await db.select().from(postsTable).where(eq(postsTable.userId, ALICE));
    const blocks = await db
      .select()
      .from(blocksTable)
      .where(eq(blocksTable.blockerId, ALICE));
    expect(profiles).toHaveLength(0);
    expect(posts).toHaveLength(0);
    expect(blocks).toHaveLength(0);
    // The auth identity is removed too, so the account cannot sign back in.
    expect(clerk.deleted).toContain(ALICE);
  });
});
