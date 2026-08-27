import express, { type Express } from "express";
import request from "supertest";
import { like, or } from "drizzle-orm";
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

import { db, profileVisitsTable, profilesTable, userSettingsTable, blocksTable } from "@workspace/db";
import { listVisitors, recordProfileVisit } from "../lib/visitors";
import { updateSettings } from "../lib/settings";
import { purgeUserData } from "../lib/safety";
import settingsRouter from "./settings";
import profilesRouter from "./profiles";

const TAG = `vitest_${Date.now()}`;
const ALICE = `user_vs_alice_${TAG}`;
const BOB = `user_vs_bob_${TAG}`;
const CARA = `user_vs_cara_${TAG}`;

function actAs(userId: string | null): void {
  clerk.userId = userId;
}

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(settingsRouter);
  app.use(profilesRouter);
});

async function cleanup(): Promise<void> {
  await db
    .delete(profileVisitsTable)
    .where(
      or(
        like(profileVisitsTable.profileUserId, `%${TAG}%`),
        like(profileVisitsTable.visitorUserId, `%${TAG}%`),
      ),
    );
  await db.delete(userSettingsTable).where(like(userSettingsTable.userId, `%${TAG}%`));
  await db
    .delete(blocksTable)
    .where(or(like(blocksTable.blockerId, `%${TAG}%`), like(blocksTable.blockedId, `%${TAG}%`)));
  await db.delete(profilesTable).where(like(profilesTable.userId, `%${TAG}%`));
}

afterEach(cleanup);
afterAll(cleanup);

/** Create a profile row so the visitor list has a name to join against. */
async function seedProfile(userId: string, name: string): Promise<void> {
  actAs(userId);
  await request(app).post("/profiles/me").send({ name }).expect(200);
}

describe("recording a profile visit", () => {
  it("records who opened a profile", async () => {
    await seedProfile(BOB, "Bob");
    await seedProfile(ALICE, "Alice");

    actAs(ALICE);
    await request(app).get(`/profiles/${BOB}`).expect(200);

    // The write is fire-and-forget and the database is remote, so the several
    // round trips behind it need more than waitFor's one-second default.
    await vi.waitFor(
      async () => {
        const visitors = await listVisitors(BOB);
        expect(visitors.map((v) => v.userId)).toContain(ALICE);
      },
      { timeout: 15_000, interval: 300 },
    );
  });

  it("does not record viewing your own profile", async () => {
    await seedProfile(ALICE, "Alice");
    await recordProfileVisit({
      profileUserId: ALICE,
      visitorUserId: ALICE,
      visitorName: "Alice",
    });
    expect(await listVisitors(ALICE)).toHaveLength(0);
  });

  it("keeps one row per viewer and moves them to the top", async () => {
    await seedProfile(ALICE, "Alice");
    await seedProfile(CARA, "Cara");

    await recordProfileVisit({ profileUserId: BOB, visitorUserId: ALICE, visitorName: "Alice" });
    await recordProfileVisit({ profileUserId: BOB, visitorUserId: CARA, visitorName: "Cara" });
    // Alice returns — she should move to the front, not appear twice.
    await recordProfileVisit({ profileUserId: BOB, visitorUserId: ALICE, visitorName: "Alice" });

    const visitors = await listVisitors(BOB);
    expect(visitors).toHaveLength(2);
    expect(visitors[0].userId).toBe(ALICE);
  });

  it("leaves no trace at all while browsing incognito", async () => {
    await seedProfile(ALICE, "Alice");
    await updateSettings(ALICE, { invisibleBrowsing: true });

    await recordProfileVisit({ profileUserId: BOB, visitorUserId: ALICE, visitorName: "Alice" });

    // Not just a hidden notification — no row is written either, or the
    // setting would only be hiding the alert.
    const rows = await db
      .select()
      .from(profileVisitsTable)
      .where(like(profileVisitsTable.visitorUserId, `%${TAG}%`));
    expect(rows).toHaveLength(0);
    expect(await listVisitors(BOB)).toHaveLength(0);
  });
});

describe("the visitors list", () => {
  it("requires authentication", async () => {
    actAs(null);
    await request(app).get("/visitors").expect(401);
  });

  it("returns only my own visitors", async () => {
    await seedProfile(ALICE, "Alice");
    await recordProfileVisit({ profileUserId: BOB, visitorUserId: ALICE, visitorName: "Alice" });

    actAs(BOB);
    const mine = await request(app).get("/visitors").expect(200);
    expect(mine.body.map((v: { userId: string }) => v.userId)).toContain(ALICE);

    // Alice has no visitors of her own.
    actAs(ALICE);
    const hers = await request(app).get("/visitors").expect(200);
    expect(hers.body).toHaveLength(0);
  });

  it("hides blocked accounts", async () => {
    await seedProfile(ALICE, "Alice");
    await recordProfileVisit({ profileUserId: BOB, visitorUserId: ALICE, visitorName: "Alice" });

    actAs(BOB);
    await request(app).post("/blocks").send({ targetUserId: ALICE });
    await db.insert(blocksTable).values({ blockerId: BOB, blockedId: ALICE }).onConflictDoNothing();

    const res = await listVisitors(BOB);
    expect(res.map((v) => v.userId)).not.toContain(ALICE);
  });

  it("carries the visitor's name and level", async () => {
    await seedProfile(ALICE, "Alice");
    await recordProfileVisit({ profileUserId: BOB, visitorUserId: ALICE, visitorName: "Alice" });

    const [visitor] = await listVisitors(BOB);
    expect(visitor.name).toBe("Alice");
    expect(typeof visitor.level).toBe("number");
    expect(new Date(visitor.visitedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
});

describe("account deletion", () => {
  it("removes visits in both directions", async () => {
    await seedProfile(ALICE, "Alice");
    await recordProfileVisit({ profileUserId: BOB, visitorUserId: ALICE, visitorName: "Alice" });
    await recordProfileVisit({ profileUserId: ALICE, visitorUserId: CARA, visitorName: "Cara" });

    await purgeUserData(ALICE);

    const rows = await db
      .select()
      .from(profileVisitsTable)
      .where(
        or(
          like(profileVisitsTable.profileUserId, `%${TAG}%`),
          like(profileVisitsTable.visitorUserId, `%${TAG}%`),
        ),
      );
    expect(rows).toHaveLength(0);
  });
});
