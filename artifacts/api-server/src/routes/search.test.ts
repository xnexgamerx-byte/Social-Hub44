import express, { type Express } from "express";
import request from "supertest";
import { like } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: clerk.userId }),
  clerkClient: {
    users: {
      getUser: async () => {
        throw new Error("user not found");
      },
      getUserList: async () => ({ data: [] }),
      deleteUser: async () => {},
    },
  },
}));

import { db, roomsTable, profilesTable, walletsTable } from "@workspace/db";
import { ensureWallet } from "../lib/wallet";
import roomsRouter from "./rooms";
import profilesRouter from "./profiles";

const TAG = `vitest_${Date.now()}`;
const ALICE = `user_se_alice_${TAG}`;
const BOB = `user_se_bob_${TAG}`;

function actAs(userId: string | null): void {
  clerk.userId = userId;
}

let app: Express;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use(roomsRouter);
  app.use(profilesRouter);

  await db.insert(roomsTable).values([
    {
      name: `${TAG} ركن الطرب`,
      description: "أغاني وجلسات",
      category: "music",
      ownerId: BOB,
      ownerName: `${TAG} أبو علي`,
      active: true,
    },
    {
      name: `${TAG} عشاق الألعاب`,
      description: "تحديات لودو",
      category: "gaming",
      ownerId: BOB,
      ownerName: `${TAG} سيف`,
      active: true,
    },
    {
      // Inactive rooms must never surface, search or not.
      name: `${TAG} غرفة مغلقة`,
      description: "طرب",
      category: "music",
      ownerId: BOB,
      ownerName: `${TAG} مخفي`,
      active: false,
    },
  ]);
});

async function cleanup(): Promise<void> {
  await db.delete(profilesTable).where(like(profilesTable.userId, `%${TAG}%`));
  await db.delete(walletsTable).where(like(walletsTable.userId, `%${TAG}%`));
}

afterEach(cleanup);

afterAll(async () => {
  await cleanup();
  await db.delete(roomsTable).where(like(roomsTable.name, `%${TAG}%`));
});

/** Only this test file's rooms, so a shared database stays irrelevant. */
function mine(body: { name: string }[]): { name: string }[] {
  return body.filter((r) => r.name.includes(TAG));
}

describe("room search", () => {
  it("matches the room name", async () => {
    actAs(ALICE);
    const res = await request(app).get("/rooms").query({ q: "الطرب" }).expect(200);
    const names = mine(res.body).map((r) => r.name);
    expect(names.some((n) => n.includes("ركن الطرب"))).toBe(true);
    expect(names.some((n) => n.includes("عشاق الألعاب"))).toBe(false);
  });

  it("matches the owner name, not just the room title", async () => {
    // People look for a room by who runs it as often as by what it is called.
    actAs(ALICE);
    const res = await request(app).get("/rooms").query({ q: "سيف" }).expect(200);
    const names = mine(res.body).map((r) => r.name);
    expect(names.some((n) => n.includes("عشاق الألعاب"))).toBe(true);
  });

  it("filters by category", async () => {
    actAs(ALICE);
    const res = await request(app).get("/rooms").query({ category: "gaming" }).expect(200);
    for (const room of mine(res.body)) {
      expect((room as unknown as { category: string }).category).toBe("gaming");
    }
  });

  it("never surfaces an inactive room, even on a direct match", async () => {
    actAs(ALICE);
    const res = await request(app).get("/rooms").query({ q: "غرفة مغلقة" }).expect(200);
    expect(mine(res.body)).toHaveLength(0);
  });

  it("treats a wildcard as a literal", async () => {
    // Unescaped, "%" in a LIKE pattern would return every room in the app.
    actAs(ALICE);
    const res = await request(app).get("/rooms").query({ q: "%" }).expect(200);
    expect(mine(res.body)).toHaveLength(0);
  });

  it("returns everything active when no query is given", async () => {
    actAs(ALICE);
    const res = await request(app).get("/rooms").expect(200);
    expect(mine(res.body)).toHaveLength(2);
  });

  it("reports a live listener count on every room", async () => {
    actAs(ALICE);
    const res = await request(app).get("/rooms").expect(200);
    for (const room of mine(res.body) as unknown as { listeners: number }[]) {
      // No socket server is attached in this test, so the honest answer is 0
      // rather than a missing field the client would render as undefined.
      expect(room.listeners).toBe(0);
    }
  });
});

describe("people search", () => {
  async function seed(userId: string, name: string): Promise<string> {
    actAs(userId);
    await request(app).post("/profiles/me").send({ name }).expect(200);
    const wallet = await ensureWallet(userId);
    return wallet.publicId ?? "";
  }

  it("matches a display name", async () => {
    await seed(BOB, `${TAG} حسين`);
    actAs(ALICE);
    const res = await request(app).get("/profiles").query({ q: "حسين" }).expect(200);
    expect(res.body.map((p: { userId: string }) => p.userId)).toContain(BOB);
  });

  it("matches the public account id", async () => {
    // The public id is the number people read off a profile and pass along,
    // so it has to be searchable or sharing an account is impossible.
    const publicId = await seed(BOB, `${TAG} حسين`);
    expect(publicId).not.toBe("");

    actAs(ALICE);
    const res = await request(app).get("/profiles").query({ q: publicId }).expect(200);
    expect(res.body.map((p: { userId: string }) => p.userId)).toContain(BOB);
  });

  it("never returns the caller in their own search", async () => {
    await seed(ALICE, `${TAG} حسين`);
    await seed(BOB, `${TAG} حسين`);
    actAs(ALICE);
    const res = await request(app).get("/profiles").query({ q: "حسين" }).expect(200);
    const ids = res.body.map((p: { userId: string }) => p.userId);
    expect(ids).toContain(BOB);
    expect(ids).not.toContain(ALICE);
  });

  it("treats a wildcard as a literal", async () => {
    await seed(BOB, `${TAG} حسين`);
    actAs(ALICE);
    const res = await request(app).get("/profiles").query({ q: "%" }).expect(200);
    expect(res.body.map((p: { userId: string }) => p.userId)).not.toContain(BOB);
  });
});
