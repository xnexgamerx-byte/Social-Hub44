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
  players: number;
  maxPlayers: number;
  icon: string;
  color: string;
  category: string;
}

export function GameCard({ game }: { game: Game }) {
  const colors = useColors();

  const handlePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/game/${game.id}`);
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={handlePlay}
      activeOpacity={0.85}
    >
      <View style={[styles.iconContainer, { backgroundColor: game.color + "33" }]}>
        <Ionicons name={game.icon as any} size={32} color={game.color} />
      </View>
      <Text style={[styles.name, { color: colors.foreground }]}>{game.name}</Text>
      <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
        {game.description}
      </Text>
      <View style={styles.footer}>
        <View style={styles.players}>
          <Ionicons name="people" size={13} color={colors.mutedForeground} />
          <Text style={[styles.playersText, { color: colors.mutedForeground }]}>
            {game.players}
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
    borderWidth: 1,
    gap: 8,
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: "700" as const,
  },
  desc: {
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  players: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  playersText: {
    fontSize: 12,
  },
  playBtn: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  playBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700" as const,
  },
});
