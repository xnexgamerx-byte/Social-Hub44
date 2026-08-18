import type { Game } from "@/components/GameCard";

// The built-in game catalogue. Unlike rooms, users, and moments — which are all
// DB-backed — these are the two games the app actually ships, so they stay a
// static list rather than a table.
export const GAMES: Game[] = [
  {
    id: "g1",
    name: "تحدي المعلومات",
    description: "أسئلة عشوائية متجددة — كن الأسرع في الإجابة واربح النقاط",
    maxPlayers: 4,
    icon: "bulb",
    color: "#F59E0B",
    category: "ثقافي",
  },
  {
    id: "ludo",
    name: "لودو",
    description: "لعبة اللودو الكلاسيكية أونلاين حتى 4 لاعبين",
    maxPlayers: 4,
    icon: "dice",
    color: "#EC4899",
    category: "لوحية",
  },
];
