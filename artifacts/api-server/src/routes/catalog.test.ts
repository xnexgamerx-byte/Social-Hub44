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

// Mock @clerk/express so requireAdmin resolves identities from our in-memory
// maps instead of calling Clerk. The DB layer stays real.
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

import {
  db,
  storeItemsTable,
  coinPackagesTable,
  dailyTasksTable,
  vipTiersTable,
  vipFeaturesTable,
} from "@workspace/db";
import storeItemsRouter from "./storeItems";
import coinPackagesRouter from "./coinPackages";
import dailyTasksRouter from "./dailyTasks";
import vipTiersRouter from "./vipTiers";
import vipFeaturesRouter from "./vipFeatures";

// Unique tag per run so cleanup only ever touches this run's rows.
const TAG = `vitest_${Date.now()}`;
const OWNER_EMAIL = `owner-${TAG}@test.local`;
const INTRUDER_EMAIL = `intruder-${TAG}@test.local`;

/** Make subsequent requests act as the given Clerk user (or sign out with null). */
function actAs(userId: string | null, email?: string): void {
  clerk.userId = userId;
  if (userId && email) {
    clerk.emailByUserId.set(userId, email.toLowerCase());
    clerk.userIdByEmail.set(email.toLowerCase(), userId);
  }
}

let app: Express;
let originalAdminEmails: string | undefined;

beforeAll(() => {
  originalAdminEmails = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = OWNER_EMAIL;
  clerk.emailByUserId.set("user_owner", OWNER_EMAIL);
  clerk.userIdByEmail.set(OWNER_EMAIL, "user_owner");
  // Pre-map a non-admin intruder identity.
  clerk.emailByUserId.set("user_intruder", INTRUDER_EMAIL);
  clerk.userIdByEmail.set(INTRUDER_EMAIL, "user_intruder");

  app = express();
  app.use(express.json());
  app.use(storeItemsRouter);
  app.use(coinPackagesRouter);
  app.use(dailyTasksRouter);
  app.use(vipTiersRouter);
  app.use(vipFeaturesRouter);
});

async function cleanup(): Promise<void> {
  await db.delete(storeItemsTable).where(like(storeItemsTable.name, `%${TAG}%`));
  await db.delete(coinPackagesTable).where(like(coinPackagesTable.name, `%${TAG}%`));
  await db.delete(dailyTasksTable).where(like(dailyTasksTable.label, `%${TAG}%`));
  await db.delete(vipTiersTable).where(like(vipTiersTable.color, `%${TAG}%`));
  await db
    .delete(vipFeaturesTable)
    .where(or(like(vipFeaturesTable.key, `%${TAG}%`), like(vipFeaturesTable.label, `%${TAG}%`)));
}

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAdminEmails;
});

// Each catalog resource shares the same auth contract: GET is public, while
// POST/PATCH/DELETE require an admin. The create/update bodies below are valid
// payloads so that an admin happy-path actually exercises the handler.
interface Resource {
  name: string;
  listPath: string;
  itemPath: (id: number | string) => string;
  create: () => Record<string, unknown>;
  update: Record<string, unknown>;
}

const resources: Resource[] = [
  {
    name: "store-items",
    listPath: "/store-items",
    itemPath: (id) => `/store-items/${id}`,
    create: () => ({ name: `Frame ${TAG}`, category: "إطارات" }),
    update: { sortOrder: 7 },
  },
  {
    name: "coin-packages",
    listPath: "/coin-packages",
    itemPath: (id) => `/coin-packages/${id}`,
    create: () => ({ name: `Pack ${TAG}`, coins: 1000 }),
    update: { sortOrder: 7 },
  },
  {
    name: "daily-tasks",
    listPath: "/daily-tasks",
    itemPath: (id) => `/daily-tasks/${id}`,
    create: () => ({ label: `Task ${TAG}` }),
    update: { sortOrder: 7 },
  },
  {
    name: "vip-tiers",
    listPath: "/vip-tiers",
    itemPath: (id) => `/vip-tiers/${id}`,
    // color carries the TAG so cleanup can find the row.
    create: () => ({ level: 99, color: `#fff ${TAG}` }),
    update: { active: false },
  },
  {
    name: "vip-features",
    listPath: "/vip-features",
    itemPath: (id) => `/vip-features/${id}`,
    create: () => ({ key: `feat-${TAG}`, label: `Feature ${TAG}` }),
    update: { sortOrder: 7 },
  },
];

describe.each(resources)("$name catalog authorization", (resource) => {
  it("allows GET without authentication (public catalog)", async () => {
    actAs(null);
    await request(app).get(resource.listPath).expect(200);
  });

  it("rejects unauthenticated writes with 401", async () => {
    actAs(null);
    await request(app).post(resource.listPath).send(resource.create()).expect(401);
    await request(app).patch(resource.itemPath(999999)).send(resource.update).expect(401);
    await request(app).delete(resource.itemPath(999999)).expect(401);
  });

  it("blocks a signed-in non-admin write with 403", async () => {
    actAs("user_intruder", INTRUDER_EMAIL);
    await request(app).post(resource.listPath).send(resource.create()).expect(403);
    await request(app).patch(resource.itemPath(999999)).send(resource.update).expect(403);
    await request(app).delete(resource.itemPath(999999)).expect(403);
  });

  it("does not write to the catalog when a non-admin attempts a create", async () => {
    actAs("user_intruder", INTRUDER_EMAIL);
    await request(app).post(resource.listPath).send(resource.create()).expect(403);

    actAs("user_owner", OWNER_EMAIL);
    const listed = await request(app).get(resource.listPath).expect(200);
    const taggedCount = (listed.body as Array<Record<string, unknown>>).filter((row) =>
      JSON.stringify(row).includes(TAG),
    ).length;
    expect(taggedCount).toBe(0);
  });

  it("lets an admin create, update, and delete a catalog entry", async () => {
    actAs("user_owner", OWNER_EMAIL);
    const created = await request(app).post(resource.listPath).send(resource.create()).expect(201);
    const id = created.body.id as number;
    expect(typeof id).toBe("number");

    await request(app).patch(resource.itemPath(id)).send(resource.update).expect(200);
    await request(app).delete(resource.itemPath(id)).expect(204);

    // A second delete now resolves to not-found, proving the row is gone.
    await request(app).delete(resource.itemPath(id)).expect(404);
  });
});
