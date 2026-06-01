import express, { type Express } from "express";
import request from "supertest";
import { like } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Shared, mutable identity state used by the mocked Clerk SDK. `vi.hoisted`
// makes it available inside the (hoisted) vi.mock factory below.
const clerk = vi.hoisted(() => ({
  userId: null as string | null,
  emailByUserId: new Map<string, string>(),
  userIdByEmail: new Map<string, string>(),
}));

// Mock @clerk/express so requireAdmin/getUserEmail resolve identities from our
// in-memory maps instead of calling Clerk. The DB layer stays real.
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

import { db, adminsTable, adminAuditTable } from "@workspace/db";
import adminsRouter from "./admins";

// Unique tag per run so cleanup only ever touches this run's rows.
const TAG = `vitest_${Date.now()}`;
const OWNER_EMAIL = `owner-${TAG}@test.local`;

function emailFor(label: string): string {
  return `${label}-${TAG}@test.local`;
}

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
  // The bootstrap owner is an admin via env, used to perform admin actions.
  process.env.ADMIN_EMAILS = OWNER_EMAIL;
  // Pre-map the owner identity.
  clerk.emailByUserId.set("user_owner", OWNER_EMAIL);
  clerk.userIdByEmail.set(OWNER_EMAIL, "user_owner");

  app = express();
  app.use(express.json());
  app.use(adminsRouter);
});

async function cleanup(): Promise<void> {
  await db.delete(adminAuditTable).where(like(adminAuditTable.targetEmail, `%${TAG}%`));
  await db.delete(adminsTable).where(like(adminsTable.email, `%${TAG}%`));
}

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAdminEmails;
  // Note: we intentionally do NOT close the shared @workspace/db pool here.
  // Vitest runs each test file in its own forked worker that is torn down on
  // completion, which closes the connection — calling pool.end() per-file would
  // break any future test file that imports @workspace/db.
});

describe("admin management authorization", () => {
  it("rejects unauthenticated requests with 401", async () => {
    actAs(null);
    await request(app).get("/admins").expect(401);
    await request(app).post("/admins").send({ email: emailFor("x") }).expect(401);
    await request(app).delete("/admins/1").expect(401);
    await request(app).get("/admins/audit").expect(401);
  });

  it("blocks a signed-in non-admin with 403 on every admin endpoint", async () => {
    actAs("user_intruder", emailFor("intruder"));
    await request(app).get("/admins").expect(403);
    await request(app)
      .post("/admins")
      .send({ email: emailFor("victim") })
      .expect(403);
    await request(app).delete("/admins/1").expect(403);
    await request(app).get("/admins/audit").expect(403);
  });

  it("does not let a non-admin actually create an admin", async () => {
    actAs("user_intruder", emailFor("intruder"));
    const target = emailFor("sneaky");
    await request(app).post("/admins").send({ email: target }).expect(403);
    // Confirm nothing was written to the DB.
    const rows = await db
      .select()
      .from(adminsTable)
      .where(like(adminsTable.email, `%${TAG}%`));
    expect(rows.find((r) => r.email === target)).toBeUndefined();
  });

  it("lets an admin add, list, and remove another admin", async () => {
    actAs("user_owner", OWNER_EMAIL);
    const target = emailFor("newadmin");

    const created = await request(app).post("/admins").send({ email: target }).expect(201);
    expect(created.body.email).toBe(target);
    expect(created.body.removable).toBe(true);
    const newId = created.body.id as number;

    const listed = await request(app).get("/admins").expect(200);
    const emails = (listed.body as Array<{ email: string }>).map((a) => a.email);
    expect(emails).toContain(target);

    await request(app).delete(`/admins/${newId}`).expect(204);

    const after = await request(app).get("/admins").expect(200);
    const afterEmails = (after.body as Array<{ email: string }>).map((a) => a.email);
    expect(afterEmails).not.toContain(target);
  });

  it("shows the bootstrap owner but marks it non-removable", async () => {
    actAs("user_owner", OWNER_EMAIL);
    const listed = await request(app).get("/admins").expect(200);
    const owner = (listed.body as Array<{ email: string; removable: boolean; source: string }>).find(
      (a) => a.email === OWNER_EMAIL,
    );
    expect(owner).toBeDefined();
    expect(owner?.removable).toBe(false);
    expect(owner?.source).toBe("env");
  });

  it("cannot remove the bootstrap owner via the delete endpoint", async () => {
    actAs("user_owner", OWNER_EMAIL);
    // The env owner is surfaced with id 0, which never exists as a DB row, so a
    // delete attempt resolves to "not found" rather than removing the owner.
    await request(app).delete("/admins/0").expect(404);
    const listed = await request(app).get("/admins").expect(200);
    const owner = (listed.body as Array<{ email: string; removable: boolean }>).find(
      (a) => a.email === OWNER_EMAIL,
    );
    expect(owner).toBeDefined();
    expect(owner?.removable).toBe(false);
  });

  it("prevents an admin from removing themselves (lockout protection)", async () => {
    // Grant a brand-new DB admin, then act as that same person and try to
    // delete their own row.
    actAs("user_owner", OWNER_EMAIL);
    const selfEmail = emailFor("selfadmin");
    const created = await request(app).post("/admins").send({ email: selfEmail }).expect(201);
    const selfId = created.body.id as number;

    actAs("user_self", selfEmail); // this user is an admin via the DB row
    await request(app).delete(`/admins/${selfId}`).expect(400);

    // The row must still exist.
    const rows = await db
      .select()
      .from(adminsTable)
      .where(like(adminsTable.email, `%${TAG}%`));
    expect(rows.find((r) => r.email === selfEmail)).toBeDefined();
  });

  it("rejects adding an email that is already a bootstrap owner", async () => {
    actAs("user_owner", OWNER_EMAIL);
    await request(app).post("/admins").send({ email: OWNER_EMAIL }).expect(400);
  });

  it("rejects an invalid email", async () => {
    actAs("user_owner", OWNER_EMAIL);
    await request(app).post("/admins").send({ email: "not-an-email" }).expect(400);
  });

  it("records grant and revoke actions in the audit trail", async () => {
    actAs("user_owner", OWNER_EMAIL);
    const target = emailFor("audited");

    const created = await request(app).post("/admins").send({ email: target }).expect(201);
    await request(app).delete(`/admins/${created.body.id}`).expect(204);

    const audit = await request(app).get("/admins/audit").expect(200);
    const forTarget = (audit.body as Array<{ action: string; targetEmail: string }>).filter(
      (a) => a.targetEmail === target,
    );
    const actions = forTarget.map((a) => a.action);
    expect(actions).toContain("grant");
    expect(actions).toContain("revoke");
  });
});
