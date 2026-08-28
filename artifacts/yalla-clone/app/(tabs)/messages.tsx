import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { QueryError } from "@/components/QueryError";
import { SearchBar } from "@/components/SearchBar";
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

/** Below this the field is clutter — the whole inbox fits on one screen. */
const SEARCH_THRESHOLD = 6;

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
  const [query, setQuery] = useState("");

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

  const conversations = useMemo(() => conversationsQ.data ?? [], [conversationsQ.data]);

  // Filters what is already loaded rather than pretending to search the
  // server, which has no conversation search endpoint.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => (c.otherName ?? "").toLowerCase().includes(q));
  }, [conversations, query]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread > 0 ? 1 : 0), 0),
    [conversations],
  );

  const openConversation = (c: Conversation) => {
    router.push(
      `/dm/${c.id}?otherUserId=${encodeURIComponent(c.otherUserId)}&otherName=${encodeURIComponent(c.otherName)}&otherAvatar=${encodeURIComponent(c.otherAvatar)}`,
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>الرسائل</Text>
        {totalUnread > 0 && (
          <View style={[styles.headerCount, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.headerCountText, { color: colors.primary }]}>
              {totalUnread} جديدة
            </Text>
          </View>
        )}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{
          paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 90,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.listHead}>
            <View style={[styles.quickCard, { backgroundColor: colors.card }]}>
              {QUICK.map((q) => (
                <TouchableOpacity
                  key={q.label}
                  style={styles.quickItem}
                  activeOpacity={0.8}
                  onPress={() => router.push(q.route)}
                >
                  <View style={[styles.quickIcon, { backgroundColor: `${q.color}1F` }]}>
                    <Ionicons name={q.icon} size={21} color={q.color} />
                  </View>
                  <Text style={[styles.quickLabel, { color: colors.mutedForeground }]}>
                    {q.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {conversations.length >= SEARCH_THRESHOLD && (
              <View style={styles.searchWrap}>
                <SearchBar value={query} onChange={setQuery} placeholder="ابحث في محادثاتك" />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          conversationsQ.isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : conversationsQ.isError ? (
            <QueryError
              message="تعذّر تحميل محادثاتك."
              onRetry={() => void conversationsQ.refetch()}
            />
          ) : query.trim() ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={34} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                ما في محادثة باسم «{query.trim()}»
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyArt, { backgroundColor: colors.secondary }]}>
                <Ionicons name="chatbubbles" size={30} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                ما عندك محادثات بعد
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                اضغط على صورة أي شخص داخل الغرف لتبدأ محادثة
              </Text>
              <TouchableOpacity
                style={[styles.emptyCta, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/(tabs)/rooms")}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyCtaText}>تصفّح الغرف</Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const unread = item.unread > 0;
          const first = index === 0;
          const last = index === visible.length - 1;
          return (
            <TouchableOpacity
              style={[
                styles.row,
                { backgroundColor: colors.card },
                first && styles.rowFirst,
                last && styles.rowLast,
              ]}
              onPress={() => openConversation(item)}
              activeOpacity={0.85}
            >
              {/* The unread ring carries the state at avatar size, so the
                  thread reads as new before the eye reaches the badge. */}
              <View
                style={[
                  styles.avatarRing,
                  unread && { borderColor: colors.primary, borderWidth: 2 },
                ]}
              >
                <UserAvatar uri={item.otherAvatar} name={item.otherName} size={50} />
              </View>

              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text
                    style={[
                      styles.name,
                      { color: colors.foreground, fontWeight: unread ? "800" : "700" },
                    ]}
                    numberOfLines={1}
                  >
                    {item.otherName || "مستخدم"}
                  </Text>
                  <Text
                    style={[
                      styles.time,
                      { color: unread ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    {formatTime(item.lastAt)}
                  </Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text
                    style={[
                      styles.last,
                      {
                        color: unread ? colors.foreground : colors.mutedForeground,
                        fontWeight: unread ? "600" : "400",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.lastText || "ابدأ المحادثة 👋"}
                  </Text>
                  {unread && (
                    <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.unreadText}>
                        {item.unread > 99 ? "99+" : item.unread}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => (
          <View style={[styles.sepWrap, { backgroundColor: colors.card }]}>
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
          </View>
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
    marginBottom: 6,
  },
  title: { fontSize: 22, fontWeight: "800" as const },
  headerCount: { borderRadius: 11, paddingHorizontal: 10, paddingVertical: 4 },
  headerCountText: { fontSize: 11.5, fontWeight: "800" as const },

  listHead: { gap: 12, paddingTop: 8, paddingBottom: 14 },
  quickCard: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginHorizontal: 16,
    borderRadius: 18,
    paddingVertical: 14,
  },
  quickItem: { alignItems: "center", gap: 7 },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 11.5, fontWeight: "600" as const },
  searchWrap: { paddingHorizontal: 16 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  rowFirst: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  rowLast: { borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  rowBody: { flex: 1, gap: 4 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: { fontSize: 15, flex: 1, textAlign: "right" as const },
  time: { fontSize: 11, fontWeight: "600" as const },
  last: { fontSize: 13, flex: 1, textAlign: "right" as const },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "700" as const },

  // Separators sit inside the card and stop short of the avatar, so the group
  // reads as one surface instead of a stack of loose rows.
  sepWrap: { marginHorizontal: 16, paddingHorizontal: 13 },
  sep: { height: StyleSheet.hairlineWidth, marginRight: 68 },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyArt: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800" as const },
  emptyText: { fontSize: 13.5, textAlign: "center" as const, lineHeight: 21 },
  emptyCta: {
    borderRadius: 13,
    paddingHorizontal: 22,
    paddingVertical: 11,
    marginTop: 6,
  },
  emptyCtaText: { color: "#fff", fontSize: 14, fontWeight: "800" as const },
});
