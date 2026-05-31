import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, vipFeaturesTable } from "@workspace/db";
import {
  CreateVipFeatureBody,
  UpdateVipFeatureBody,
  UpdateVipFeatureParams,
  DeleteVipFeatureParams,
  ListVipFeaturesResponse,
  ListVipFeaturesResponseItem,
  UpdateVipFeatureResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/vip-features", async (_req, res): Promise<void> => {
  const features = await db
    .select()
    .from(vipFeaturesTable)
    .orderBy(vipFeaturesTable.sortOrder, vipFeaturesTable.id);
  res.json(ListVipFeaturesResponse.parse(features));
});

router.post("/vip-features", async (req, res): Promise<void> => {
  const parsed = CreateVipFeatureBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [feature] = await db
    .insert(vipFeaturesTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(ListVipFeaturesResponseItem.parse(feature));
});

router.patch("/vip-features/:id", async (req, res): Promise<void> => {
  const params = UpdateVipFeatureParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateVipFeatureBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [feature] = await db
    .update(vipFeaturesTable)
    .set(parsed.data)
    .where(eq(vipFeaturesTable.id, params.data.id))
    .returning();
  if (!feature) {
    res.status(404).json({ error: "VIP feature not found" });
    return;
  }
  res.json(UpdateVipFeatureResponse.parse(feature));
});

router.delete("/vip-features/:id", async (req, res): Promise<void> => {
  const params = DeleteVipFeatureParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [feature] = await db
    .delete(vipFeaturesTable)
    .where(eq(vipFeaturesTable.id, params.data.id))
    .returning();
  if (!feature) {
    res.status(404).json({ error: "VIP feature not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
