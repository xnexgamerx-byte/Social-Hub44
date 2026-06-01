import type { Server as HttpServer } from "node:http";
import { eq, desc, and } from "drizzle-orm";
import { Server } from "socket.io";
import {
  db,
  messagesTable,
  storeItemsTable,
  userItemsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { joinGame, startGame, submitAnswer, leaveGame, markDisconnected } from "./gameSession";
import { joinMic, leaveMic, setMute, emitSnapshot } from "./roomVoice";
import { adjustWallet, InsufficientBalanceError } from "./wallet";

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

interface GameJoinPayload {
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

const MAX_HISTORY = 50;

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

export function attachSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: "/api/socket.io",
    cors: { origin: "*" },
    serveClient: false,
  });

  function presenceCount(channel: string): number {
    return io.sockets.adapter.rooms.get(channel)?.size ?? 0;
  }

  io.on("connection", (socket) => {
    let joinedRoom: string | null = null;
    let joinedGame: string | null = null;
    let voiceUserId: string | null = null;

    // Deterministically leave the socket's current room: free its mic seat,
    // leave the channel, and refresh presence. Prevents ghost seats when a
    // user switches rooms or disconnects.
    async function leaveCurrentRoom(): Promise<void> {
      if (!joinedRoom) return;
      const previous = joinedRoom;
      const channel = roomChannel(previous);
      if (voiceUserId) {
        leaveMic(io, previous, voiceUserId);
        voiceUserId = null;
      }
      joinedRoom = null;
      await socket.leave(channel);
      io.to(channel).emit("room:presence", { roomId: previous, count: presenceCount(channel) });
    }

    socket.on("room:join", async ({ roomId, userId, userName, userAvatar }: JoinPayload) => {
      if (!roomId) return;
      if (joinedRoom && joinedRoom !== roomId) await leaveCurrentRoom();
      joinedRoom = roomId;
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

      // Play the joining user's equipped entrance effect for everyone in the room.
      if (userId) {
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
      const { roomId, userId, userName, itemId } = payload;
      if (!roomId || !userId || !itemId) return;
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

    socket.on("mic:join", ({ roomId, userId, userName, userAvatar }: MicJoinPayload) => {
      if (!roomId || !userId) return;
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

    socket.on("mic:leave", ({ roomId, userId }: MicLeavePayload) => {
      // Only act on this socket's own seat in its current room.
      if (roomId !== joinedRoom || userId !== voiceUserId) return;
      leaveMic(io, roomId, userId);
      voiceUserId = null;
    });

    socket.on("mic:mute", ({ roomId, userId, muted }: MicMutePayload) => {
      // Only act on this socket's own seat in its current room.
      if (roomId !== joinedRoom || userId !== voiceUserId) return;
      setMute(io, roomId, userId, !!muted);
    });

    socket.on("room:leave", () => {
      void leaveCurrentRoom();
    });

    socket.on("message:send", async (payload: SendPayload) => {
      const { roomId, userId, userName, text } = payload;
      if (!roomId || !userId || !text?.trim()) return;
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

    let gameUserId: string | null = null;

    socket.on("game:join", ({ gameId, userId, userName, userAvatar }: GameJoinPayload) => {
      if (!gameId || !userId) return;
      joinedGame = gameId;
      gameUserId = userId;
      void socket.join(`game:${gameId}`);
      joinGame(io, socket, gameId, { userId, userName, userAvatar: userAvatar ?? "", score: 0 });
    });

    socket.on("game:start", ({ gameId }: { gameId: string }) => {
      if (!gameId) return;
      startGame(io, gameId);
    });

    socket.on("game:answer", ({ gameId, userId, choice }: { gameId: string; userId: string; choice: number }) => {
      if (!gameId || !userId) return;
      submitAnswer(io, gameId, userId, choice);
    });

    socket.on("game:leave", ({ gameId, userId }: { gameId: string; userId: string }) => {
      if (!gameId || !userId) return;
      leaveGame(io, gameId, userId);
      joinedGame = null;
      gameUserId = null;
    });

    socket.on("disconnect", () => {
      if (joinedRoom) {
        if (voiceUserId) leaveMic(io, joinedRoom, voiceUserId);
        const channel = roomChannel(joinedRoom);
        io.to(channel).emit("room:presence", { roomId: joinedRoom, count: presenceCount(channel) });
      }
      if (joinedGame && gameUserId) {
        markDisconnected(io, joinedGame, gameUserId);
      }
    });
  });

  logger.info("Socket.io server attached at /api/socket.io");
  return io;
}
