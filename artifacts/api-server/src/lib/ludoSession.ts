import type { Server, Socket } from "socket.io";
import { logger } from "./logger";

/**
 * Classic online Ludo (4 players). Server-authoritative: clients only send
 * intentions (roll / move) and render the broadcast state. All rules — leaving
 * base on a six, captures, safe squares, home column, exact-finish and win —
 * are enforced here.
 *
 * Position model per token:
 *   -1            → still in base (yard)
 *   0 .. 50       → on the shared 52-cell ring, relative to the player's start
 *   51 .. 56      → the player's private 6-cell home column
 *   57            → finished (reached center)
 */

export type LudoColor = "red" | "green" | "yellow" | "blue";

const COLORS: LudoColor[] = ["red", "green", "yellow", "blue"];
const TOKENS_PER_PLAYER = 4;
const RING_SIZE = 52;
const FINISH = 57;

// Where each color enters the shared ring (global cell index).
const START_OFFSET: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

// Safe global ring cells: the four colored start cells + the four star cells.
// Tokens on these can never be captured and may stack.
const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Keep a disconnected player for this long before purging, so a brief blip
// does not knock them out of an active game.
const RECONNECT_GRACE_MS = 25000;

type Phase = "lobby" | "playing" | "ended";

interface LudoPlayer {
  userId: string;
  userName: string;
  userAvatar: string;
  color: LudoColor;
}

interface LudoGame {
  gameId: string;
  phase: Phase;
  players: Map<string, LudoPlayer>;
  order: LudoColor[];
  positions: Record<LudoColor, number[]>;
  turnIndex: number;
  dice: number | null;
  awaitingMove: boolean;
  movable: number[];
  consecutiveSixes: number;
  winner: LudoColor | null;
  pendingRemoval: Map<string, ReturnType<typeof setTimeout>>;
  passTimer: ReturnType<typeof setTimeout> | null;
}

const games = new Map<string, LudoGame>();

function channel(gameId: string): string {
  return `ludo:${gameId}`;
}

function getOrCreate(gameId: string): LudoGame {
  let g = games.get(gameId);
  if (!g) {
    g = {
      gameId,
      phase: "lobby",
      players: new Map(),
      order: [],
      positions: { red: [], green: [], yellow: [], blue: [] },
      turnIndex: 0,
      dice: null,
      awaitingMove: false,
      movable: [],
      consecutiveSixes: 0,
      winner: null,
      pendingRemoval: new Map(),
      passTimer: null,
    };
    games.set(gameId, g);
  }
  return g;
}

function freshTokens(): number[] {
  return Array.from({ length: TOKENS_PER_PLAYER }, () => -1);
}

function currentColor(g: LudoGame): LudoColor | null {
  return g.order[g.turnIndex] ?? null;
}

/** Global ring cell for a token's relative position, or null if not on ring. */
function ringCell(color: LudoColor, pos: number): number | null {
  if (pos < 0 || pos > 50) return null;
  return (START_OFFSET[color] + pos) % RING_SIZE;
}

function clearPassTimer(g: LudoGame) {
  if (g.passTimer) {
    clearTimeout(g.passTimer);
    g.passTimer = null;
  }
}

function snapshot(g: LudoGame) {
  return {
    gameId: g.gameId,
    phase: g.phase,
    players: g.order.map((color) => {
      const p = [...g.players.values()].find((pl) => pl.color === color)!;
      return {
        userId: p.userId,
        userName: p.userName,
        userAvatar: p.userAvatar,
        color,
        tokens: g.positions[color],
        finished: g.positions[color].filter((t) => t === FINISH).length,
      };
    }),
    turn: currentColor(g),
    dice: g.dice,
    awaitingMove: g.awaitingMove,
    movable: g.movable,
    winner: g.winner,
  };
}

function emitState(io: Server, g: LudoGame) {
  io.to(channel(g.gameId)).emit("ludo:state", snapshot(g));
}

/** Token indexes the current player may legally move with the given dice. */
function movableTokens(g: LudoGame, color: LudoColor, dice: number): number[] {
  const out: number[] = [];
  g.positions[color].forEach((pos, i) => {
    if (pos === FINISH) return;
    if (pos === -1) {
      if (dice === 6) out.push(i);
      return;
    }
    if (pos + dice <= FINISH) out.push(i);
  });
  return out;
}

function advanceTurn(g: LudoGame) {
  g.dice = null;
  g.awaitingMove = false;
  g.movable = [];
  g.consecutiveSixes = 0;
  if (g.order.length === 0) return;
  g.turnIndex = (g.turnIndex + 1) % g.order.length;
}

export function joinLudo(
  io: Server,
  socket: Socket,
  gameId: string,
  player: { userId: string; userName: string; userAvatar: string },
): void {
  const g = getOrCreate(gameId);

  // Cancel any pending grace-period removal — this is a (re)join.
  const pending = g.pendingRemoval.get(player.userId);
  if (pending) {
    clearTimeout(pending);
    g.pendingRemoval.delete(player.userId);
  }

  const existing = g.players.get(player.userId);
  if (existing) {
    existing.userName = player.userName;
    existing.userAvatar = player.userAvatar;
  } else if (g.phase === "lobby" && g.players.size < COLORS.length) {
    const used = new Set([...g.players.values()].map((p) => p.color));
    const color = COLORS.find((c) => !used.has(c));
    if (color) {
      g.players.set(player.userId, { ...player, color });
      g.order.push(color);
      g.positions[color] = freshTokens();
    }
  }
  emitState(io, g);
}

