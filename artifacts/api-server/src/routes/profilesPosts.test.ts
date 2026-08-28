import express, { type Express } from "express";
import request from "supertest";
import { like, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({
  userId: null as string | null,
  adminEmails: new Map<string, string>(),
}));

vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: clerk.userId }),
  clerkClient: {
    users: {
      getUser: async (userId: string) => {
        const email = clerk.adminEmails.get(userId);
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

import { db, profilesTable, postsTable, postLikesTable, walletsTable, walletTransactionsTable } from "@workspace/db";
import { adjustWallet } from "../lib/wallet";
import profilesRouter from "./profiles";
import postsRouter from "./posts";

const TAG = `vitest_${Date.now()}`;
const ALICE = `user_pp_alice_${TAG}`;
const BOB = `user_pp_bob_${TAG}`;

function actAs(userId: string | null): void {
  clerk.userId = userId;
}

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(profilesRouter);
  app.use(postsRouter);
});

async function cleanup(): Promise<void> {
  await db.delete(postLikesTable).where(like(postLikesTable.userId, `%${TAG}%`));
  await db.delete(postsTable).where(like(postsTable.userId, `%${TAG}%`));
  await db.delete(profilesTable).where(like(profilesTable.userId, `%${TAG}%`));
  await db.delete(walletTransactionsTable).where(like(walletTransactionsTable.userId, `%${TAG}%`));
  await db.delete(walletsTable).where(like(walletsTable.userId, `%${TAG}%`));
}

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("profiles directory", () => {
  it("requires authentication", async () => {
    actAs(null);
    await request(app).get("/profiles").expect(401);
    await request(app).post("/profiles/me").send({ name: "x" }).expect(401);
    await request(app).get(`/profiles/${BOB}`).expect(401);
  });

  it("upserts my own profile keyed to the session, ignoring any body userId", async () => {
    actAs(ALICE);
    const created = await request(app)
      .post("/profiles/me")
      .send({ name: `Alice ${TAG}`, gender: "female", age: 22, userId: "user_spoofed" })
      .expect(200);
    expect(created.body.userId).toBe(ALICE);
    expect(created.body.name).toBe(`Alice ${TAG}`);
    expect(created.body.isOnline).toBe(true);

    // A second upsert updates rather than duplicating.
    const updated = await request(app)
      .post("/profiles/me")
      .send({ name: `Alice2 ${TAG}` })
      .expect(200);
    expect(updated.body.name).toBe(`Alice2 ${TAG}`);

    const fetched = await request(app).get(`/profiles/${ALICE}`).expect(200);
    expect(fetched.body.name).toBe(`Alice2 ${TAG}`);
  });

  it("excludes the caller from the directory but lists others", async () => {
    actAs(ALICE);
    await request(app).post("/profiles/me").send({ name: `Alice ${TAG}` }).expect(200);
    actAs(BOB);
    await request(app).post("/profiles/me").send({ name: `Bob ${TAG}` }).expect(200);

    const bobSees = await request(app).get("/profiles").expect(200);
    const ids = bobSees.body.map((p: { userId: string }) => p.userId);
    expect(ids).toContain(ALICE);
    expect(ids).not.toContain(BOB);
  });

  it("reports the level derived from what the account has spent", async () => {
    actAs(ALICE);
    await request(app).post("/profiles/me").send({ name: `Alice ${TAG}` }).expect(200);

    // Buying coins does not raise the level — only giving them away does.
    await adjustWallet({ userId: ALICE, currency: "coins", amount: 20_000, type: "recharge" });
    const topUp = await request(app).get(`/profiles/${ALICE}`).expect(200);
    expect(topUp.body.level).toBe(0);

    await adjustWallet({ userId: ALICE, currency: "coins", amount: -12_000, type: "gift_sent" });
    const spent = await request(app).get(`/profiles/${ALICE}`).expect(200);
    expect(spent.body.level).toBe(2);
  });

  it("returns 404 for an unknown profile", async () => {
    actAs(ALICE);
    await request(app).get(`/profiles/user_missing_${TAG}`).expect(404);
  });
});

describe("moments feed", () => {
  it("requires authentication", async () => {
    actAs(null);
    await request(app).get("/posts").expect(401);
    await request(app).post("/posts").send({ text: "hi" }).expect(401);
    await request(app).post("/posts/1/like").expect(401);
    await request(app).delete("/posts/1").expect(401);
  });

  it("rejects an empty post", async () => {
    actAs(ALICE);
    await request(app).post("/posts").send({ text: "   ", images: [] }).expect(400);
  });

  it("creates a post authored by the session user with their profile name", async () => {
    actAs(ALICE);
    await request(app).post("/profiles/me").send({ name: `Alice ${TAG}` }).expect(200);
    const created = await request(app)
      .post("/posts")
      .send({ text: `hello ${TAG}`, userId: "user_spoofed" })
      .expect(201);
    expect(created.body.userId).toBe(ALICE);
    expect(created.body.authorName).toBe(`Alice ${TAG}`);
    expect(created.body.likeCount).toBe(0);
    expect(created.body.likedByMe).toBe(false);
  });

  it("toggles likes idempotently per user and reports the shared count", async () => {
    actAs(ALICE);
    const post = await request(app).post("/posts").send({ text: `post ${TAG}` }).expect(201);
    const id = post.body.id as number;

    const liked = await request(app).post(`/posts/${id}/like`).expect(200);
    expect(liked.body).toMatchObject({ likeCount: 1, likedByMe: true });

    // Bob's like adds to the same total.
    actAs(BOB);
    const bobLiked = await request(app).post(`/posts/${id}/like`).expect(200);
    expect(bobLiked.body).toMatchObject({ likeCount: 2, likedByMe: true });

    // Alice unliking only removes her own.
    actAs(ALICE);
    const unliked = await request(app).post(`/posts/${id}/like`).expect(200);
    expect(unliked.body).toMatchObject({ likeCount: 1, likedByMe: false });

    // The feed reflects per-viewer state.
    const aliceFeed = await request(app).get("/posts").expect(200);
    const mine = aliceFeed.body.find((p: { id: number }) => p.id === id);
    expect(mine).toMatchObject({ likeCount: 1, likedByMe: false });

    actAs(BOB);
    const bobFeed = await request(app).get("/posts").expect(200);
    const his = bobFeed.body.find((p: { id: number }) => p.id === id);
    expect(his).toMatchObject({ likeCount: 1, likedByMe: true });
  });

  it("only lets the author delete a post, and removes its likes", async () => {
    actAs(ALICE);
    const post = await request(app).post("/posts").send({ text: `post ${TAG}` }).expect(201);
    const id = post.body.id as number;
    await request(app).post(`/posts/${id}/like`).expect(200);

    actAs(BOB);
    await request(app).delete(`/posts/${id}`).expect(403);

    actAs(ALICE);
    await request(app).delete(`/posts/${id}`).expect(204);
    await request(app).delete(`/posts/${id}`).expect(404);
    await request(app).post(`/posts/${id}/like`).expect(404);
  });

  it("shows the author's current profile name after a rename", async () => {
    actAs(ALICE);
    await request(app).post("/profiles/me").send({ name: `Old ${TAG}` }).expect(200);
    await request(app).post("/posts").send({ text: `post ${TAG}` }).expect(201);
    await request(app).post("/profiles/me").send({ name: `New ${TAG}` }).expect(200);

    const feed = await request(app).get("/posts").expect(200);
    expect(feed.body[0].authorName).toBe(`New ${TAG}`);
  });
});
