import type { Server as HttpServer } from "node:http";
import { eq, desc, and } from "drizzle-orm";
import { Server } from "socket.io";
import {
  db,
  messagesTable,
  storeItemsTable,
  userItemsTable,
  hostsTable,
  hostSessionsTable,
} from "@workspace/db";
import { logger } from "./logger";
import {
  joinLudo,
  startLudo,
  rollLudo,
  moveLudo,
  leaveLudo,
  markLudoDisconnected,
} from "./ludoSession";
import { joinMic, leaveMic, setMute, emitSnapshot } from "./roomVoice";
import { adjustWallet, giftEarnings, InsufficientBalanceError } from "./wallet";
import { verifySessionToken } from "./authz";
import { activeBan, isKickedFromRoom } from "./safety";
import { sendDm, shapeForUser, DmValidationError } from "./dm";
import { pushToUser } from "./push";
import { getSettings } from "./settings";
import { recordVoiceSeconds } from "./voiceUsage";

interface JoinPayload {
  roomId: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
}

interface GiftSendPayload {
  roomId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  itemId: number;
  toUserId?: string;
  toName?: string;
}

interface SendPayload {
  roomId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
}

interface LudoJoinBase {
  gameId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
}

interface MicJoinPayload {
  roomId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
}

interface MicLeavePayload {
  roomId: string;
  userId: string;
}

interface MicMutePayload {
  roomId: string;
  userId: string;
  muted: boolean;
}

interface LudoJoinPayload extends LudoJoinBase {
  // Only honoured when the payload opens the table; an existing game keeps
  // the size and format it was created with.
  mode?: 2 | 4;
  teams?: boolean;
}

interface DmSendPayload {
  toUserId: string;
  toName?: string;
  toAvatar?: string;
  text: string;
  userName?: string;
  userAvatar?: string;
}

const MAX_HISTORY = 50;
// Stints shorter than this are noise (a mis-tap, a reconnect) and are dropped
// rather than padding a host's paid hours.
const MIN_HOST_STINT_MS = 60_000;

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

/**
 * Record how long a paid host stayed in a room. Called when they leave or
 * disconnect; the row is what the admin screen totals into weekly hours.
 */
async function closeHostStint(
  userId: string,
  roomId: string,
  startedAt: Date,
): Promise<void> {
  const elapsed = Date.now() - startedAt.getTime();
  if (elapsed < MIN_HOST_STINT_MS) return;
  try {
    const [host] = await db
      .select({ id: hostsTable.id })
      .from(hostsTable)
      .where(and(eq(hostsTable.userId, userId), eq(hostsTable.active, true)))
      .limit(1);
    if (!host) return;
    await db.insert(hostSessionsTable).values({
      userId,
      roomId,
      startedAt,
      endedAt: new Date(),
      minutes: Math.round(elapsed / 60_000),
    });
  } catch (err) {
    logger.error({ err, userId, roomId }, "Failed to record host session");
  }
}

/**
 * The live server, so HTTP handlers can read room occupancy.
 *
 * Occupancy lives in the Socket.io adapter, which is per-process memory. That
 * is fine on a single instance — what Render runs — but a second replica would
 * only ever see its own half of the connections. Moving to more than one
 * instance means moving this to Redis, or to the database.
 */
let ioRef: Server | null = null;

/** How many sockets are currently in a room. Zero when nobody is connected. */
export function roomOccupancy(roomId: string): number {
  return ioRef?.sockets.adapter.rooms.get(roomChannel(roomId))?.size ?? 0;
}

/** Occupancy for many rooms at once, keyed by room id. */
export function roomOccupancies(roomIds: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of roomIds) out.set(id, roomOccupancy(id));
  return out;
}

