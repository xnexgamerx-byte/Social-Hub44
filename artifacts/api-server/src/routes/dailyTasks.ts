import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, dailyTasksTable } from "@workspace/db";
import {
  CreateDailyTaskBody,
  UpdateDailyTaskBody,
  UpdateDailyTaskParams,
  DeleteDailyTaskParams,
  ListDailyTasksResponse,
  ListDailyTasksResponseItem,
  UpdateDailyTaskResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/authz";

const router: IRouter = Router();

router.get("/daily-tasks", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(dailyTasksTable)
    .orderBy(dailyTasksTable.sortOrder, dailyTasksTable.id);
  res.json(ListDailyTasksResponse.parse(rows));
});

router.post("/daily-tasks", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateDailyTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(dailyTasksTable).values(parsed.data).returning();
  res.status(201).json(ListDailyTasksResponseItem.parse(row));
});

router.patch("/daily-tasks/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateDailyTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateDailyTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(dailyTasksTable)
    .set(parsed.data)
    .where(eq(dailyTasksTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Daily task not found" });
    return;
  }
  res.json(UpdateDailyTaskResponse.parse(row));
});

router.delete("/daily-tasks/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteDailyTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(dailyTasksTable)
    .where(eq(dailyTasksTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Daily task not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
