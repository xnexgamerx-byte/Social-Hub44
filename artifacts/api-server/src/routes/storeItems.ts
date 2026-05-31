import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, storeItemsTable } from "@workspace/db";
import {
  CreateStoreItemBody,
  UpdateStoreItemBody,
  UpdateStoreItemParams,
  DeleteStoreItemParams,
  ListStoreItemsResponse,
  ListStoreItemsResponseItem,
  UpdateStoreItemResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/store-items", async (_req, res): Promise<void> => {
  const items = await db
    .select()
    .from(storeItemsTable)
    .orderBy(storeItemsTable.sortOrder, storeItemsTable.id);
  res.json(ListStoreItemsResponse.parse(items));
});

router.post("/store-items", async (req, res): Promise<void> => {
  const parsed = CreateStoreItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db
    .insert(storeItemsTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(ListStoreItemsResponseItem.parse(item));
});

router.patch("/store-items/:id", async (req, res): Promise<void> => {
  const params = UpdateStoreItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateStoreItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db
    .update(storeItemsTable)
    .set(parsed.data)
    .where(eq(storeItemsTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Store item not found" });
    return;
  }
  res.json(UpdateStoreItemResponse.parse(item));
});

router.delete("/store-items/:id", async (req, res): Promise<void> => {
  const params = DeleteStoreItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db
    .delete(storeItemsTable)
    .where(eq(storeItemsTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Store item not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
