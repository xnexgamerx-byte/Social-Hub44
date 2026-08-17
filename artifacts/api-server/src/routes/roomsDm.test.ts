import express, { type Express } from "express";
import request from "supertest";
import { like, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Shared, mutable identity state used by the mocked Clerk SDK. `vi.hoisted`
// makes it available inside the (hoisted) vi.mock factory below.
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
      getUserList: async ({ emailAddress }: { emailAddress: string[] }) => {
        const email = emailAddress?.[0]?.toLowerCase();
        const uid = email ? clerk.userIdByEmail.get(email) : undefined;
        return { data: uid ? [{ id: uid }] : [] };
      },
    },
  },
}));

import { db, roomsTable, conversationsTable, dmMessagesTable } from "@workspace/db";
import { sendDm } from "../lib/dm";
import roomsRouter from "./rooms";
import dmRouter from "./dm";

const TAG = `vitest_${Date.now()}`;
const ALICE = `user_alice_${TAG}`;
const BOB = `user_bob_${TAG}`;
const INTRUDER = `user_intruder_${TAG}`;

function actAs(userId: string | null): void {
  clerk.userId = userId;
}

let app: Express;

beforeAll(() => {
  for (const uid of [ALICE, BOB, INTRUDER]) {
    const email = `${uid}@test.local`;
    clerk.emailByUserId.set(uid, email);
    clerk.userIdByEmail.set(email, uid);
  }
  app = express();
  app.use(express.json());
  app.use(roomsRouter);
  app.use(dmRouter);
});

async function cleanup(): Promise<void> {
  await db.delete(roomsTable).where(like(roomsTable.name, `%${TAG}%`));
  await db
    .delete(conversationsTable)
    .where(
      or(
        like(conversationsTable.userAId, `%${TAG}%`),
        like(conversationsTable.userBId, `%${TAG}%`),
      ),
    );
  await db.delete(dmMessagesTable).where(like(dmMessagesTable.fromUserId, `%${TAG}%`));
}

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("rooms routes", () => {
  it("serves the room list publicly", async () => {
    actAs(null);
    await request(app).get("/rooms").expect(200);
  });

  it("rejects unauthenticated room writes with 401", async () => {
    actAs(null);
    await request(app).post("/rooms").send({ name: `Room ${TAG}` }).expect(401);
    await request(app).patch("/rooms/999999").send({ name: "x" }).expect(401);
    await request(app).delete("/rooms/999999").expect(401);
    await request(app).get("/rooms/mine").expect(401);
  });

  it("creates a room owned by the authenticated user, ignoring any body ownerId", async () => {
    actAs(ALICE);
    const created = await request(app)
      .post("/rooms")
      .send({ name: `Room ${TAG}`, ownerId: "user_spoofed", ownerName: "Alice" })
      .expect(201);
    expect(created.body.ownerId).toBe(ALICE);

    const mine = await request(app).get("/rooms/mine").expect(200);
    expect(mine.body.map((r: { id: number }) => r.id)).toContain(created.body.id);
  });

  it("returns the room by id and 404 for a missing one", async () => {
    actAs(ALICE);
    const created = await request(app)
      .post("/rooms")
      .send({ name: `Room ${TAG}` })
      .expect(201);
    actAs(null);
    const fetched = await request(app).get(`/rooms/${created.body.id}`).expect(200);
    expect(fetched.body.name).toBe(`Room ${TAG}`);
    await request(app).get("/rooms/999999").expect(404);
  });

  it("only lets the owner (not another user) update or delete a room", async () => {
    actAs(ALICE);
    const created = await request(app)
      .post("/rooms")
      .send({ name: `Room ${TAG}` })
      .expect(201);
    const id = created.body.id as number;

    actAs(INTRUDER);
    await request(app).patch(`/rooms/${id}`).send({ name: `Taken ${TAG}` }).expect(403);
    await request(app).delete(`/rooms/${id}`).expect(403);

    actAs(ALICE);
    const updated = await request(app)
      .patch(`/rooms/${id}`)
      .send({ name: `Renamed ${TAG}` })
      .expect(200);
    expect(updated.body.name).toBe(`Renamed ${TAG}`);
    await request(app).delete(`/rooms/${id}`).expect(204);
    await request(app).delete(`/rooms/${id}`).expect(404);
  });

  it("caps active rooms per user", async () => {
    actAs(ALICE);
    for (let i = 0; i < 3; i++) {
      await request(app).post("/rooms").send({ name: `Room ${i} ${TAG}` }).expect(201);
    }
    await request(app).post("/rooms").send({ name: `Room 4 ${TAG}` }).expect(400);
  });
});

