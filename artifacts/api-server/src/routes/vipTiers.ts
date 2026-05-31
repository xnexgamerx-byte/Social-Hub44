import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, vipTiersTable } from "@workspace/db";
import {
  CreateVipTierBody,
  UpdateVipTierBody,
  UpdateVipTierParams,
  DeleteVipTierParams,
  ListVipTiersResponse,
  ListVipTiersResponseItem,
  UpdateVipTierResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/vip-tiers", async (_req, res): Promise<void> => {
  const tiers = await db
    .select()
    .from(vipTiersTable)
    .orderBy(vipTiersTable.type, vipTiersTable.level);
  res.json(ListVipTiersResponse.parse(tiers));
});

router.post("/vip-tiers", async (req, res): Promise<void> => {
  const parsed = CreateVipTierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tier] = await db.insert(vipTiersTable).values(parsed.data).returning();
  res.status(201).json(ListVipTiersResponseItem.parse(tier));
});

router.patch("/vip-tiers/:id", async (req, res): Promise<void> => {
  const params = UpdateVipTierParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateVipTierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tier] = await db
    .update(vipTiersTable)
    .set(parsed.data)
    .where(eq(vipTiersTable.id, params.data.id))
    .returning();
  if (!tier) {
    res.status(404).json({ error: "VIP tier not found" });
    return;
  }
  res.json(UpdateVipTierResponse.parse(tier));
});

router.delete("/vip-tiers/:id", async (req, res): Promise<void> => {
  const params = DeleteVipTierParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [tier] = await db
    .delete(vipTiersTable)
    .where(eq(vipTiersTable.id, params.data.id))
    .returning();
  if (!tier) {
    res.status(404).json({ error: "VIP tier not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
