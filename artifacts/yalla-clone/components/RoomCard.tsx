import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { UserAvatar } from "@/components/UserAvatar";

export interface Room {
  id: string;
  name: string;
  hostName: string;
  hostAvatar: string;
  speakerCount: number;
  listenerCount: number;
  description: string;
  tags: string[];
  isLive: boolean;
  category: "chat" | "gaming" | "music" | "family";
  speakerAvatars: string[];
}

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  PK: { bg: "rgba(255,122,0,0.18)", color: "#FFA040" },
  "Super W": { bg: "rgba(0,188,212,0.18)", color: "#22D3EE" },
  Chat: { bg: "rgba(34,197,94,0.18)", color: "#4ADE80" },
  "Lv.6": { bg: "rgba(139,92,246,0.22)", color: "#C4B5FD" },
  "Lv.8": { bg: "rgba(139,92,246,0.22)", color: "#C4B5FD" },
  "Lv.5": { bg: "rgba(139,92,246,0.22)", color: "#C4B5FD" },
};

function TagPill({ tag }: { tag: string }) {
  const style = TAG_STYLES[tag] ?? { bg: "rgba(139,92,246,0.22)", color: "#C4B5FD" };
  return (
    <View style={[styles.tag, { backgroundColor: style.bg }]}>
      <Text style={[styles.tagText, { color: style.color }]}>{tag}</Text>
    </View>
  );
}

export function RoomCard({ room }: { room: Room }) {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => router.push(`/room/${room.id}`)}
      activeOpacity={0.88}
    >
      <UserAvatar uri={room.hostAvatar} name={room.hostName} size={64} />
      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {room.name}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={1}>
          {room.description}
        </Text>
        <View style={styles.tagsRow}>
          {room.tags.map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </View>
      </View>
      <View style={styles.right}>
        <Ionicons name="bar-chart" size={14} color={colors.mutedForeground} />
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {room.listenerCount}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(180,140,255,0.15)",
  },
  body: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: "700" as const,
  },
  desc: {
    fontSize: 12,
    lineHeight: 16,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  tag: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  right: {
    alignItems: "center",
    gap: 3,
  },
  count: {
    fontSize: 12,
  },
});
