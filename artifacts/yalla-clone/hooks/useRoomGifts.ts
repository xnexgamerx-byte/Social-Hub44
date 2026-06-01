import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";

export interface GiftEvent {
  key: string;
  fromUserId: string;
  fromName: string;
  fromAvatar: string;
  toName: string;
  gift: {
    id: number;
    name: string;
    color: string;
    icon: string;
    mediaUrl: string;
    price: number;
  };
}

export interface EntranceEvent {
  key: string;
  userId: string;
  userName: string;
  userAvatar: string;
  entrance: {
    name: string;
    color: string;
    icon: string;
    mediaUrl: string;
  };
}

interface SendGiftArgs {
  userId: string;
  userName: string;
  userAvatar: string;
  itemId: number;
  toName?: string;
}

let counter = 0;
function nextKey(): string {
  counter += 1;
  return `${Date.now()}_${counter}`;
}

/**
 * Listens for live gift and entrance events broadcast over the room socket and
 * surfaces the most recent one as an animated overlay. The server is the source
 * of truth for coin deduction; we only animate here.
 */
export function useRoomGifts(
  roomId: string | undefined,
  onWalletUpdate?: (coins: number, vPoints: number) => void,
  onGiftError?: (message: string) => void,
) {
  const [gift, setGift] = useState<GiftEvent | null>(null);
  const [entrance, setEntrance] = useState<EntranceEvent | null>(null);
  const roomRef = useRef(roomId);
  roomRef.current = roomId;
  const walletCb = useRef(onWalletUpdate);
  walletCb.current = onWalletUpdate;
  const errorCb = useRef(onGiftError);
  errorCb.current = onGiftError;

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();

    const onGiftNew = (data: Omit<GiftEvent, "key"> & { roomId: string }) => {
      if (data.roomId !== roomRef.current) return;
      setGift({ ...data, key: nextKey() });
    };
    const onEntrance = (data: Omit<EntranceEvent, "key"> & { roomId: string }) => {
      if (data.roomId !== roomRef.current) return;
      setEntrance({ ...data, key: nextKey() });
    };
    const onWallet = (data: { coins: number; vPoints: number }) => {
      walletCb.current?.(data.coins, data.vPoints);
    };
    const onError = (data: { message: string }) => {
      errorCb.current?.(data.message);
    };

    socket.on("gift:new", onGiftNew);
    socket.on("room:entrance", onEntrance);
    socket.on("wallet:update", onWallet);
    socket.on("gift:error", onError);

    return () => {
      socket.off("gift:new", onGiftNew);
      socket.off("room:entrance", onEntrance);
      socket.off("wallet:update", onWallet);
      socket.off("gift:error", onError);
    };
  }, [roomId]);

  const sendGift = useCallback(
    ({ userId, userName, userAvatar, itemId, toName }: SendGiftArgs) => {
      const rid = roomRef.current;
      if (!rid) return;
      getSocket().emit("gift:send", {
        roomId: rid,
        userId,
        userName,
        userAvatar,
        itemId,
        toName,
      });
    },
    [],
  );

  const clearGift = useCallback((key: string) => {
    setGift((prev) => (prev?.key === key ? null : prev));
  }, []);
  const clearEntrance = useCallback((key: string) => {
    setEntrance((prev) => (prev?.key === key ? null : prev));
  }, []);

  return { gift, entrance, sendGift, clearGift, clearEntrance };
}
