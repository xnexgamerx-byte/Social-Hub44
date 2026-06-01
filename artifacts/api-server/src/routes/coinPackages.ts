import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, coinPackagesTable } from "@workspace/db";
import {
  CreateCoinPackageBody,
  UpdateCoinPackageBody,
  UpdateCoinPackageParams,
  DeleteCoinPackageParams,
  ListCoinPackagesResponse,
  ListCoinPackagesResponseItem,
  UpdateCoinPackageResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/coin-packages", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(coinPackagesTable)
    .orderBy(coinPackagesTable.sortOrder, coinPackagesTable.id);
  res.json(ListCoinPackagesResponse.parse(rows));
});

router.post("/coin-packages", async (req, res): Promise<void> => {
  const parsed = CreateCoinPackageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(coinPackagesTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(ListCoinPackagesResponseItem.parse(row));
});

router.patch("/coin-packages/:id", async (req, res): Promise<void> => {
  const params = UpdateCoinPackageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCoinPackageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(coinPackagesTable)
    .set(parsed.data)
    .where(eq(coinPackagesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Coin package not found" });
    return;
  }
  res.json(UpdateCoinPackageResponse.parse(row));
});

router.delete("/coin-packages/:id", async (req, res): Promise<void> => {
  const params = DeleteCoinPackageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(coinPackagesTable)
    .where(eq(coinPackagesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Coin package not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