export function startLudo(io: Server, gameId: string, userId: string): void {
  const g = games.get(gameId);
  if (!g || g.phase !== "lobby") return;
  if (!g.players.has(userId)) return;
  if (g.players.size < 2) {
    io.to(channel(gameId)).emit("ludo:error", {
      message: "نحتاج لاعبَين على الأقل لبدء اللعبة",
    });
    return;
  }
  g.phase = "playing";
  g.turnIndex = 0;
  g.dice = null;
  g.awaitingMove = false;
  g.movable = [];
  g.winner = null;
  logger.info({ gameId, players: g.players.size }, "Ludo game started");
  emitState(io, g);
}

export function rollLudo(io: Server, gameId: string, userId: string): void {
  const g = games.get(gameId);
  if (!g || g.phase !== "playing") return;
  const color = currentColor(g);
  if (!color) return;
  const player = g.players.get(userId);
  if (!player || player.color !== color) return; // not your turn
  if (g.awaitingMove) return; // already rolled, must move

  const dice = 1 + Math.floor(Math.random() * 6);
  g.dice = dice;

  if (dice === 6) {
    g.consecutiveSixes += 1;
    // Three sixes in a row forfeits the turn.
    if (g.consecutiveSixes >= 3) {
      io.to(channel(gameId)).emit("ludo:dice", { color, dice, forfeit: true });
      advanceTurn(g);
      emitState(io, g);
      return;
    }
  } else {
    g.consecutiveSixes = 0;
  }

  const movable = movableTokens(g, color, dice);
  io.to(channel(gameId)).emit("ludo:dice", { color, dice, forfeit: false });

  if (movable.length === 0) {
    // No legal move — pass after a short beat so clients can show the dice.
    g.awaitingMove = false;
    g.movable = [];
    emitState(io, g);
    clearPassTimer(g);
    g.passTimer = setTimeout(() => {
      advanceTurn(g);
      emitState(io, g);
    }, 1200);
    return;
  }

  g.awaitingMove = true;
  g.movable = movable;
  emitState(io, g);
}

export function moveLudo(
  io: Server,
  gameId: string,
  userId: string,
  tokenIndex: number,
): void {
  const g = games.get(gameId);
  if (!g || g.phase !== "playing" || !g.awaitingMove) return;
  const color = currentColor(g);
  if (!color) return;
  const player = g.players.get(userId);
  if (!player || player.color !== color) return;
  if (!g.movable.includes(tokenIndex)) return;
  const dice = g.dice;
  if (dice == null) return;

  const pos = g.positions[color][tokenIndex];
  let next: number;
  if (pos === -1) {
    next = 0; // leave base onto start cell (only reachable with a six)
  } else {
    next = pos + dice;
  }
  if (next > FINISH) return; // overshoot, illegal
  g.positions[color][tokenIndex] = next;

  // Capture: landing on a non-safe ring cell sends opponents there back home.
  let captured = false;
  const landedRing = ringCell(color, next);
  if (landedRing != null && !SAFE_CELLS.has(landedRing)) {
    for (const other of g.order) {
      if (other === color) continue;
      g.positions[other].forEach((p, i) => {
        if (ringCell(other, p) === landedRing) {
          g.positions[other][i] = -1;
          captured = true;
        }
      });
    }
  }

  const justFinished = next === FINISH;

  // Win check.
  if (g.positions[color].every((t) => t === FINISH)) {
    g.phase = "ended";
    g.winner = color;
    g.awaitingMove = false;
    g.movable = [];
    g.dice = dice;
    logger.info({ gameId, winner: color }, "Ludo game ended");
    emitState(io, g);
    return;
  }

  // Extra turn on a six, on capturing, or on getting a token home.
  const extraTurn = dice === 6 || captured || justFinished;
  if (extraTurn) {
    g.dice = null;
    g.awaitingMove = false;
    g.movable = [];
    // consecutiveSixes already tracked in rollLudo; reset if it wasn't a six.
    if (dice !== 6) g.consecutiveSixes = 0;
  } else {
    advanceTurn(g);
  }
  emitState(io, g);
}

function purge(io: Server, g: LudoGame, userId: string): void {
  const player = g.players.get(userId);
  if (!player) return;
  const wasTurnColor = currentColor(g);
  const idx = g.order.indexOf(player.color);

  g.players.delete(userId);
  if (idx >= 0) g.order.splice(idx, 1);
  delete (g.positions as Record<string, number[]>)[player.color];
  g.positions[player.color] = [];

  const pending = g.pendingRemoval.get(userId);
  if (pending) {
    clearTimeout(pending);
    g.pendingRemoval.delete(userId);
  }

  if (g.players.size === 0) {
    clearPassTimer(g);
    for (const t of g.pendingRemoval.values()) clearTimeout(t);
    games.delete(g.gameId);
    return;
  }

  if (g.phase === "playing") {
    if (g.players.size < 2) {
      g.phase = "ended";
      g.winner = g.order[0] ?? null;
    } else {
      // Keep the turn pointer valid; if the leaver was up, move to next.
      if (g.order.length > 0) g.turnIndex = g.turnIndex % g.order.length;
      if (wasTurnColor === player.color) {
        g.dice = null;
        g.awaitingMove = false;
        g.movable = [];
        if (g.order.length > 0) g.turnIndex = g.turnIndex % g.order.length;
      }
    }
  }
  emitState(io, g);
}

export function leaveLudo(io: Server, gameId: string, userId: string): void {
  const g = games.get(gameId);
  if (!g) return;
  purge(io, g, userId);
}

export function markLudoDisconnected(
  io: Server,
  gameId: string,
  userId: string,
): void {
  const g = games.get(gameId);
  if (!g || !g.players.has(userId)) return;
  if (g.pendingRemoval.has(userId)) return;
  const t = setTimeout(() => purge(io, g, userId), RECONNECT_GRACE_MS);
  g.pendingRemoval.set(userId, t);
}
