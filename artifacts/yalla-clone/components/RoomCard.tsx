import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";

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
  PK: { bg: "#FF7A0022", color: "#FF7A00" },
  "Super W": { bg: "#00BCD422", color: "#0097A7" },
  Chat: { bg: "#E8F5E9", color: "#2E7D32" },
  "Lv.6": { bg: "#EDE7F6", color: "#7C5CFC" },
  "Lv.8": { bg: "#EDE7F6", color: "#7C5CFC" },
  "Lv.5": { bg: "#EDE7F6", color: "#7C5CFC" },
};

function TagPill({ tag }: { tag: string }) {
  const style = TAG_STYLES[tag] ?? { bg: "#F0EEFF", color: "#7C5CFC" };
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
      <Image
        source={{ uri: room.hostAvatar }}
        style={[styles.avatar, { backgroundColor: colors.muted }]}
      />
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
    borderBottomColor: "#EAE6FF",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 12,
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
