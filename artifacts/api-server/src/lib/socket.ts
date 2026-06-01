import type { Server as HttpServer } from "node:http";
import { eq, desc } from "drizzle-orm";
import { Server } from "socket.io";
import { db, messagesTable } from "@workspace/db";
import { logger } from "./logger";
import { joinGame, startGame, submitAnswer, leaveGame, markDisconnected } from "./gameSession";

interface JoinPayload {
  roomId: string;
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

    socket.on("room:join", async ({ roomId }: JoinPayload) => {
      if (!roomId) return;
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
