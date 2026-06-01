import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import type { Server as IOServer } from "socket.io";
import { eq, like } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Mock only the Clerk token verification so we control which handshakes are
// valid. A token of the form "valid:<userId>" verifies to that user id;
// anything else throws (treated as unauthorized). The real verifySessionToken
// wrapper, the handshake middleware, and all event handlers run unchanged.
vi.mock("@clerk/backend", () => ({
  verifyToken: async (token: string) => {
    if (typeof token === "string" && token.startsWith("valid:")) {
      return { sub: token.slice("valid:".length) };
    }
    throw new Error("invalid token");
  },
}));

import {
  db,
  messagesTable,
  storeItemsTable,
  walletsTable,
  walletTransactionsTable,
} from "@workspace/db";
import { attachSocketServer } from "./socket";
import { ensureWallet, WELCOME_COINS } from "./wallet";
import { leaveGame } from "./gameSession";

const TAG = `vitest_sock_${Date.now()}`;
const room = (suffix: string): string => `${TAG}_${suffix}`;
const tokenFor = (userId: string): string => `valid:${userId}`;

interface MicState {
  seats: Array<{ userId: string; muted: boolean }>;
}

let httpServer: HttpServer;
let io: IOServer;
let port: number;
const clients: ClientSocket[] = [];

beforeAll(async () => {
  httpServer = createServer();
  io = attachSocketServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, () => resolve()));
  port = (httpServer.address() as AddressInfo).port;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await db.delete(messagesTable).where(like(messagesTable.roomId, `${TAG}%`));
  await db.delete(walletTransactionsTable).where(like(walletTransactionsTable.userId, `${TAG}%`));
  await db.delete(walletsTable).where(like(walletsTable.userId, `${TAG}%`));
  await db.delete(storeItemsTable).where(like(storeItemsTable.name, `${TAG}%`));
});

afterAll(async () => {
  io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  // Note: do NOT close the @workspace/db pool here — Vitest tears down this
  // file's forked worker on completion, and other test files share the pool.
});

function connect(token?: string): ClientSocket {
  const socket = ioClient(`http://localhost:${port}`, {
    path: "/api/socket.io",
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    auth: token ? { token } : {},
  });
  clients.push(socket);
  return socket;
}

/** Resolve when the socket connects; reject on connect_error or timeout. */
function waitConnect(socket: ClientSocket, timeout = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }
    const cleanup = (): void => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
    };
    const onConnect = (): void => {
      cleanup();
      resolve();
    };
    const onError = (err: Error): void => {
      cleanup();
      reject(err);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("timed out waiting for connect"));
    }, timeout);
    socket.on("connect", onConnect);
    socket.on("connect_error", onError);
  });
}

/** Resolve with the next payload for `event`, or reject after `timeout`. */
function once<T = unknown>(socket: ClientSocket, event: string, timeout = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out waiting for "${event}"`)),
      timeout,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Resolve when an `event` payload satisfies `predicate` (ignores others). */
function waitFor<T = unknown>(
  socket: ClientSocket,
  event: string,
  predicate: (payload: T) => boolean,
  timeout = 3000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timed out waiting for matching "${event}"`));
    }, timeout);
    const handler = (payload: T): void => {
      if (predicate(payload)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      }
    };
    socket.on(event, handler);
  });
}

/** Reject if `event` fires within `ms`; resolve otherwise. */
function expectNoEvent(socket: ClientSocket, event: string, ms = 500): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = (payload: unknown): void => {
      clearTimeout(timer);
      socket.off(event, handler);
      reject(new Error(`unexpected "${event}": ${JSON.stringify(payload)}`));
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, ms);
    socket.on(event, handler);
  });
}

/** Join a room and wait for the history reply (listener registered before emit). */
async function joinRoom(socket: ClientSocket, roomId: string, userName: string): Promise<void> {
  const history = once(socket, "room:history");
  socket.emit("room:join", { roomId, userName });
  await history;
}

/** Take a mic seat and wait until the broadcast reflects this user's seat. */
async function takeMicSeat(
  socket: ClientSocket,
  roomId: string,
  userId: string,
  userName: string,
): Promise<void> {
  const seated = waitFor<MicState>(socket, "mic:state", (s) =>
    s.seats.some((x) => x.userId === userId),
  );
  socket.emit("mic:join", { roomId, userId, userName });
  await seated;
}

