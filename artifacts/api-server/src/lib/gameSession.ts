import type { Server, Socket } from "socket.io";
import { pickQuestions, type TriviaQuestion } from "./trivia";
import { logger } from "./logger";

const QUESTION_MS = 15000;
const REVEAL_MS = 4000;
const MAX_POINTS = 100;
// Keep a disconnected player (and their score) for this long before purging,
// so a brief network blip does not knock them out of an active game.
const RECONNECT_GRACE_MS = 20000;

type Phase = "lobby" | "question" | "reveal" | "ended";

interface Player {
  userId: string;
  userName: string;
  userAvatar: string;
  score: number;
}

interface Session {
  gameId: string;
  phase: Phase;
  index: number;
  questions: TriviaQuestion[];
  players: Map<string, Player>;
  answers: Map<string, { choice: number; at: number }>;
  questionEndsAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  pendingRemoval: Map<string, ReturnType<typeof setTimeout>>;
}

const sessions = new Map<string, Session>();

function gameChannel(gameId: string): string {
  return `game:${gameId}`;
}

function getOrCreate(gameId: string): Session {
  let s = sessions.get(gameId);
  if (!s) {
    s = {
      gameId,
      phase: "lobby",
      index: 0,
      questions: pickQuestions(),
      players: new Map(),
      answers: new Map(),
      questionEndsAt: 0,
      timer: null,
      pendingRemoval: new Map(),
    };
    sessions.set(gameId, s);
  }
  return s;
}

function leaderboard(s: Session) {
  return [...s.players.values()]
    .sort((a, b) => b.score - a.score)
    .map((p) => ({ userId: p.userId, userName: p.userName, userAvatar: p.userAvatar, score: p.score }));
}

function emitState(io: Server, s: Session) {
  io.to(gameChannel(s.gameId)).emit("game:state", {
    gameId: s.gameId,
    phase: s.phase,
    index: s.index,
    total: s.questions.length,
    players: leaderboard(s),
  });
}

function clearTimer(s: Session) {
  if (s.timer) {
    clearTimeout(s.timer);
    s.timer = null;
  }
}

function runQuestion(io: Server, s: Session) {
  s.phase = "question";
  s.answers = new Map();
  s.questionEndsAt = Date.now() + QUESTION_MS;
  const q = s.questions[s.index];
  io.to(gameChannel(s.gameId)).emit("game:question", {
    gameId: s.gameId,
    index: s.index,
    total: s.questions.length,
    question: q.question,
    choices: q.choices,
    endsAt: s.questionEndsAt,
    durationMs: QUESTION_MS,
  });
  clearTimer(s);
  s.timer = setTimeout(() => endQuestion(io, s), QUESTION_MS);
}

function endQuestion(io: Server, s: Session) {
  const q = s.questions[s.index];
  const gained: Record<string, number> = {};
  for (const [userId, ans] of s.answers) {
    const player = s.players.get(userId);
    if (!player) continue;
    if (ans.choice === q.answer) {
      const remaining = Math.max(0, s.questionEndsAt - ans.at);
      const points = Math.ceil((remaining / QUESTION_MS) * MAX_POINTS);
      player.score += points;
      gained[userId] = points;
    } else {
      gained[userId] = 0;
    }
  }
  s.phase = "reveal";
  io.to(gameChannel(s.gameId)).emit("game:reveal", {
    gameId: s.gameId,
    index: s.index,
    answer: q.answer,
    gained,
    players: leaderboard(s),
  });
  clearTimer(s);
  s.timer = setTimeout(() => advance(io, s), REVEAL_MS);
}

function advance(io: Server, s: Session) {
  s.index += 1;
  if (s.index >= s.questions.length) {
    s.phase = "ended";
    io.to(gameChannel(s.gameId)).emit("game:end", {
      gameId: s.gameId,
      players: leaderboard(s),
    });
    clearTimer(s);
    return;
  }
  runQuestion(io, s);
}

export function joinGame(
  io: Server,
  socket: Socket,
  gameId: string,
  player: Player,
): Session {
  const s = getOrCreate(gameId);
  // Cancel any pending grace-period removal — this is a (re)join.
  const pending = s.pendingRemoval.get(player.userId);
  if (pending) {
    clearTimeout(pending);
    s.pendingRemoval.delete(player.userId);
  }
  const existing = s.players.get(player.userId);
  s.players.set(player.userId, {
    ...player,
    score: existing?.score ?? 0,
  });
  emitState(io, s);
  // If a round is already running, send the current question to the joining
  // socket ONLY — broadcasting to the whole room would reset everyone's state.
  if (s.phase === "question") {
    const q = s.questions[s.index];
    socket.emit("game:question", {
      gameId,
      index: s.index,
      total: s.questions.length,
      question: q.question,
      choices: q.choices,
      endsAt: s.questionEndsAt,
      durationMs: QUESTION_MS,
    });
  }
  return s;
}

export function startGame(io: Server, gameId: string): void {
  const s = getOrCreate(gameId);
  if (s.phase === "question" || s.phase === "reveal") return;
  for (const p of s.players.values()) p.score = 0;
  s.index = 0;
  s.questions = pickQuestions();
  logger.info({ gameId, players: s.players.size }, "Trivia game started");
  runQuestion(io, s);
}

export function submitAnswer(
  io: Server,
  gameId: string,
  userId: string,
  choice: number,
): void {
  const s = sessions.get(gameId);
  if (!s || s.phase !== "question") return;
  if (!s.players.has(userId) || s.answers.has(userId)) return;
  s.answers.set(userId, { choice, at: Date.now() });
  io.to(gameChannel(gameId)).emit("game:answered", {
    gameId,
    answeredCount: s.answers.size,
    totalPlayers: s.players.size,
  });
  // Everyone answered — reveal early.
  if (s.answers.size >= s.players.size) {
    endQuestion(io, s);
  }
}

function purge(io: Server, s: Session, userId: string): void {
  s.players.delete(userId);
  s.answers.delete(userId);
  const pending = s.pendingRemoval.get(userId);
  if (pending) {
    clearTimeout(pending);
    s.pendingRemoval.delete(userId);
  }
  if (s.players.size === 0) {
    clearTimer(s);
    for (const t of s.pendingRemoval.values()) clearTimeout(t);
    sessions.delete(s.gameId);
    return;
  }
  emitState(io, s);
}

// Explicit leave (user tapped back / unmounted) — remove immediately.
export function leaveGame(io: Server, gameId: string, userId: string): void {
  const s = sessions.get(gameId);
  if (!s) return;
  purge(io, s, userId);
}

// Socket dropped — keep the player (and score) for a grace period in case
// they reconnect, then purge.
export function markDisconnected(io: Server, gameId: string, userId: string): void {
  const s = sessions.get(gameId);
  if (!s || !s.players.has(userId)) return;
  if (s.pendingRemoval.has(userId)) return;
  const t = setTimeout(() => purge(io, s, userId), RECONNECT_GRACE_MS);
  s.pendingRemoval.set(userId, t);
}
