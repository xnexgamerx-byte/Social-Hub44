import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { GetAuthMeResponse } from "@workspace/api-zod";
import { isAdminUserId, isOwnerUserId } from "../lib/authz";

const router: IRouter = Router();

router.get("/auth/me", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "يجب تسجيل الدخول" });
    return;
  }
  const [isAdmin, isOwner] = await Promise.all([
    isAdminUserId(userId),
    isOwnerUserId(userId),
  ]);
  res.json(GetAuthMeResponse.parse({ userId, isAdmin, isOwner }));
});

export default router;
