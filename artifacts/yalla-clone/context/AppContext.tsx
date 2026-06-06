import { useAuth, useUser } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ensureWallet as ensureWalletReq,
  getGetAuthMeQueryKey,
  getGetWalletQueryKey,
  getGetWalletQueryOptions,
  getListUserItemsQueryKey,
  getListUserItemsQueryOptions,
  useClaimTask,
  useEquipItem,
  useGetAuthMe,
  usePurchaseItem,
  useRechargeWallet,
  useReconcileRecharges,
} from "@workspace/api-client-react";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const FALLBACK_AVATAR = "https://i.pravatar.cc/150?img=3";

export interface AppUser {
  id: string;
  publicId: string;
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
  isAdmin: boolean;
  isOwner: boolean;
  isAdminLoading: boolean;
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
  rechargePackage: (packageId: number, rcPurchaseId: string) => Promise<ActionResult>;
  reconcileRecharges: () => Promise<ActionResult>;
  claimTask: (taskId: number) => Promise<ActionResult>;
  equipItem: (itemId: number) => Promise<ActionResult>;
  setVip: (level: number, type: "vip" | "svip") => void;
  refreshWallet: () => void;
}

const EMPTY_USER: AppUser = {
  id: "",
  publicId: "",
  name: "",
  username: "",
  avatar: FALLBACK_AVATAR,
  level: 1,
  coins: 0,
  vPoints: 0,
  vipLevel: 0,
  vipType: null,
  followers: 0,
  following: 0,
  bio: "",
  isAdmin: false,
};

const noopAsync = async (): Promise<ActionResult> => ({ ok: false });

