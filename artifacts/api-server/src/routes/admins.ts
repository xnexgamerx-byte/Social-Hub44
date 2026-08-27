import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, adminsTable, adminAuditTable } from "@workspace/db";
import {
  isStorageConfigured,
  uploadStoreAsset,
  UploadError,
} from "../lib/storage";
import {
  ListAdminsResponse,
  ListAdminsResponseItem,
  CreateAdminBody,
  DeleteAdminParams,
  ListAdminAuditResponse,
  LookupWalletByPublicIdParams,
  LookupWalletByPublicIdResponse,
  GrantCoinsBody,
  GrantCoinsResponse,
  UploadStoreAssetBody,
} from "@workspace/api-zod";
import {
  requireAdmin,
  requireOwner,
  adminEmails,
  getUserEmail,
  type AuthedRequest,
} from "../lib/authz";
import {
  getWalletByPublicId,
  adjustWallet,
  type Currency,
} from "../lib/wallet";

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

/** Best-effort human-friendly name for a Clerk user id (falls back to "مستخدم"). */
async function resolveDisplayName(userId: string): Promise<string> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const name =
      user.fullName ||
      user.username ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.emailAddresses?.[0]?.emailAddress ||
      "";
    return name || "مستخدم";
  } catch {
    return "مستخدم";
  }
}

// Owner-only: look up an account by its public id so the owner can confirm the
// recipient before sending coins.
router.get(
  "/admins/wallet-lookup/:publicId",
  requireOwner,
  async (req, res): Promise<void> => {
    const params = LookupWalletByPublicIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const wallet = await getWalletByPublicId(params.data.publicId.trim());
    if (!wallet) {
      res.status(404).json({ error: "لا يوجد حساب بهذا المعرّف" });
      return;
    }
    const displayName = await resolveDisplayName(wallet.userId);
    res.json(
      LookupWalletByPublicIdResponse.parse({
        userId: wallet.userId,
        publicId: wallet.publicId ?? "",
        displayName,
        coins: wallet.coins,
        vPoints: wallet.vPoints,
      }),
    );
  },
);

// Owner-only: directly credit (or debit) an account's balance by public id.
router.post(
  "/admins/grant-coins",
  requireOwner,
  async (req, res): Promise<void> => {
    const body = GrantCoinsBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const { publicId, amount, currency } = body.data;
    if (!Number.isInteger(amount) || amount === 0) {
      res.status(400).json({ error: "المبلغ غير صالح" });
      return;
    }

    const wallet = await getWalletByPublicId(publicId.trim());
    if (!wallet) {
      res.status(404).json({ error: "لا يوجد حساب بهذا المعرّف" });
      return;
    }

    const actorEmail = await getUserEmail(
      (req as AuthedRequest).userId ?? "",
    ).catch(() => null);

    const updated = await adjustWallet({
      userId: wallet.userId,
      currency: currency as Currency,
      amount,
      type: "adjust",
      description:
        amount > 0
          ? `إضافة من الإدارة${actorEmail ? ` (${actorEmail})` : ""}`
          : `خصم من الإدارة${actorEmail ? ` (${actorEmail})` : ""}`,
      refId: `owner-grant`,
    });

    const displayName = await resolveDisplayName(updated.userId);
    res.json(
      GrantCoinsResponse.parse({
        userId: updated.userId,
        publicId: updated.publicId ?? "",
        displayName,
        coins: updated.coins,
        vPoints: updated.vPoints,
      }),
    );
  },
);

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

router.post("/admins/media", requireAdmin, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const parsed = UploadStoreAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!isStorageConfigured()) {
    res.status(400).json({ error: "خدمة الملفات غير مهيأة على الخادم" });
    return;
  }
  try {
    const url = await uploadStoreAsset(userId, parsed.data.data);
    res.status(201).json({ url });
  } catch (err) {
    if (err instanceof UploadError) {
      // Carries the specific reason — wrong format, too big — so the admin
      // can fix the file instead of guessing.
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;
