import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket";

export type GamePhase = "lobby" | "question" | "reveal" | "ended";

export interface GamePlayer {
  userId: string;
  userName: string;
  userAvatar: string;
  score: number;
}

export interface GameQuestion {
  index: number;
  total: number;
  question: string;
  choices: string[];
  endsAt: number;
  durationMs: number;
}

interface JoinArgs {
  userId: string;
  userName: string;
  userAvatar: string;
}

export function useGameSession(gameId: string | undefined, me: JoinArgs) {
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [question, setQuestion] = useState<GameQuestion | null>(null);
  const [revealAnswer, setRevealAnswer] = useState<number | null>(null);
  const [gained, setGained] = useState<Record<string, number>>({});
  const [answeredCount, setAnsweredCount] = useState(0);
  const [connected, setConnected] = useState(false);

  const meRef = useRef(me);
  meRef.current = me;
  const gameRef = useRef(gameId);
  gameRef.current = gameId;

  useEffect(() => {
    if (!gameId) return;
    const socket = getSocket();

    const join = () => {
      setConnected(true);
      socket.emit("game:join", { gameId, ...meRef.current });
    };

    const onState = (data: { phase: GamePhase; players: GamePlayer[] }) => {
      setPhase(data.phase);
      setPlayers(data.players);
    };
    const onQuestion = (q: GameQuestion) => {
      setQuestion(q);
      setRevealAnswer(null);
      setGained({});
      setAnsweredCount(0);
      setPhase("question");
    };
    const onAnswered = (d: { answeredCount: number }) => setAnsweredCount(d.answeredCount);
    const onReveal = (d: { answer: number; gained: Record<string, number>; players: GamePlayer[] }) => {
      setRevealAnswer(d.answer);
      setGained(d.gained);
      setPlayers(d.players);
      setPhase("reveal");
    };
    const onEnd = (d: { players: GamePlayer[] }) => {
      setPlayers(d.players);
      setPhase("ended");
    };
    const onDisconnect = () => setConnected(false);

    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("game:state", onState);
    socket.on("game:question", onQuestion);
    socket.on("game:answered", onAnswered);
    socket.on("game:reveal", onReveal);
    socket.on("game:end", onEnd);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.emit("game:leave", { gameId, userId: meRef.current.userId });
      socket.off("connect", join);
      socket.off("game:state", onState);
      socket.off("game:question", onQuestion);
      socket.off("game:answered", onAnswered);
      socket.off("game:reveal", onReveal);
      socket.off("game:end", onEnd);
      socket.off("disconnect", onDisconnect);
    };
  }, [gameId]);

  const start = useCallback(() => {
    if (gameRef.current) getSocket().emit("game:start", { gameId: gameRef.current });
  }, []);

  const answer = useCallback((choice: number) => {
    if (gameRef.current) {
      getSocket().emit("game:answer", {
        gameId: gameRef.current,
        userId: meRef.current.userId,
        choice,
      });
    }
  }, []);

  return { phase, players, question, revealAnswer, gained, answeredCount, connected, start, answer };
}
