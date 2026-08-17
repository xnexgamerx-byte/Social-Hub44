import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Room } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { UserAvatar } from "@/components/UserAvatar";

export type { Room };

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  PK: { bg: "rgba(255,122,0,0.18)", color: "#FFA040" },
  "Super W": { bg: "rgba(0,188,212,0.18)", color: "#22D3EE" },
  Chat: { bg: "rgba(34,197,94,0.18)", color: "#4ADE80" },
};

const CATEGORY_LABELS: Record<string, string> = {
  chat: "دردشة",
  gaming: "ألعاب",
  music: "طرب",
  family: "عائلة",
};

function TagPill({ tag }: { tag: string }) {
  const style = TAG_STYLES[tag] ?? { bg: "rgba(139,92,246,0.22)", color: "#C4B5FD" };
  return (
    <View style={[styles.tag, { backgroundColor: style.bg }]}>
      <Text style={[styles.tagText, { color: style.color }]}>{tag}</Text>
    </View>
  );
}

interface RoomCardProps {
  room: Room;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function RoomCard({ room, onEdit, onDelete }: RoomCardProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => router.push(`/room/${room.id}`)}
      activeOpacity={0.88}
    >
      <UserAvatar uri={room.ownerAvatar} name={room.ownerName || room.name} size={64} />
      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {room.name}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={1}>
          {room.description || (room.ownerName ? `بإدارة ${room.ownerName}` : "")}
        </Text>
        <View style={styles.tagsRow}>
          <TagPill tag={CATEGORY_LABELS[room.category] ?? room.category} />
          {room.tags.map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </View>
      </View>
      {onEdit || onDelete ? (
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity
              onPress={onEdit}
              style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
              hitSlop={8}
            >
              <Ionicons name="create-outline" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              onPress={onDelete}
              style={[styles.actionBtn, { backgroundColor: "#EF444422" }]}
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.right}>
          <Ionicons name="chevron-back" size={16} color={colors.mutedForeground} />
        </View>
      )}
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
  actions: {
    gap: 8,
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});
