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
        throw new Error("user not found");
      },
      getUserList: async () => ({ data: [] }),
      deleteUser: async () => {},
    },
  },
}));

import {
  db,
  userSettingsTable,
  followsTable,
  profilesTable,
  conversationsTable,
  dmMessagesTable,
} from "@workspace/db";
import { sendDm, DmValidationError } from "../lib/dm";
import { getSettings, canDm, DEFAULT_SETTINGS } from "../lib/settings";
import { purgeUserData } from "../lib/safety";
import settingsRouter from "./settings";
import dmRouter from "./dm";
import profilesRouter from "./profiles";

const TAG = `vitest_${Date.now()}`;
const ALICE = `user_st_alice_${TAG}`;
const BOB = `user_st_bob_${TAG}`;

function actAs(userId: string | null): void {
  clerk.userId = userId;
}

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(settingsRouter);
  app.use(profilesRouter);
  app.use(dmRouter);
});

async function cleanup(): Promise<void> {
  await db.delete(userSettingsTable).where(like(userSettingsTable.userId, `%${TAG}%`));
  await db
    .delete(followsTable)
    .where(
      or(like(followsTable.followerId, `%${TAG}%`), like(followsTable.followedId, `%${TAG}%`)),
    );
  await db.delete(dmMessagesTable).where(like(dmMessagesTable.fromUserId, `%${TAG}%`));
  await db
    .delete(conversationsTable)
    .where(
      or(
        like(conversationsTable.userAId, `%${TAG}%`),
        like(conversationsTable.userBId, `%${TAG}%`),
      ),
    );
  await db.delete(profilesTable).where(like(profilesTable.userId, `%${TAG}%`));
}

afterEach(cleanup);
afterAll(cleanup);

describe("settings endpoint", () => {
  it("requires authentication", async () => {
    actAs(null);
    await request(app).get("/settings").expect(401);
    await request(app).patch("/settings").send({ hideOnline: true }).expect(401);
  });

  it("returns defaults for an account that never saved settings", async () => {
    actAs(ALICE);
    const res = await request(app).get("/settings").expect(200);
    expect(res.body).toEqual(DEFAULT_SETTINGS);

    // Reading must not create a row — the enforcement paths read constantly.
    const rows = await db
      .select()
      .from(userSettingsTable)
      .where(like(userSettingsTable.userId, `%${TAG}%`));
    expect(rows).toHaveLength(0);
  });

  it("keeps untouched fields when only one is patched", async () => {
    actAs(ALICE);
    await request(app)
      .patch("/settings")
      .send({ hideOnline: true, whoCanDm: "none", notifyDm: "none" })
      .expect(200);

    // A single-field write must not reset the rest. This is the failure mode
    // POST /profiles/me still has, and the reason this test exists.
    const res = await request(app)
      .patch("/settings")
      .send({ invisibleRoomEntry: true })
      .expect(200);

    // Deliberately exhaustive: a new column that the endpoint forgets to
    // return, or returns as undefined, fails here rather than in the app.
    expect(res.body).toEqual({
      notifyDm: "none",
      notifyLikes: true,
      notifyMoments: true,
      notifyVisitors: true,
      whoCanDm: "none",
      hideOnline: true,
      invisibleRoomEntry: true,
      invisibleBrowsing: false,
      language: "ar",
    });
  });

  it("stores the moment notification toggles independently", async () => {
    actAs(ALICE);
    await request(app).patch("/settings").send({ notifyLikes: false }).expect(200);
    const res = await request(app).patch("/settings").send({ notifyMoments: false }).expect(200);
    expect(res.body.notifyLikes).toBe(false);
    expect(res.body.notifyMoments).toBe(false);
    // Turning one back on must not disturb the other.
    const back = await request(app).patch("/settings").send({ notifyLikes: true }).expect(200);
    expect(back.body.notifyLikes).toBe(true);
    expect(back.body.notifyMoments).toBe(false);
  });

  it("rejects a value outside the allowed set", async () => {
    actAs(ALICE);
    await request(app).patch("/settings").send({ whoCanDm: "everyone" }).expect(400);
    await request(app).patch("/settings").send({ notifyDm: 7 }).expect(400);
    // The rejected write must not have partially applied.
    expect(await getSettings(ALICE)).toEqual(DEFAULT_SETTINGS);
  });

  it("writes are scoped to the caller", async () => {
    actAs(ALICE);
    await request(app).patch("/settings").send({ hideOnline: true }).expect(200);
    expect((await getSettings(ALICE)).hideOnline).toBe(true);
    expect((await getSettings(BOB)).hideOnline).toBe(false);
  });
});

