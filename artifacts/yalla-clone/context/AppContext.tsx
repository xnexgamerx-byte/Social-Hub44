import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ensureWallet as ensureWalletReq,
  getGetWalletQueryKey,
  getGetWalletQueryOptions,
  getListUserItemsQueryKey,
  getListUserItemsQueryOptions,
  useClaimTask,
  useEquipItem,
  usePurchaseItem,
  useRechargeWallet,
} from "@workspace/api-client-react";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface AppUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
  level: number;
  coins: number;
  vPoints: number;
  vipLevel: number;
  vipType: "vip" | "svip" | null;
  followers: number;
  following: number;
  bio: string;
  isAdmin: boolean;
}

const DEFAULT_USER: AppUser = {
  id: "u1",
  name: "أحمد خالد",
  username: "@ahmed_k",
  avatar: "https://i.pravatar.cc/150?img=3",
  level: 24,
  coins: 3850,
  vPoints: 160,
  vipLevel: 0,
  vipType: null,
  followers: 1240,
  following: 380,
  bio: "أحب الموسيقى والألعاب والتواصل مع الناس",
  isAdmin: true,
};

export interface ActionResult {
  ok: boolean;
  error?: string;
}

interface LocalVip {
  vipLevel: number;
  vipType: "vip" | "svip" | null;
}

interface AppContextValue {
  user: AppUser;
  walletReady: boolean;
  likedVideos: Set<string>;
  toggleLikeVideo: (id: string) => void;
  joinedRooms: Set<string>;
  toggleJoinRoom: (id: string) => void;
  ownedItems: Set<number>;
  equippedItems: Set<number>;
  isOwned: (id: number) => boolean;
  isEquipped: (id: number) => boolean;
  buyItem: (id: number) => Promise<ActionResult>;
  rechargePackage: (packageId: number) => Promise<ActionResult>;
  claimTask: (taskId: number) => Promise<ActionResult>;
  equipItem: (itemId: number) => Promise<ActionResult>;
  setVip: (level: number, type: "vip" | "svip") => void;
  refreshWallet: () => void;
}

const noopAsync = async (): Promise<ActionResult> => ({ ok: false });

const AppContext = createContext<AppContextValue>({
  user: DEFAULT_USER,
  walletReady: false,
  likedVideos: new Set(),
  toggleLikeVideo: () => {},
  joinedRooms: new Set(),
  toggleJoinRoom: () => {},
  ownedItems: new Set(),
  equippedItems: new Set(),
  isOwned: () => false,
  isEquipped: () => false,
  buyItem: noopAsync,
  rechargePackage: noopAsync,
  claimTask: noopAsync,
  equipItem: noopAsync,
  setVip: () => {},
  refreshWallet: () => {},
});

function errorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: string } } })?.response?.data;
  if (data?.error) return data.error;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const userId = DEFAULT_USER.id;

  const [vip, setVipState] = useState<LocalVip>({ vipLevel: 0, vipType: null });
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [joinedRooms, setJoinedRooms] = useState<Set<string>>(new Set());
  const [walletReady, setWalletReady] = useState(false);

  // One-time bootstrap: hydrate local-only state (likes, joins, vip) and migrate
  // any legacy AsyncStorage balances into the backend wallet exactly once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [liked, joined, legacyUser, migrated] = await Promise.all([
        AsyncStorage.getItem("likedVideos"),
        AsyncStorage.getItem("joinedRooms"),
        AsyncStorage.getItem("userState"),
        AsyncStorage.getItem("walletMigrated"),
      ]);
      if (cancelled) return;
      if (liked) setLikedVideos(new Set(JSON.parse(liked)));
      if (joined) setJoinedRooms(new Set(JSON.parse(joined)));

      let initialCoins = DEFAULT_USER.coins;
      let initialVPoints = DEFAULT_USER.vPoints;
      if (legacyUser) {
        try {
          const parsed = JSON.parse(legacyUser) as Partial<AppUser>;
          if (typeof parsed.coins === "number") initialCoins = parsed.coins;
          if (typeof parsed.vPoints === "number") initialVPoints = parsed.vPoints;
          if (typeof parsed.vipLevel === "number" && parsed.vipType) {
            setVipState({ vipLevel: parsed.vipLevel, vipType: parsed.vipType });
          }
        } catch {
          // ignore malformed legacy blob
        }
      }

      try {
        await ensureWalletReq(userId, {
          initialCoins: migrated ? undefined : initialCoins,
          initialVPoints: migrated ? undefined : initialVPoints,
        });
        await AsyncStorage.setItem("walletMigrated", "1");
      } catch {
        // Wallet ensure is best-effort; the query below will retry fetching.
      } finally {
        if (!cancelled) {
          qc.invalidateQueries({ queryKey: getGetWalletQueryKey(userId) });
          setWalletReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qc, userId]);

  const walletQ = useQuery({
    ...getGetWalletQueryOptions(userId),
    enabled: walletReady,
  });
  const itemsQ = useQuery({
    ...getListUserItemsQueryOptions(userId),
    enabled: walletReady,
  });

  const invalidateWallet = () =>
    qc.invalidateQueries({ queryKey: getGetWalletQueryKey(userId) });
  const invalidateItems = () =>
    qc.invalidateQueries({ queryKey: getListUserItemsQueryKey(userId) });

  const purchaseM = usePurchaseItem();
  const rechargeM = useRechargeWallet();
  const claimM = useClaimTask();
  const equipM = useEquipItem();

  const ownedItems = useMemo(
    () => new Set((itemsQ.data ?? []).map((i) => i.itemId)),
    [itemsQ.data],
  );
  const equippedItems = useMemo(
    () => new Set((itemsQ.data ?? []).filter((i) => i.equipped).map((i) => i.itemId)),
    [itemsQ.data],
  );

  const user: AppUser = useMemo(
    () => ({
      ...DEFAULT_USER,
      coins: walletQ.data?.coins ?? DEFAULT_USER.coins,
      vPoints: walletQ.data?.vPoints ?? DEFAULT_USER.vPoints,
      vipLevel: vip.vipLevel,
      vipType: vip.vipType,
    }),
    [walletQ.data, vip],
  );

  const toggleLikeVideo = (id: string) => {
    setLikedVideos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      AsyncStorage.setItem("likedVideos", JSON.stringify([...next]));
      return next;
    });
  };

  const toggleJoinRoom = (id: string) => {
    setJoinedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      AsyncStorage.setItem("joinedRooms", JSON.stringify([...next]));
      return next;
    });
  };

  const buyItem = async (id: number): Promise<ActionResult> => {
    try {
      await purchaseM.mutateAsync({ userId, data: { itemId: id } });
      invalidateWallet();
      invalidateItems();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err, "تعذّر إتمام الشراء") };
    }
  };

  const rechargePackage = async (packageId: number): Promise<ActionResult> => {
    try {
      await rechargeM.mutateAsync({ userId, data: { packageId } });
      invalidateWallet();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err, "تعذّر إتمام الشحن") };
    }
  };

  const claimTask = async (taskId: number): Promise<ActionResult> => {
    try {
      await claimM.mutateAsync({ userId, data: { taskId } });
      invalidateWallet();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err, "تعذّر استلام المكافأة") };
    }
  };

  const equipItem = async (itemId: number): Promise<ActionResult> => {
    try {
      await equipM.mutateAsync({ userId, data: { itemId } });
      invalidateItems();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err, "تعذّر تجهيز العنصر") };
    }
  };

  const setVip = (level: number, type: "vip" | "svip") => {
    const next: LocalVip = { vipLevel: level, vipType: type };
    setVipState(next);
    AsyncStorage.setItem(
      "userState",
      JSON.stringify({ vipLevel: next.vipLevel, vipType: next.vipType }),
    );
  };

  return (
    <AppContext.Provider
      value={{
        user,
        walletReady: walletReady && walletQ.isSuccess,
        likedVideos,
        toggleLikeVideo,
        joinedRooms,
        toggleJoinRoom,
        ownedItems,
        equippedItems,
        isOwned: (id) => ownedItems.has(id),
        isEquipped: (id) => equippedItems.has(id),
        buyItem,
        rechargePackage,
        claimTask,
        equipItem,
        setVip,
        refreshWallet: invalidateWallet,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
