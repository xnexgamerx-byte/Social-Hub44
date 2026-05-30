import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export interface AppUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
  level: number;
  coins: number;
  followers: number;
  following: number;
  bio: string;
}

const DEFAULT_USER: AppUser = {
  id: "u1",
  name: "أحمد خالد",
  username: "@ahmed_k",
  avatar: "https://i.pravatar.cc/150?img=3",
  level: 24,
  coins: 3850,
  followers: 1240,
  following: 380,
  bio: "أحب الموسيقى والألعاب والتواصل مع الناس",
};

interface AppContextValue {
  user: AppUser;
  likedVideos: Set<string>;
  toggleLikeVideo: (id: string) => void;
  joinedRooms: Set<string>;
  toggleJoinRoom: (id: string) => void;
}

const AppContext = createContext<AppContextValue>({
  user: DEFAULT_USER,
  likedVideos: new Set(),
  toggleLikeVideo: () => {},
  joinedRooms: new Set(),
  toggleJoinRoom: () => {},
});

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [user] = useState<AppUser>(DEFAULT_USER);
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [joinedRooms, setJoinedRooms] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem("likedVideos").then((val) => {
      if (val) setLikedVideos(new Set(JSON.parse(val)));
    });
    AsyncStorage.getItem("joinedRooms").then((val) => {
      if (val) setJoinedRooms(new Set(JSON.parse(val)));
    });
  }, []);

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

  return (
    <AppContext.Provider value={{ user, likedVideos, toggleLikeVideo, joinedRooms, toggleJoinRoom }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
