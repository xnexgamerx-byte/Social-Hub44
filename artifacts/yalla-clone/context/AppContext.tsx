import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

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

interface AppContextValue {
  user: AppUser;
  likedVideos: Set<string>;
  toggleLikeVideo: (id: string) => void;
  joinedRooms: Set<string>;
  toggleJoinRoom: (id: string) => void;
  ownedItems: Set<number>;
  buyItem: (id: number, price: number, currency: string) => boolean;
  setVip: (level: number, type: "vip" | "svip") => void;
  recharge: (vPoints: number) => void;
}

const AppContext = createContext<AppContextValue>({
  user: DEFAULT_USER,
  likedVideos: new Set(),
  toggleLikeVideo: () => {},
  joinedRooms: new Set(),
  toggleJoinRoom: () => {},
  ownedItems: new Set(),
  buyItem: () => false,
  setVip: () => {},
  recharge: () => {},
});

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser>(DEFAULT_USER);
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [joinedRooms, setJoinedRooms] = useState<Set<string>>(new Set());
  const [ownedItems, setOwnedItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem("likedVideos").then((val) => {
      if (val) setLikedVideos(new Set(JSON.parse(val)));
    });
    AsyncStorage.getItem("joinedRooms").then((val) => {
      if (val) setJoinedRooms(new Set(JSON.parse(val)));
    });
    AsyncStorage.getItem("ownedItems").then((val) => {
      if (val) setOwnedItems(new Set(JSON.parse(val)));
    });
    AsyncStorage.getItem("userState").then((val) => {
      if (val) setUser((prev) => ({ ...prev, ...JSON.parse(val) }));
    });
  }, []);

  const persistUser = (next: AppUser) => {
    setUser(next);
    AsyncStorage.setItem(
      "userState",
      JSON.stringify({
        coins: next.coins,
        vPoints: next.vPoints,
        vipLevel: next.vipLevel,
        vipType: next.vipType,
      }),
    );
  };

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

  const buyItem = (id: number, price: number, currency: string): boolean => {
    const balance = currency === "coins" ? user.coins : user.vPoints;
    if (balance < price) return false;
    const next: AppUser =
      currency === "coins"
        ? { ...user, coins: user.coins - price }
        : { ...user, vPoints: user.vPoints - price };
    persistUser(next);
    setOwnedItems((prev) => {
      const updated = new Set(prev);
      updated.add(id);
      AsyncStorage.setItem("ownedItems", JSON.stringify([...updated]));
      return updated;
    });
    return true;
  };

  const setVip = (level: number, type: "vip" | "svip") => {
    persistUser({ ...user, vipLevel: level, vipType: type });
  };

  const recharge = (vPoints: number) => {
    persistUser({ ...user, vPoints: user.vPoints + vPoints });
  };

  return (
    <AppContext.Provider
      value={{
        user,
        likedVideos,
        toggleLikeVideo,
        joinedRooms,
        toggleJoinRoom,
        ownedItems,
        buyItem,
        setVip,
        recharge,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
