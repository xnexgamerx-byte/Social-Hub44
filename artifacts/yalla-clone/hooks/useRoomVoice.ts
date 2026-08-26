import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import {
  isVoiceAvailable,
  joinVoiceChannel,
  leaveVoiceChannel,
  setVoiceMuted,
  setVoiceSpeaking,
} from "@/lib/agoraVoice";

export interface MicSeat {
  userId: string;
  userName: string;
  userAvatar: string;
  muted: boolean;
}

interface Me {
  userId: string;
  userName: string;
  userAvatar: string;
}

/**
 * Live audio stage state over our own WebSocket: who is on the mic and who is
 * muted, synced across everyone in the room. The actual audio transport is
 * dropped in via Agora once the app is built natively (see /api/agora/token).
 */
export function useRoomVoice(roomId: string | undefined, me: Me) {
  const [seats, setSeats] = useState<MicSeat[]>([]);
  const [stageFull, setStageFull] = useState(false);
  // Surfaced to the screen: a silently swallowed voice failure is
  // indistinguishable from "the feature is broken".
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const roomRef = useRef(roomId);
  roomRef.current = roomId;
  const meRef = useRef(me);
  meRef.current = me;

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();

    const onState = (data: { roomId: string; seats: MicSeat[] }) => {
      if (data.roomId === roomRef.current) setSeats(data.seats);
    };
    const onFull = (data: { roomId: string }) => {
      if (data.roomId === roomRef.current) {
        setStageFull(true);
        setTimeout(() => setStageFull(false), 2500);
      }
    };

    socket.on("mic:state", onState);
    socket.on("mic:full", onFull);

    return () => {
      socket.off("mic:state", onState);
      socket.off("mic:full", onFull);
      // Drop the previous room's stage so a new room never shows ghost seats
      // before its snapshot arrives.
      setSeats([]);
      setStageFull(false);
    };
  }, [roomId]);

  const mySeat = seats.find((s) => s.userId === meRef.current.userId);
  const onMic = !!mySeat;
  const muted = mySeat?.muted ?? false;

  // Audio follows the seat state already synced over our socket: everyone in
  // the room listens, and taking a seat promotes you to speaker. All no-ops in
  // Expo Go, where the native module cannot load.
  useEffect(() => {
    if (!roomId || !isVoiceAvailable()) return;
    setVoiceError(null);
    void joinVoiceChannel(roomId, meRef.current.userId, false).catch((err) => {
      // Voice is optional — text chat and seats keep working — but the reason
      // must reach the user rather than vanishing.
      setVoiceError(err instanceof Error ? err.message : "تعذّر تشغيل الصوت");
    });
    return () => leaveVoiceChannel();
  }, [roomId]);

  useEffect(() => {
    if (!isVoiceAvailable()) return;
    void setVoiceSpeaking(onMic).catch((err) => {
      setVoiceError(err instanceof Error ? err.message : "تعذّر تشغيل الميكروفون");
    });
  }, [onMic]);

  useEffect(() => {
    if (!isVoiceAvailable()) return;
    setVoiceMuted(!onMic || muted);
  }, [onMic, muted]);

  const takeMic = useCallback(() => {
    const rid = roomRef.current;
    if (!rid) return;
    const m = meRef.current;
    getSocket().emit("mic:join", {
      roomId: rid,
      userId: m.userId,
      userName: m.userName,
      userAvatar: m.userAvatar,
    });
  }, []);

  const leaveMic = useCallback(() => {
    const rid = roomRef.current;
    if (!rid) return;
    getSocket().emit("mic:leave", { roomId: rid, userId: meRef.current.userId });
  }, []);

  const setMuted = useCallback((next: boolean) => {
    const rid = roomRef.current;
    if (!rid) return;
    getSocket().emit("mic:mute", { roomId: rid, userId: meRef.current.userId, muted: next });
  }, []);

  return { seats, onMic, muted, stageFull, voiceError, takeMic, leaveMic, setMuted };
}
