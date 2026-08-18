import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListConversationsQueryKey,
  getListConversationsQueryOptions,
  type Conversation,
} from "@workspace/api-client-react";
import { UserAvatar } from "@/components/UserAvatar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { getSocket } from "@/lib/socket";

// Only shortcuts that lead somewhere real — a tile that does nothing reads as
// a broken app.
const QUICK = [
  { icon: "people" as const, label: "المستخدمون", color: "#7C5CFC", route: "/(tabs)" as const },
  { icon: "home" as const, label: "الغرف", color: "#06B6D4", route: "/(tabs)/rooms" as const },
  { icon: "images" as const, label: "اللحظات", color: "#FF6B9D", route: "/(tabs)/videos" as const },
  { icon: "gift" as const, label: "المهام", color: "#F59E0B", route: "/tasks" as const },
];

function formatTime(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} س`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "أمس";
  return `${days} يوم`;
}

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const conversationsQ = useQuery(getListConversationsQueryOptions());

  // Any DM activity (in or out) refreshes the inbox ordering + unread badges.
  useEffect(() => {
    const socket = getSocket();
    const onDm = () => {
      qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    };
    socket.on("dm:new", onDm);
    return () => {
      socket.off("dm:new", onDm);
    };
  }, [qc]);

  const conversations = conversationsQ.data ?? [];

  const openConversation = (c: Conversation) => {
    router.push(
      `/dm/${c.id}?otherUserId=${encodeURIComponent(c.otherUserId)}&otherName=${encodeURIComponent(c.otherName)}&otherAvatar=${encodeURIComponent(c.otherAvatar)}`,
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>الرسائل</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{
          paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 90,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.quickRow}>
            {QUICK.map((q) => (
              <TouchableOpacity
                key={q.label}
                style={styles.quickItem}
                activeOpacity={0.8}
                onPress={() => router.push(q.route)}
              >
                <View style={[styles.quickIcon, { backgroundColor: `${q.color}22` }]}>
                  <Ionicons name={q.icon} size={22} color={q.color} />
                </View>
                <Text style={[styles.quickLabel, { color: colors.mutedForeground }]}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        }
        ListEmptyComponent={
          conversationsQ.isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                ما عندك محادثات بعد{"\n"}اضغط على صورة أي شخص داخل الغرف لتبدأ محادثة
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => openConversation(item)}
            activeOpacity={0.85}
          >
            <UserAvatar uri={item.otherAvatar} name={item.otherName} size={52} />
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                  {item.otherName || "مستخدم"}
                </Text>
                <Text style={[styles.time, { color: colors.mutedForeground }]}>
                  {formatTime(item.lastAt)}
                </Text>
              </View>
              <View style={styles.rowBottom}>
                <Text
                  style={[
                    styles.last,
                    {
                      color: item.unread > 0 ? colors.foreground : colors.mutedForeground,
                      fontWeight: item.unread > 0 ? "600" : "400",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.lastText || "ابدأ المحادثة 👋"}
                </Text>
                {item.unread > 0 && (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.unreadText}>{item.unread > 99 ? "99+" : item.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: "800" as const },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  quickItem: { alignItems: "center", gap: 6 },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1, gap: 4 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: { fontSize: 15, fontWeight: "700" as const, flex: 1 },
  time: { fontSize: 11 },
  last: { fontSize: 13, flex: 1 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "700" as const },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: { fontSize: 14, textAlign: "center" as const, lineHeight: 22 },
});