export function attachSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: "/api/socket.io",
    cors: { origin: "*" },
    serveClient: false,
  });
  ioRef = io;

  function presenceCount(channel: string): number {
    return io.sockets.adapter.rooms.get(channel)?.size ?? 0;
  }

  // Authenticate the handshake: every socket must present a valid Clerk session
  // token. The verified user id becomes the socket's identity for all
  // money/identity-sensitive events; client-supplied userId fields are only
  // ever used for display.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const userId = token ? await verifySessionToken(token) : null;
    if (!userId) {
      next(new Error("unauthorized"));
      return;
    }
    // A suspended account gets no live connection at all, so a ban also cuts
    // off chat, mics and gifts — not just REST calls.
    if (await activeBan(userId)) {
      next(new Error("banned"));
      return;
    }
    socket.data.userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    const authUserId = socket.data.userId as string;
    let joinedRoom: string | null = null;
    let voiceUserId: string | null = null;
    // When this socket entered its current room, used to bill host time.
    let roomEnteredAt: Date | null = null;

    // Personal channel: every socket of this user receives their DMs, so
    // delivery works across devices and outside any specific room.
    void socket.join(`user:${authUserId}`);

    // Deterministically leave the socket's current room: free its mic seat,
    // leave the channel, and refresh presence. Prevents ghost seats when a
    // user switches rooms or disconnects.
    async function leaveCurrentRoom(): Promise<void> {
      if (!joinedRoom) return;
      const previous = joinedRoom;
      const channel = roomChannel(previous);
      if (roomEnteredAt) {
        void closeHostStint(authUserId, previous, roomEnteredAt);
        // Agora bills per participant, and everyone in a room is on the voice
        // channel — so a listener costs exactly what a speaker costs.
        void recordVoiceSeconds((Date.now() - roomEnteredAt.getTime()) / 1000);
        roomEnteredAt = null;
      }
      if (voiceUserId) {
        leaveMic(io, previous, voiceUserId);
        voiceUserId = null;
      }
      joinedRoom = null;
      await socket.leave(channel);
      io.to(channel).emit("room:presence", { roomId: previous, count: presenceCount(channel) });
    }

    socket.on("room:join", async ({ roomId, userName, userAvatar }: JoinPayload) => {
      if (!roomId) return;
      const userId = authUserId;
      // Enforce room removals here, not only at kick time, so someone who was
      // removed cannot simply rejoin.
      if (await isKickedFromRoom(roomId, userId)) {
        socket.emit("room:kicked", {
          roomId,
          message: "تم إخراجك من هذه الغرفة مؤقتاً",
        });
        return;
      }
      if (joinedRoom && joinedRoom !== roomId) await leaveCurrentRoom();
      joinedRoom = roomId;
      roomEnteredAt = new Date();
      const channel = roomChannel(roomId);
      await socket.join(channel);

      try {
        const rows = await db
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.roomId, roomId))
          .orderBy(desc(messagesTable.createdAt))
          .limit(MAX_HISTORY);
        socket.emit("room:history", rows.reverse());
      } catch (err) {
        logger.error({ err, roomId }, "Failed to load chat history");
        socket.emit("room:history", []);
      }

      io.to(channel).emit("room:presence", { roomId, count: presenceCount(channel) });
      emitSnapshot(socket, roomId);

      // Play the joining user's equipped entrance effect for everyone in the
      // room, unless they chose to enter quietly. Checking the preference
      // first also skips the heavier two-table lookup below.
      if (userId && !(await getSettings(userId)).invisibleRoomEntry) {
        try {
          const [entrance] = await db
            .select({
              name: storeItemsTable.name,
              color: storeItemsTable.color,
              icon: storeItemsTable.icon,
              mediaUrl: storeItemsTable.mediaUrl,
            })
            .from(userItemsTable)
            .innerJoin(storeItemsTable, eq(userItemsTable.itemId, storeItemsTable.id))
            .where(
              and(
                eq(userItemsTable.userId, userId),
                eq(userItemsTable.equipped, true),
                eq(storeItemsTable.itemType, "entrance"),
              ),
            )
            .limit(1);

          if (entrance) {
            io.to(channel).emit("room:entrance", {
              roomId,
              userId,
              userName: userName ?? "",
              userAvatar: userAvatar ?? "",
              entrance,
            });
          }
        } catch (err) {
          logger.error({ err, roomId, userId }, "Failed to resolve entrance effect");
        }
      }
    });

    socket.on("gift:send", async (payload: GiftSendPayload) => {
      const { roomId, userName, itemId } = payload;
      const userId = authUserId;
      if (!roomId || !itemId) return;
      if (!socket.rooms.has(roomChannel(roomId))) return;

      try {
        const [item] = await db
          .select()
          .from(storeItemsTable)
          .where(eq(storeItemsTable.id, itemId))
          .limit(1);
        if (!item || !item.active || item.itemType !== "gift") {
          socket.emit("gift:error", { message: "الهدية غير متوفرة" });
          return;
        }

        const wallet = await adjustWallet({
          userId,
          currency: "coins",
          amount: -item.price,
          type: "gift_sent",
          description: `هدية ${item.name}${payload.toName ? ` إلى ${payload.toName}` : ""}`,
          refId: String(item.id),
        });

        // Credit the recipient their share as vPoints. Only after the sender's
        // debit succeeded, and never to the sender themselves.
        const toUserId = payload.toUserId;
        if (toUserId && toUserId !== userId) {
          try {
            const [host] = await db
              .select({ bonus: hostsTable.bonusSharePercent })
              .from(hostsTable)
              .where(and(eq(hostsTable.userId, toUserId), eq(hostsTable.active, true)))
              .limit(1);
            const earned = giftEarnings(item.price, host?.bonus ?? 0);
            if (earned > 0) {
              const recipient = await adjustWallet({
                userId: toUserId,
                currency: "V",
                amount: earned,
                type: "gift_received",
                description: `هدية ${item.name} من ${userName}`,
                refId: String(item.id),
              });
              io.to(`user:${toUserId}`).emit("wallet:update", {
                userId: toUserId,
                coins: recipient.coins,
                vPoints: recipient.vPoints,
              });
            }
          } catch (err) {
            // The sender already paid; a failed payout must not undo the gift.
            logger.error({ err, toUserId }, "Failed to credit gift recipient");
          }
        }

        io.to(roomChannel(roomId)).emit("gift:new", {
          roomId,
          fromUserId: userId,
          fromName: userName,
          fromAvatar: payload.userAvatar ?? "",
          toName: payload.toName ?? "",
          gift: {
            id: item.id,
            name: item.name,
            color: item.color,
            icon: item.icon,
            mediaUrl: item.mediaUrl,
            price: item.price,
          },
        });

        socket.emit("wallet:update", { userId, coins: wallet.coins, vPoints: wallet.vPoints });
      } catch (err) {
        if (err instanceof InsufficientBalanceError) {
          socket.emit("gift:error", { message: "رصيد الكوينزات غير كافٍ" });
          return;
        }
        logger.error({ err, roomId, userId }, "Failed to send gift");
        socket.emit("gift:error", { message: "تعذّر إرسال الهدية" });
      }
    });

    socket.on("mic:join", ({ roomId, userName, userAvatar }: MicJoinPayload) => {
      const userId = authUserId;
      if (!roomId) return;
      // Must be in this room. Bind the seat to this socket's identity.
      if (roomId !== joinedRoom || !socket.rooms.has(roomChannel(roomId))) return;
      voiceUserId = userId;
      const ok = joinMic(io, roomId, {
        userId,
        userName,
        userAvatar: userAvatar ?? "",
        muted: false,
      });
      if (!ok) {
        voiceUserId = null;
        socket.emit("mic:full", { roomId });
      }
    });

    socket.on("mic:leave", ({ roomId }: MicLeavePayload) => {
      // Only act on this socket's own seat in its current room.
      if (roomId !== joinedRoom || !voiceUserId) return;
      leaveMic(io, roomId, voiceUserId);
      voiceUserId = null;
    });

    socket.on("mic:mute", ({ roomId, muted }: MicMutePayload) => {
      // Only act on this socket's own seat in its current room.
      if (roomId !== joinedRoom || !voiceUserId) return;
      setMute(io, roomId, voiceUserId, !!muted);
    });

    socket.on("room:leave", () => {
      void leaveCurrentRoom();
    });

    socket.on("message:send", async (payload: SendPayload) => {
      const { roomId, userName, text } = payload;
      const userId = authUserId;
      if (!roomId || !text?.trim()) return;
      // Only allow posting to a room this socket has actually joined.
      if (!socket.rooms.has(roomChannel(roomId))) return;
      try {
        const [saved] = await db
          .insert(messagesTable)
          .values({
            roomId,
            userId,
            userName,
            userAvatar: payload.userAvatar ?? "",
            text: text.trim(),
          })
          .returning();
        io.to(roomChannel(roomId)).emit("message:new", saved);
      } catch (err) {
        logger.error({ err, roomId }, "Failed to save message");
        socket.emit("message:error", { message: "تعذّر إرسال الرسالة" });
      }
    });

    socket.on("dm:send", async (payload: DmSendPayload) => {
      const { toUserId, text } = payload;
      if (!toUserId || !text?.trim()) return;
      try {
        // Sender identity comes from the authenticated socket; payload names
        // are display-only snapshots.
        const { message, conversation } = await sendDm({
          fromUserId: authUserId,
          fromName: payload.userName ?? "",
          fromAvatar: payload.userAvatar ?? "",
          toUserId,
          toName: payload.toName,
          toAvatar: payload.toAvatar,
          text,
        });
        const wire = { ...message, createdAt: message.createdAt.toISOString() };
        io.to(`user:${toUserId}`).emit("dm:new", {
          message: wire,
          conversation: shapeForUser(conversation, toUserId),
        });
        // Reach them even when the app is closed — unless they silenced
        // direct-message notifications. Kept off the send path: the message
        // is already delivered, and a settings lookup must not delay it.
        void (async () => {
          if ((await getSettings(toUserId)).notifyDm === "none") return;
          await pushToUser(toUserId, {
            title: payload.userName || "رسالة جديدة",
            body: text.slice(0, 120),
            data: { type: "dm", conversationId: conversation.id },
          });
        })();
        io.to(`user:${authUserId}`).emit("dm:new", {
          message: wire,
          conversation: shapeForUser(conversation, authUserId),
        });
      } catch (err) {
        if (err instanceof DmValidationError) {
          socket.emit("dm:error", { message: err.message });
          return;
        }
        logger.error({ err, toUserId }, "Failed to send DM");
        socket.emit("dm:error", { message: "تعذّر إرسال الرسالة" });
      }
    });

    let joinedLudo: string | null = null;
    let ludoUserId: string | null = null;

    socket.on(
      "ludo:join",
      ({ gameId, userName, userAvatar, mode, teams }: LudoJoinPayload) => {
        const userId = authUserId;
        if (!gameId) return;
        joinedLudo = gameId;
        ludoUserId = userId;
        void socket.join(`ludo:${gameId}`);
        joinLudo(
          io,
          socket,
          gameId,
          { userId, userName, userAvatar: userAvatar ?? "" },
          mode === 2 ? 2 : 4,
          teams === true,
        );
      },
    );

    socket.on("ludo:start", ({ gameId }: { gameId: string }) => {
      const userId = authUserId;
      if (!gameId) return;
      startLudo(io, gameId, userId);
    });

    socket.on("ludo:roll", ({ gameId }: { gameId: string }) => {
      const userId = authUserId;
      if (!gameId) return;
      rollLudo(io, gameId, userId);
    });

    socket.on(
      "ludo:move",
      ({ gameId, tokenIndex }: { gameId: string; tokenIndex: number }) => {
        const userId = authUserId;
        if (!gameId || typeof tokenIndex !== "number") return;
        moveLudo(io, gameId, userId, tokenIndex);
      },
    );

    socket.on("ludo:leave", ({ gameId }: { gameId: string }) => {
      const userId = authUserId;
      if (!gameId) return;
      leaveLudo(io, gameId, userId);
      void socket.leave(`ludo:${gameId}`);
      joinedLudo = null;
      ludoUserId = null;
    });

    socket.on("disconnect", () => {
      if (joinedRoom) {
        if (roomEnteredAt) {
          void closeHostStint(authUserId, joinedRoom, roomEnteredAt);
          void recordVoiceSeconds((Date.now() - roomEnteredAt.getTime()) / 1000);
          roomEnteredAt = null;
        }
        if (voiceUserId) leaveMic(io, joinedRoom, voiceUserId);
        const channel = roomChannel(joinedRoom);
        io.to(channel).emit("room:presence", { roomId: joinedRoom, count: presenceCount(channel) });
      }
      if (joinedLudo && ludoUserId) {
        markLudoDisconnected(io, joinedLudo, ludoUserId);
      }
    });
  });

  logger.info("Socket.io server attached at /api/socket.io");
  return io;
}