describe("socket handshake authentication", () => {
  it("rejects a connection with no token", async () => {
    const s = connect();
    await expect(waitConnect(s)).rejects.toThrow(/unauthorized/);
    expect(s.connected).toBe(false);
  });

  it("rejects a connection with an invalid token", async () => {
    const s = connect("not-a-real-token");
    await expect(waitConnect(s)).rejects.toThrow(/unauthorized/);
    expect(s.connected).toBe(false);
  });

  it("accepts a connection with a valid token", async () => {
    const s = connect(tokenFor("user_a"));
    await expect(waitConnect(s)).resolves.toBeUndefined();
    expect(s.connected).toBe(true);
  });
});

describe("socket identity cannot be spoofed", () => {
  it("uses the authenticated user id for chat, ignoring a spoofed payload userId", async () => {
    const a = connect(tokenFor("user_a"));
    await waitConnect(a);
    const r = room("chat_identity");
    await joinRoom(a, r, "A");

    const incoming = once<{ userId: string; text: string }>(a, "message:new");
    a.emit("message:send", {
      roomId: r,
      userId: "user_victim", // spoofed — must be ignored
      userName: "A",
      text: "hello",
    });
    const msg = await incoming;
    expect(msg.userId).toBe("user_a");

    const rows = await db.select().from(messagesTable).where(eq(messagesTable.roomId, r));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((m) => m.userId === "user_a")).toBe(true);
  });

  it("binds a mic seat to the authenticated user id, ignoring a spoofed payload userId", async () => {
    const a = connect(tokenFor("user_a"));
    await waitConnect(a);
    const r = room("mic_identity");
    await joinRoom(a, r, "A");

    const state = waitFor<MicState>(a, "mic:state", (s) => s.seats.length === 1);
    a.emit("mic:join", { roomId: r, userId: "user_victim", userName: "A" });
    const result = await state;
    expect(result.seats).toHaveLength(1);
    expect(result.seats[0]?.userId).toBe("user_a");
  });

  it("does not let a user mute or remove another user's mic seat by spoofing userId", async () => {
    const a = connect(tokenFor("user_a"));
    const b = connect(tokenFor("user_b"));
    await Promise.all([waitConnect(a), waitConnect(b)]);
    const r = room("mic_control");
    await joinRoom(a, r, "A");
    await joinRoom(b, r, "B");

    await takeMicSeat(a, r, "user_a", "A");
    const bothSeated = waitFor<MicState>(b, "mic:state", (s) => s.seats.length === 2);
    b.emit("mic:join", { roomId: r, userId: "user_b", userName: "B" });
    await bothSeated;

    // B tries to mute A by spoofing the payload userId. The server keys off B's
    // own seat, so B mutes itself — A stays unmuted.
    const afterMute = waitFor<MicState>(a, "mic:state", (s) =>
      s.seats.some((x) => x.muted),
    );
    b.emit("mic:mute", { roomId: r, userId: "user_a", muted: true });
    const muted = await afterMute;
    expect(muted.seats.find((x) => x.userId === "user_a")?.muted).toBe(false);
    expect(muted.seats.find((x) => x.userId === "user_b")?.muted).toBe(true);

    // B tries to kick A via mic:leave with a spoofed userId. Again it only frees
    // B's own seat; A remains on the stage.
    const afterLeave = waitFor<MicState>(a, "mic:state", (s) =>
      !s.seats.some((x) => x.userId === "user_b"),
    );
    b.emit("mic:leave", { roomId: r, userId: "user_a" });
    const left = await afterLeave;
    expect(left.seats.some((x) => x.userId === "user_a")).toBe(true);
    expect(left.seats.some((x) => x.userId === "user_b")).toBe(false);
  });

  it("charges the authenticated sender for a gift, ignoring a spoofed payload userId", async () => {
    const gifterId = `${TAG}_gifter`;
    await ensureWallet(gifterId); // seeds the fixed welcome balance
    const [gift] = await db
      .insert(storeItemsTable)
      .values({
        name: `${TAG}_gift`,
        category: "هدايا",
        itemType: "gift",
        currency: "coins",
        price: 100,
        active: true,
      })
      .returning();

    const a = connect(tokenFor(gifterId));
    await waitConnect(a);
    const r = room("gift_identity");
    await joinRoom(a, r, "Gifter");

    const giftNew = once<{ fromUserId: string }>(a, "gift:new");
    const walletUpdate = once<{ userId: string; coins: number }>(a, "wallet:update");
    a.emit("gift:send", {
      roomId: r,
      userId: "user_victim", // spoofed — must be ignored
      userName: "Gifter",
      itemId: gift.id,
    });
    const [evt, wallet] = await Promise.all([giftNew, walletUpdate]);

    // The gift is attributed to, and paid for by, the authenticated user.
    expect(evt.fromUserId).toBe(gifterId);
    expect(wallet.userId).toBe(gifterId);
    expect(wallet.coins).toBe(WELCOME_COINS - gift.price);

    // The spoofed victim was never created or charged.
    const victimWallet = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, "user_victim"));
    expect(victimWallet).toHaveLength(0);
  });
});