const AppContext = createContext<AppContextValue>({
  user: EMPTY_USER,
  isAdmin: false,
  isOwner: false,
  isAdminLoading: true,
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
  reconcileRecharges: noopAsync,
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
  const { isSignedIn, userId: clerkUserId } = useAuth();
  const { user: clerkUser } = useUser();
  const userId = clerkUserId ?? null;

  const [vip, setVipState] = useState<LocalVip>({ vipLevel: 0, vipType: null });
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [joinedRooms, setJoinedRooms] = useState<Set<string>>(new Set());
  const [walletReady, setWalletReady] = useState(false);

  // Apply the username/gender/age captured during sign-up. The sign-up flow only
  // sets credentials, so the details are stashed in AsyncStorage (scoped to the
  // sign-up email) and written to the Clerk user once that exact account's
  // session is active — never replayed onto a different account.
  useEffect(() => {
    if (!clerkUser) return;
    let cancelled = false;
    (async () => {
      const raw = await AsyncStorage.getItem("pendingProfile");
      if (!raw || cancelled) return;
      let parsed: {
        email?: string;
        username?: string;
        gender?: "male" | "female";
        age?: number;
      };
      try {
        parsed = JSON.parse(raw);
      } catch {
        await AsyncStorage.removeItem("pendingProfile");
        return;
      }
      // Only apply to the account the details were collected for.
      const currentEmail = clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase();
      if (!parsed.email || !currentEmail || parsed.email !== currentEmail) return;

      const { username, gender, age } = parsed;
      const metadata = {
        ...(clerkUser.unsafeMetadata ?? {}),
        ...(gender ? { gender } : {}),
        ...(typeof age === "number" ? { age } : {}),
      };
      try {
        await clerkUser.update({
          ...(username && !clerkUser.username ? { username } : {}),
          unsafeMetadata: metadata,
        });
        await AsyncStorage.removeItem("pendingProfile");
      } catch {
        // The username may be taken; still persist gender/age so the details
        // are not lost, and only clear once that succeeds.
        try {
          await clerkUser.update({ unsafeMetadata: metadata });
          await AsyncStorage.removeItem("pendingProfile");
        } catch {
          // Transient failure — keep the blob so it can retry on next mount.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clerkUser]);

  const authMeQ = useGetAuthMe({
    query: { queryKey: getGetAuthMeQueryKey(), enabled: !!isSignedIn },
  });
  const isAdmin = authMeQ.data?.isAdmin ?? false;
  const isOwner = authMeQ.data?.isOwner ?? false;
  const isAdminLoading = !!isSignedIn && authMeQ.isLoading;

  // Hydrate device-local UI state (likes, joins, vip) and make sure the signed-in
  // account has a backend wallet (seeded with a welcome balance on first run).
  useEffect(() => {
    if (!userId) {
      setWalletReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [liked, joined, localVip] = await Promise.all([
        AsyncStorage.getItem("likedVideos"),
        AsyncStorage.getItem("joinedRooms"),
        AsyncStorage.getItem("userState"),
      ]);
      if (cancelled) return;
      if (liked) setLikedVideos(new Set(JSON.parse(liked)));
      if (joined) setJoinedRooms(new Set(JSON.parse(joined)));
      if (localVip) {
        try {
          const parsed = JSON.parse(localVip) as Partial<LocalVip>;
          if (typeof parsed.vipLevel === "number" && parsed.vipType) {
            setVipState({ vipLevel: parsed.vipLevel, vipType: parsed.vipType });
          }
        } catch {
          // ignore malformed local vip blob
        }
      }

      try {
        // The welcome balance is granted server-side on first creation; the
        // client cannot influence the opening balance.
        await ensureWalletReq(userId);
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
    ...getGetWalletQueryOptions(userId ?? "__none__"),
    enabled: walletReady && !!userId,
  });
  const itemsQ = useQuery({
    ...getListUserItemsQueryOptions(userId ?? "__none__"),
    enabled: walletReady && !!userId,
  });

  const invalidateWallet = () => {
    if (userId) qc.invalidateQueries({ queryKey: getGetWalletQueryKey(userId) });
  };
  const invalidateItems = () => {
    if (userId) qc.invalidateQueries({ queryKey: getListUserItemsQueryKey(userId) });
  };

  const purchaseM = usePurchaseItem();
  const rechargeM = useRechargeWallet();
  const reconcileM = useReconcileRecharges();
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

  const user: AppUser = useMemo(() => {
    const displayName =
      clerkUser?.fullName ||
      clerkUser?.firstName ||
      clerkUser?.username ||
      clerkUser?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
      "مستخدم";
    const handle = clerkUser?.username
      ? `@${clerkUser.username}`
      : clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    return {
      ...EMPTY_USER,
      id: userId ?? "",
      publicId: walletQ.data?.publicId ?? "",
      name: displayName,
      username: handle,
      avatar: clerkUser?.imageUrl || FALLBACK_AVATAR,
      bio: (clerkUser?.unsafeMetadata?.bio as string | undefined) || "",
      coins: walletQ.data?.coins ?? 0,
      vPoints: walletQ.data?.vPoints ?? 0,
      vipLevel: vip.vipLevel,
      vipType: vip.vipType,
      isAdmin,
    };
  }, [clerkUser, userId, walletQ.data, vip, isAdmin]);

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
    if (!userId) return { ok: false, error: "يجب تسجيل الدخول" };
    try {
      await purchaseM.mutateAsync({ userId, data: { itemId: id } });
      invalidateWallet();
      invalidateItems();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err, "تعذّر إتمام الشراء") };
    }
  };

  const rechargePackage = async (
    packageId: number,
    rcPurchaseId: string,
  ): Promise<ActionResult> => {
    if (!userId) return { ok: false, error: "يجب تسجيل الدخول" };
    try {
      await rechargeM.mutateAsync({ userId, data: { packageId, rcPurchaseId } });
      invalidateWallet();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err, "تعذّر إتمام الشحن") };
    }
  };

  const reconcileRecharges = async (): Promise<ActionResult> => {
    if (!userId) return { ok: false, error: "يجب تسجيل الدخول" };
    try {
      await reconcileM.mutateAsync({ userId });
      invalidateWallet();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err, "تعذّر التحقق من المشتريات") };
    }
  };

  const claimTask = async (taskId: number): Promise<ActionResult> => {
    if (!userId) return { ok: false, error: "يجب تسجيل الدخول" };
    try {
      await claimM.mutateAsync({ userId, data: { taskId } });
      invalidateWallet();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err, "تعذّر استلام المكافأة") };
    }
  };

  const equipItem = async (itemId: number): Promise<ActionResult> => {
    if (!userId) return { ok: false, error: "يجب تسجيل الدخول" };
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
        isAdmin,
        isOwner,
        isAdminLoading,
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
        reconcileRecharges,
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
