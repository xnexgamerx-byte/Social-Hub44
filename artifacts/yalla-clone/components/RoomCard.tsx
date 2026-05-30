import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { LiveBadge } from "./LiveBadge";
import { UserAvatar } from "./UserAvatar";

export interface Room {
  id: string;
  name: string;
  hostName: string;
  hostAvatar: string;
  speakerCount: number;
  listenerCount: number;
  tags: string[];
  isLive: boolean;
  category: "chat" | "gaming" | "music" | "family";
  speakerAvatars: string[];
}

const CATEGORY_COLORS: Record<string, string> = {
  chat: "#7C3AED",
  gaming: "#EC4899",
  music: "#06B6D4",
  family: "#F59E0B",
};

export function RoomCard({ room }: { room: Room }) {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/room/${room.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[room.category] }]} />
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {room.name}
          </Text>
        </View>
        {room.isLive && <LiveBadge small />}
      </View>

      <View style={styles.hostRow}>
        <UserAvatar uri={room.hostAvatar} size={24} />
        <Text style={[styles.hostName, { color: colors.mutedForeground }]}>{room.hostName}</Text>
      </View>

      <View style={styles.speakersRow}>
        {room.speakerAvatars.slice(0, 4).map((uri, i) => (
          <View key={i} style={[styles.speakerAvatar, { marginLeft: i > 0 ? -10 : 0 }]}>
            <UserAvatar uri={uri} size={32} bordered />
          </View>
        ))}
        {room.speakerAvatars.length > 4 && (
          <View style={[styles.moreAvatar, { backgroundColor: colors.muted }]}>
            <Text style={[styles.moreText, { color: colors.mutedForeground }]}>
              +{room.speakerAvatars.length - 4}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.stat}>
          <Ionicons name="mic" size={13} color={colors.primary} />
          <Text style={[styles.statText, { color: colors.mutedForeground }]}>{room.speakerCount}</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="headset" size={13} color={colors.mutedForeground} />
          <Text style={[styles.statText, { color: colors.mutedForeground }]}>{room.listenerCount}</Text>
        </View>
        <View style={styles.tags}>
          {room.tags.slice(0, 2).map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: colors.muted }]}>
              <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: "700" as const,
    flex: 1,
  },
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hostName: {
    fontSize: 13,
  },
  speakersRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  speakerAvatar: {
    zIndex: 1,
  },
  moreAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -10,
  },
  moreText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
  tags: {
    flexDirection: "row",
    gap: 6,
    flex: 1,
    justifyContent: "flex-end",
  },
  tag: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 11,
  },
});