describe("messages and presence stay scoped to the joined room", () => {
  it("does not deliver a room's message to a client in a different room", async () => {
    const a = connect(tokenFor("user_a"));
    const b = connect(tokenFor("user_b"));
    await Promise.all([waitConnect(a), waitConnect(b)]);
    const r1 = room("scope_r1");
    const r2 = room("scope_r2");
    await joinRoom(a, r1, "A");
    await joinRoom(b, r2, "B");

    const aReceives = once<{ text: string }>(a, "message:new");
    const bReceivesNothing = expectNoEvent(b, "message:new", 600);

    a.emit("message:send", { roomId: r1, userId: "user_a", userName: "A", text: "only in r1" });

    const got = await aReceives;
    expect(got.text).toBe("only in r1");
    await bReceivesNothing;
  });

  it("ignores a message sent to a room the socket never joined", async () => {
    const a = connect(tokenFor("user_a"));
    await waitConnect(a);
    const r = room("not_joined");

    // Never emit room:join — the server must drop this message.
    const noEcho = expectNoEvent(a, "message:new", 600);
    a.emit("message:send", { roomId: r, userId: "user_a", userName: "A", text: "ghost" });
    await noEcho;

    const rows = await db.select().from(messagesTable).where(eq(messagesTable.roomId, r));
    expect(rows).toHaveLength(0);
  });

  it("does not leak presence updates from one room to another", async () => {
    const a = connect(tokenFor("user_a"));
    await waitConnect(a);
    const r1 = room("presence_r1");
    const r2 = room("presence_r2");

    const firstPresence = once<{ roomId: string }>(a, "room:presence");
    a.emit("room:join", { roomId: r1, userName: "A" });
    await firstPresence;

    // A second user joining a different room must not push presence to A.
    const noLeak = expectNoEvent(a, "room:presence", 600);
    const b = connect(tokenFor("user_b"));
    await waitConnect(b);
    b.emit("room:join", { roomId: r2, userName: "B" });
    await noLeak;
  });
});

describe("game events stay scoped to their own game", () => {
  async function joinTrivia(
    socket: ReturnType<typeof connect>,
    gameId: string,
    userId: string,
    userName: string,
  ): Promise<void> {
    const joined = once(socket, "game:state");
    socket.emit("game:join", { gameId, userId, userName });
    await joined;
  }

  it("does not deliver one game's question to players in a different game", async () => {
    const aId = `${TAG}_gameA_user`;
    const bId = `${TAG}_gameB_user`;
    const a = connect(tokenFor(aId));
    const b = connect(tokenFor(bId));
    await Promise.all([waitConnect(a), waitConnect(b)]);

    const gameA = `${TAG}_gameA`;
    const gameB = `${TAG}_gameB`;
    await joinTrivia(a, gameA, aId, "A");
    await joinTrivia(b, gameB, bId, "B");

    // Start only game A; its question must reach A but never leak to game B.
    const aGetsQuestion = waitFor<{ gameId: string }>(
      a,
      "game:question",
      (q) => q.gameId === gameA,
    );
    const bGetsNothing = expectNoEvent(b, "game:question", 700);
    a.emit("game:start", { gameId: gameA });

    const q = await aGetsQuestion;
    expect(q.gameId).toBe(gameA);
    await bGetsNothing;

    // Purge both sessions so the running question timer is cleared.
    leaveGame(io, gameA, aId);
    leaveGame(io, gameB, bId);
  });
});
