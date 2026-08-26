import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";

export type LudoColor = "red" | "green" | "yellow" | "blue";
export type LudoPhase = "lobby" | "playing" | "ended";

export interface LudoPlayer {
  userId: string;
  userName: string;
  userAvatar: string;
  color: LudoColor;
  /** 0 or 1 in team play; null in a free-for-all. */
  team: 0 | 1 | null;
  tokens: number[];
  finished: number;
}

export type LudoMode = 2 | 4;

export interface LudoState {
  gameId: string;
  mode: LudoMode;
  maxPlayers: number;
  /** Four seats played as two partnerships. */
  teams: boolean;
  phase: LudoPhase;
  players: LudoPlayer[];
  turn: LudoColor | null;
  dice: number | null;
  awaitingMove: boolean;
  movable: number[];
  winner: LudoColor | null;
}

interface JoinArgs {
  userId: string;
  userName: string;
  userAvatar: string;
}

export function useLudoSession(
  gameId: string | undefined,
  me: JoinArgs,
  mode: LudoMode = 4,
  teams = false,
) {
  const [state, setState] = useState<LudoState | null>(null);
  const [lastDice, setLastDice] = useState<{ color: LudoColor; dice: number; forfeit: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const meRef = useRef(me);
  meRef.current = me;
  const gameRef = useRef(gameId);
  gameRef.current = gameId;
  // The mode only takes effect when this client opens the table; joining an
  // existing game keeps whatever size it was created with.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const teamsRef = useRef(teams);
  teamsRef.current = teams;

  useEffect(() => {
    if (!gameId) return;
    const socket = getSocket();

    const join = () => {
      setConnected(true);
      socket.emit("ludo:join", {
        gameId,
        ...meRef.current,
        mode: modeRef.current,
        teams: teamsRef.current,
      });
    };

    const onState = (data: LudoState) => setState(data);
    const onDice = (d: { color: LudoColor; dice: number; forfeit: boolean }) => setLastDice(d);
    const onError = (d: { message: string }) => setError(d.message);
    const onDisconnect = () => setConnected(false);

    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("ludo:state", onState);
    socket.on("ludo:dice", onDice);
    socket.on("ludo:error", onError);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.emit("ludo:leave", { gameId });
      socket.off("connect", join);
      socket.off("ludo:state", onState);
      socket.off("ludo:dice", onDice);
      socket.off("ludo:error", onError);
      socket.off("disconnect", onDisconnect);
    };
  }, [gameId]);

  const start = useCallback(() => {
    if (gameRef.current) getSocket().emit("ludo:start", { gameId: gameRef.current });
  }, []);

  const roll = useCallback(() => {
    if (gameRef.current) getSocket().emit("ludo:roll", { gameId: gameRef.current });
  }, []);

  const move = useCallback((tokenIndex: number) => {
    if (gameRef.current) {
      getSocket().emit("ludo:move", { gameId: gameRef.current, tokenIndex });
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { state, lastDice, error, connected, start, roll, move, clearError };
}
