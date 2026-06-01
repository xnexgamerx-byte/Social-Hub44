import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket";

export interface ChatMessage {
  id: number;
  roomId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: string;
}

interface SendArgs {
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
}

export function useRoomChat(roomId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState(0);
  const [connected, setConnected] = useState(false);
  const roomRef = useRef(roomId);
  roomRef.current = roomId;

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();

    const join = () => {
      setConnected(true);
      socket.emit("room:join", { roomId });
    };

    const onHistory = (rows: ChatMessage[]) => setMessages(rows);
    const onNew = (msg: ChatMessage) => {
      if (msg.roomId !== roomRef.current) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    };
    const onPresence = (data: { roomId: string; count: number }) => {
      if (data.roomId === roomRef.current) setPresence(data.count);
    };
    const onDisconnect = () => setConnected(false);

    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("room:history", onHistory);
    socket.on("message:new", onNew);
    socket.on("room:presence", onPresence);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", join);
      socket.off("room:history", onHistory);
      socket.off("message:new", onNew);
      socket.off("room:presence", onPresence);
      socket.off("disconnect", onDisconnect);
    };
  }, [roomId]);

  const sendMessage = useCallback(
    ({ userId, userName, userAvatar, text }: SendArgs) => {
      const trimmed = text.trim();
      if (!trimmed || !roomRef.current) return;
      getSocket().emit("message:send", {
        roomId: roomRef.current,
        userId,
        userName,
        userAvatar,
        text: trimmed,
      });
    },
    [],
  );

  return { messages, presence, connected, sendMessage };
}
