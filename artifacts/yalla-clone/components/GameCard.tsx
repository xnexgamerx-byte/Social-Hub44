import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

export interface Game {
  id: string;
  name: string;
  description: string;
  maxPlayers: number;
  icon: string;
  color: string;
  category: string;
}

export function GameCard({ game }: { game: Game }) {
  const colors = useColors();

  const handlePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (game.id === "ludo") {
      router.push(`/ludo/${game.id}`);
    } else {
      router.push(`/game/${game.id}`);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={handlePlay}
      activeOpacity={0.85}
    >
      <View style={[styles.iconContainer, { backgroundColor: game.color + "22" }]}>
        <Ionicons name={game.icon as any} size={30} color={game.color} />
      </View>
      <Text style={[styles.name, { color: colors.foreground }]}>{game.name}</Text>
      <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
        {game.description}
      </Text>
      <View style={styles.footer}>
        <View style={styles.players}>
          <Ionicons name="people" size={12} color={colors.mutedForeground} />
          <Text style={[styles.playersText, { color: colors.mutedForeground }]}>
            {`حتى ${game.maxPlayers} لاعبين`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: game.color }]}
          onPress={handlePlay}
          activeOpacity={0.8}
        >
          <Text style={styles.playBtnText}>العب</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
    flex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  name: { fontSize: 15, fontWeight: "700" as const },
  desc: { fontSize: 12, lineHeight: 17 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  players: { flexDirection: "row", alignItems: "center", gap: 3 },
  playersText: { fontSize: 11 },
  playBtn: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  playBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" as const },
});