describe("dm routes", () => {
  it("rejects unauthenticated DM access with 401", async () => {
    actAs(null);
    await request(app).get("/dm/conversations").expect(401);
    await request(app).post("/dm/open").send({ otherUserId: BOB }).expect(401);
    await request(app).get("/dm/conversations/1/messages").expect(401);
    await request(app).post("/dm/conversations/1/read").expect(401);
  });

  it("opens one conversation per pair regardless of direction", async () => {
    actAs(ALICE);
    const first = await request(app)
      .post("/dm/open")
      .send({ otherUserId: BOB, otherName: "Bob" })
      .expect(200);

    actAs(BOB);
    const second = await request(app)
      .post("/dm/open")
      .send({ otherUserId: ALICE, otherName: "Alice" })
      .expect(200);

    expect(second.body.id).toBe(first.body.id);
    expect(first.body.otherUserId).toBe(BOB);
    expect(second.body.otherUserId).toBe(ALICE);
  });

  it("refuses opening a conversation with yourself", async () => {
    actAs(ALICE);
    await request(app).post("/dm/open").send({ otherUserId: ALICE }).expect(400);
  });

  it("keeps conversation history participants-only", async () => {
    actAs(ALICE);
    const conv = await request(app)
      .post("/dm/open")
      .send({ otherUserId: BOB })
      .expect(200);

    actAs(INTRUDER);
    await request(app).get(`/dm/conversations/${conv.body.id}/messages`).expect(403);
    await request(app).post(`/dm/conversations/${conv.body.id}/read`).expect(403);

    actAs(ALICE);
    await request(app).get(`/dm/conversations/${conv.body.id}/messages`).expect(200);
    await request(app).get("/dm/conversations/999999/messages").expect(404);
  });

  it("delivers a message, counts it unread for the recipient only, and read resets it", async () => {
    await sendDm({
      fromUserId: ALICE,
      fromName: "Alice",
      fromAvatar: "",
      toUserId: BOB,
      toName: "Bob",
      text: `hello ${TAG}`,
    });

    actAs(BOB);
    const bobInbox = await request(app).get("/dm/conversations").expect(200);
    expect(bobInbox.body).toHaveLength(1);
    expect(bobInbox.body[0].unread).toBe(1);
    expect(bobInbox.body[0].lastText).toBe(`hello ${TAG}`);
    expect(bobInbox.body[0].otherUserId).toBe(ALICE);

    actAs(ALICE);
    const aliceInbox = await request(app).get("/dm/conversations").expect(200);
    expect(aliceInbox.body[0].unread).toBe(0);

    actAs(BOB);
    const convId = bobInbox.body[0].id as number;
    const history = await request(app)
      .get(`/dm/conversations/${convId}/messages`)
      .expect(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0].fromUserId).toBe(ALICE);

    await request(app).post(`/dm/conversations/${convId}/read`).expect(204);
    const after = await request(app).get("/dm/conversations").expect(200);
    expect(after.body[0].unread).toBe(0);
  });

  it("rejects sending a DM to yourself or an empty message", async () => {
    await expect(
      sendDm({
        fromUserId: ALICE,
        fromName: "Alice",
        fromAvatar: "",
        toUserId: ALICE,
        text: "hi",
      }),
    ).rejects.toThrow();
    await expect(
      sendDm({
        fromUserId: ALICE,
        fromName: "Alice",
        fromAvatar: "",
        toUserId: BOB,
        text: "   ",
      }),
    ).rejects.toThrow();
  });
});
