import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db, roomsTable, walletsTable } from "@workspace/db";
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
import { roomOccupancies } from "../lib/socket";
import { roomLimitForLevel } from "../lib/levelPerks";
import { levelForXp } from "../lib/wallet";

// Cap rooms per user so a single account cannot flood the directory. The
// ceiling rises with the owner's level — one of the few things the level
// actually unlocks.
// Ceiling on one directory page, so the list cannot grow without bound.
const MAX_LIST = 100;

const router: IRouter = Router();

function serialize(room: typeof roomsTable.$inferSelect, listeners = 0) {
  return { ...room, createdAt: room.createdAt.toISOString(), listeners };
}

/**
 * Attach live occupancy and sort busy rooms first.
 *
 * A directory that lists dead rooms above live ones makes every tap a gamble,
 * which is the single thing that empties a voice app. Ordering is by people
 * present, then by newest.
 */
async function withListeners(rooms: (typeof roomsTable.$inferSelect)[]) {
  const counts = roomOccupancies(rooms.map((r) => String(r.id)));

  // Owner level breaks ties between equally busy rooms — the "priority in the
  // room list" the level screen promises. One query for the page, not one per
  // room.
  const ownerIds = [...new Set(rooms.map((r) => r.ownerId))];
  const levels = new Map<string, number>();
  if (ownerIds.length > 0) {
    const wallets = await db
      .select({ userId: walletsTable.userId, xp: walletsTable.xp })
      .from(walletsTable)
      .where(inArray(walletsTable.userId, ownerIds));
    for (const w of wallets) levels.set(w.userId, levelForXp(w.xp));
  }

  return rooms
    .map((r) => serialize(r, counts.get(String(r.id)) ?? 0))
    .sort((a, b) => {
      if (b.listeners !== a.listeners) return b.listeners - a.listeners;
      return (levels.get(b.ownerId) ?? 0) - (levels.get(a.ownerId) ?? 0);
    });
}

/** Escape the wildcards so a search for "%" does not match everything. */
function likeTerm(q: string): string {
  return `%${q.trim().replace(/[%_]/g, (c) => "\\" + c)}%`;
}

router.get("/rooms", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const category = typeof req.query.category === "string" ? req.query.category.trim() : "";

  const filters = [eq(roomsTable.active, true)];
  if (category) filters.push(eq(roomsTable.category, category));
  if (q) {
    const term = likeTerm(q);
    // Owner name included: people look for a room by who runs it as often as
    // by what it is called.
    filters.push(
      or(
        ilike(roomsTable.name, term),
        ilike(roomsTable.description, term),
        ilike(roomsTable.ownerName, term),
      )!,
    );
  }

  const rooms = await db
    .select()
    .from(roomsTable)
    .where(and(...filters))
    .orderBy(desc(roomsTable.createdAt))
    .limit(MAX_LIST);
  res.json(ListRoomsResponse.parse(await withListeners(rooms)));
});

// NOTE: must be declared before /rooms/:id so "mine" is not parsed as an id.
router.get("/rooms/mine", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const rooms = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.ownerId, userId))
    .orderBy(desc(roomsTable.createdAt));
  res.json(ListRoomsResponse.parse(await withListeners(rooms)));
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
  const [wallet] = await db
    .select({ xp: walletsTable.xp })
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .limit(1);
  const limit = roomLimitForLevel(levelForXp(wallet?.xp ?? 0));
  if (mine.length >= limit) {
    res.status(400).json({ error: `الحد الأقصى ${limit} غرف — ارفع مستواك لفتح المزيد` });
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
