import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import {
  GetMySettingsResponse,
  UpdateMySettingsBody,
  UpdateMySettingsResponse,
  GetSupportContactResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/authz";
import { getSettings, updateSettings } from "../lib/settings";
import { OFFICIAL_USER_ID, ensureOfficialProfile } from "../lib/official";

const router: IRouter = Router();

// Path-scoped so the guard cannot leak onto routers mounted after this one.
router.use("/settings", requireAuth);
router.use("/support", requireAuth);

router.get("/settings", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  // Reads never create a row; an account that has never opened the settings
  // screen gets the same defaults the server actually applies.
  res.json(GetMySettingsResponse.parse(await getSettings(userId)));
});

router.patch("/settings", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const parsed = UpdateMySettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Only the keys present in the body are written — omitting a field leaves
  // it alone rather than resetting it.
  res.json(UpdateMySettingsResponse.parse(await updateSettings(userId, parsed.data)));
});

router.get("/support/contact", async (_req, res): Promise<void> => {
  // Guarantees the row exists even on a database that predates the welcome
  // flow, so the support screen always has somewhere to send the user.
  await ensureOfficialProfile();
  const [row] = await db
    .select({ name: profilesTable.name, avatar: profilesTable.avatar })
    .from(profilesTable)
    .where(eq(profilesTable.userId, OFFICIAL_USER_ID))
    .limit(1);
  res.json(
    GetSupportContactResponse.parse({
      userId: OFFICIAL_USER_ID,
      name: row?.name ?? "",
      avatar: row?.avatar ?? "",
    }),
  );
});

export default router;