describe("who can send me a direct message", () => {
  const dm = { fromUserId: ALICE, fromName: "Alice", fromAvatar: "", toUserId: BOB, text: "hi" };

  it("allows anyone by default", async () => {
    await expect(sendDm(dm)).resolves.toBeTruthy();
  });

  it("blocks everyone when set to none", async () => {
    actAs(BOB);
    await request(app).patch("/settings").send({ whoCanDm: "none" }).expect(200);
    await expect(sendDm(dm)).rejects.toBeInstanceOf(DmValidationError);
  });

  it("allows only accounts the recipient follows", async () => {
    actAs(BOB);
    await request(app).patch("/settings").send({ whoCanDm: "following" }).expect(200);

    expect(await canDm(ALICE, BOB)).toBe(false);
    await expect(sendDm(dm)).rejects.toBeInstanceOf(DmValidationError);

    // Bob follows Alice — now Alice may write to Bob.
    await db.insert(followsTable).values({ followerId: BOB, followedId: ALICE });
    expect(await canDm(ALICE, BOB)).toBe(true);
    await expect(sendDm(dm)).resolves.toBeTruthy();
  });

  it("does not treat the reverse follow as permission", async () => {
    actAs(BOB);
    await request(app).patch("/settings").send({ whoCanDm: "following" }).expect(200);
    // Alice following Bob is not Bob letting Alice in.
    await db.insert(followsTable).values({ followerId: ALICE, followedId: BOB });
    expect(await canDm(ALICE, BOB)).toBe(false);
  });

  it("blocks opening an empty conversation too", async () => {
    actAs(BOB);
    await request(app).patch("/settings").send({ whoCanDm: "none" }).expect(200);

    // Without this the setting only stops messages, and anyone could still
    // push an empty thread into the recipient's inbox.
    actAs(ALICE);
    await request(app)
      .post("/dm/open")
      .send({ otherUserId: BOB, otherName: "Bob", otherAvatar: "" })
      .expect(403);
  });

  it("lets the official account through regardless", async () => {
    actAs(BOB);
    await request(app).patch("/settings").send({ whoCanDm: "none" }).expect(200);
    // The welcome message must arrive however the inbox is configured.
    await expect(
      sendDm({ ...dm, fromUserId: `official_${TAG}`, bypassPrivacy: true }),
    ).resolves.toBeTruthy();
  });
});

describe("hiding the online dot", () => {
  async function seedProfile(userId: string, name: string): Promise<void> {
    actAs(userId);
    await request(app).post("/profiles/me").send({ name }).expect(200);
  }

  it("reports a hidden account as offline in the directory", async () => {
    await seedProfile(BOB, "Bob");
    actAs(BOB);
    await request(app).patch("/settings").send({ hideOnline: true }).expect(200);

    await seedProfile(ALICE, "Alice");
    actAs(ALICE);
    const res = await request(app).get("/profiles").expect(200);
    const bob = res.body.find((p: { userId: string }) => p.userId === BOB);

    expect(bob).toBeDefined();
    // lastSeenAt was just refreshed, so this is the setting talking.
    expect(bob.isOnline).toBe(false);
    expect(new Date(bob.lastSeenAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("still shows the owner as online to themselves", async () => {
    await seedProfile(BOB, "Bob");
    actAs(BOB);
    await request(app).patch("/settings").send({ hideOnline: true }).expect(200);

    const own = await request(app).get(`/profiles/${BOB}`).expect(200);
    expect(own.body.isOnline).toBe(true);

    await seedProfile(ALICE, "Alice");
    actAs(ALICE);
    const other = await request(app).get(`/profiles/${BOB}`).expect(200);
    expect(other.body.isOnline).toBe(false);
  });

  it("leaves accounts that did not hide themselves online", async () => {
    await seedProfile(BOB, "Bob");
    await seedProfile(ALICE, "Alice");
    actAs(ALICE);
    const res = await request(app).get("/profiles").expect(200);
    const bob = res.body.find((p: { userId: string }) => p.userId === BOB);
    expect(bob.isOnline).toBe(true);
  });
});

describe("support contact", () => {
  it("requires authentication", async () => {
    actAs(null);
    await request(app).get("/support/contact").expect(401);
  });

  it("returns the official account", async () => {
    actAs(ALICE);
    const res = await request(app).get("/support/contact").expect(200);
    expect(res.body.userId).toBe("official_nabda");
    expect(typeof res.body.name).toBe("string");
    expect(typeof res.body.avatar).toBe("string");
  });
});

describe("account deletion", () => {
  it("removes the settings row", async () => {
    actAs(ALICE);
    await request(app).patch("/settings").send({ hideOnline: true }).expect(200);

    await purgeUserData(ALICE);

    const rows = await db
      .select()
      .from(userSettingsTable)
      .where(like(userSettingsTable.userId, `%${TAG}%`));
    expect(rows).toHaveLength(0);
    // A deleted account reads back as defaults, not as its old preferences.
    expect(await getSettings(ALICE)).toEqual(DEFAULT_SETTINGS);
  });
});
