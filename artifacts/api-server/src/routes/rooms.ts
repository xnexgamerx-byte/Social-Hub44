import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, roomsTable } from "@workspace/db";
import {
  CreateRoomBody,
  UpdateRoomBody,
  UpdateRoomParams,
  GetRoomParams,
  DeleteRoomParams,
  ListRoomsResponse,
  ListRoomsResponseItem,
  UpdateRoomResponse,
} from "@workspace/api-zod";
import { requireAuth, isAdminUserId, type AuthedRequest } from "../lib/authz";

// Cap rooms per user so a single account cannot flood the directory.
const MAX_ROOMS_PER_USER = 3;

const router: IRouter = Router();

function serialize(room: typeof roomsTable.$inferSelect) {
  return { ...room, createdAt: room.createdAt.toISOString() };
}

router.get("/rooms", async (_req, res): Promise<void> => {
  const rooms = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.active, true))
    .orderBy(desc(roomsTable.createdAt));
  res.json(ListRoomsResponse.parse(rooms.map(serialize)));
});

// NOTE: must be declared before /rooms/:id so "mine" is not parsed as an id.
router.get("/rooms/mine", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const rooms = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.ownerId, userId))
    .orderBy(desc(roomsTable.createdAt));
  res.json(ListRoomsResponse.parse(rooms.map(serialize)));
});

router.get("/rooms/:id", async (req, res): Promise<void> => {
  const params = GetRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [room] = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.id, params.data.id))
    .limit(1);
  if (!room) {
    res.status(404).json({ error: "الغرفة غير موجودة" });
    return;
  }
  res.json(ListRoomsResponseItem.parse(serialize(room)));
});

router.post("/rooms", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const mine = await db
    .select({ id: roomsTable.id })
    .from(roomsTable)
    .where(and(eq(roomsTable.ownerId, userId), eq(roomsTable.active, true)));
  if (mine.length >= MAX_ROOMS_PER_USER) {
    res.status(400).json({ error: `الحد الأقصى ${MAX_ROOMS_PER_USER} غرف لكل مستخدم` });
    return;
  }
  const { name, description, category, tags, ownerName, ownerAvatar } = parsed.data;
  const [room] = await db
    .insert(roomsTable)
    .values({
      name: name.trim(),
      description: (description ?? "").trim(),
      category: category ?? "chat",
      tags: tags ?? [],
      // The owner is always the authenticated user; the body cannot override it.
      ownerId: userId,
      ownerName: ownerName ?? "",
      ownerAvatar: ownerAvatar ?? "",
    })
    .returning();
  res.status(201).json(ListRoomsResponseItem.parse(serialize(room)));
});

router.patch("/rooms/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const params = UpdateRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "الغرفة غير موجودة" });
    return;
  }
  if (existing.ownerId !== userId && !(await isAdminUserId(userId))) {
    res.status(403).json({ error: "فقط مالك الغرفة يمكنه تعديلها" });
    return;
  }
  const [room] = await db
    .update(roomsTable)
    .set(parsed.data)
    .where(eq(roomsTable.id, params.data.id))
    .returning();
  res.json(UpdateRoomResponse.parse(serialize(room)));
});

router.delete("/rooms/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const params = DeleteRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "الغرفة غير موجودة" });
    return;
  }
  if (existing.ownerId !== userId && !(await isAdminUserId(userId))) {
    res.status(403).json({ error: "فقط مالك الغرفة يمكنه حذفها" });
    return;
  }
  await db.delete(roomsTable).where(eq(roomsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
