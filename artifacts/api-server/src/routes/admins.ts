import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, adminsTable, adminAuditTable } from "@workspace/db";
import {
  ListAdminsResponse,
  ListAdminsResponseItem,
  CreateAdminBody,
  DeleteAdminParams,
  ListAdminAuditResponse,
} from "@workspace/api-zod";
import {
  requireAdmin,
  adminEmails,
  getUserEmail,
  type AuthedRequest,
} from "../lib/authz";

const router: IRouter = Router();

/** Best-effort resolve a Clerk user id for an email (empty string if unknown). */
async function resolveUserId(email: string): Promise<string> {
  try {
    const list = await clerkClient.users.getUserList({ emailAddress: [email] });
    const user = list.data?.[0];
    return user?.id ?? "";
  } catch {
    return "";
  }
}

router.get("/admins", requireAdmin, async (_req, res): Promise<void> => {
  const envSet = adminEmails();
  const rows = await db.select().from(adminsTable).orderBy(adminsTable.id);
  // Bootstrap owners (from ADMIN_EMAILS) are shown read-only; in-app admins are
  // removable. Skip any DB row that duplicates an env owner.
  const list = [
    ...[...envSet].map((email) => ({
      id: 0,
      email,
      userId: "",
      addedBy: "",
      source: "env",
      removable: false,
    })),
    ...rows
      .filter((r) => !envSet.has(r.email))
      .map((r) => ({
        id: r.id,
        email: r.email,
        userId: r.userId,
        addedBy: r.addedBy,
        source: "db",
        removable: true,
      })),
  ];
  res.json(ListAdminsResponse.parse(list));
});

router.post("/admins", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateAdminBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  if (!email.includes("@") || email.length < 3) {
    res.status(400).json({ error: "بريد إلكتروني غير صالح" });
    return;
  }
  if (adminEmails().has(email)) {
    res.status(400).json({ error: "هذا الحساب مشرف بالفعل" });
    return;
  }

  const addedBy = await getUserEmail((req as AuthedRequest).userId ?? "").catch(
    () => null,
  );
  const userId = await resolveUserId(email);

  // Insert the admin and its audit record atomically: a grant must never be
  // applied without a corresponding history entry (and vice versa).
  const row = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(adminsTable)
      .values({ email, userId, addedBy: addedBy ?? "" })
      .onConflictDoNothing({ target: adminsTable.email })
      .returning();
    if (inserted.length === 0) return null;
    await tx
      .insert(adminAuditTable)
      .values({ action: "grant", targetEmail: email, actorEmail: addedBy ?? "" });
    return inserted[0];
  });
  if (!row) {
    res.status(400).json({ error: "هذا الحساب مشرف بالفعل" });
    return;
  }
  res.status(201).json(
    ListAdminsResponseItem.parse({
      id: row.id,
      email: row.email,
      userId: row.userId,
      addedBy: row.addedBy,
      source: "db",
      removable: true,
    }),
  );
});

router.delete("/admins/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteAdminParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.id, params.data.id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "المشرف غير موجود" });
    return;
  }
  // Prevent an admin from revoking their own access (avoids accidental lockout).
  const requesterEmail = await getUserEmail(
    (req as AuthedRequest).userId ?? "",
  ).catch(() => null);
  if (requesterEmail && requesterEmail === row.email) {
    res.status(400).json({ error: "لا يمكنك إزالة نفسك" });
    return;
  }
  // Delete the admin and record the revoke atomically.
  await db.transaction(async (tx) => {
    await tx.delete(adminsTable).where(eq(adminsTable.id, params.data.id));
    await tx.insert(adminAuditTable).values({
      action: "revoke",
      targetEmail: row.email,
      actorEmail: requesterEmail ?? "",
    });
  });
  res.sendStatus(204);
});

router.get("/admins/audit", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(adminAuditTable)
    .orderBy(desc(adminAuditTable.createdAt))
    .limit(100);
  res.json(
    ListAdminAuditResponse.parse(
      rows.map((r) => ({
        id: r.id,
        action: r.action,
        targetEmail: r.targetEmail,
        actorEmail: r.actorEmail,
        createdAt: r.createdAt.toISOString(),
      })),
    ),
  );
});

export default router;
