import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  getListProfilesQueryOptions,
  useOpenConversation,
  type Profile,
} from "@workspace/api-client-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { UserAvatar } from "@/components/UserAvatar";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import * as Haptics from "expo-haptics";

const TABS = ["الكل", "متصلون الآن"];

function LevelBadge({ level }: { level: number }) {
  return (
    <View style={styles.lvBadge}>
      <Text style={styles.lvText}>Lv.{level}</Text>
    </View>
  );
}

function relativeSeen(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "متصل الآن";
  if (mins < 60) return `نشط قبل ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `نشط قبل ${hours} س`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "نشط أمس" : `نشط قبل ${days} يوم`;
}

function UserRow({ user, onChat }: { user: Profile; onChat: (u: Profile) => void }) {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[styles.userRow, { backgroundColor: colors.card }]}
      activeOpacity={0.75}
      onPress={() =>
        router.push({ pathname: "/user/[userId]", params: { userId: user.userId } })
      }
    >
      <View style={styles.avatarContainer}>
        <UserAvatar uri={user.avatar} name={user.name} size={54} online={user.isOnline} />
      </View>

      <View style={styles.userInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
            {user.name || "مستخدم"}
          </Text>
          {/* Official and host accounts are always labelled — nothing on this
              screen is allowed to look like a private person when it isn't. */}
          {user.isOfficial && (
            <View style={styles.officialBadge}>
              <Ionicons name="checkmark-circle" size={11} color="#fff" />
              <Text style={styles.badgeText}>رسمي</Text>
            </View>
          )}
          {user.isHost && !user.isOfficial && (
            <View style={styles.hostBadge}>
              <Ionicons name="mic" size={10} color="#fff" />
              <Text style={styles.badgeText}>مضيف</Text>
            </View>
          )}
          {!!user.country && <Text style={styles.flag}>{user.country}</Text>}
        </View>
        <View style={styles.badgesRow}>
          <LevelBadge level={user.level} />
          {user.age > 0 && (
            <View style={styles.ageBadge}>
              <Ionicons
                name={user.gender === "female" ? "female" : "male"}
                size={9}
                color="#fff"
              />
              <Text style={styles.ageText}>{user.age}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.status, { color: colors.mutedForeground }]} numberOfLines={1}>
          {user.bio || relativeSeen(user.lastSeenAt)}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.chatBtn, { backgroundColor: colors.primary }]}
        onPress={() => onChat(user)}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubble-ellipses" size={18} color={colors.primaryForeground} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user: me } = useApp();
  const [activeTab, setActiveTab] = useState(0);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const profilesQ = useQuery(getListProfilesQueryOptions());
  const openConversationM = useOpenConversation();

  const people = useMemo(() => {
    const all = profilesQ.data ?? [];
    return activeTab === 1 ? all.filter((p) => p.isOnline) : all;
  }, [profilesQ.data, activeTab]);

  const openChat = async (other: Profile) => {
    if (!me.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const conv = await openConversationM.mutateAsync({
        data: {
          otherUserId: other.userId,
          otherName: other.name,
          otherAvatar: other.avatar,
        },
      });
      router.push(
        `/dm/${conv.id}?otherUserId=${encodeURIComponent(conv.otherUserId)}&otherName=${encodeURIComponent(conv.otherName || other.name)}&otherAvatar=${encodeURIComponent(conv.otherAvatar || other.avatar)}`,
      );
    } catch {
      Alert.alert("خطأ", "تعذّر فتح المحادثة");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <SegmentedTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.push("/games")}
          >
            <Ionicons name="game-controller-outline" size={17} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.push("/tasks")}
          >
            <Ionicons name="gift-outline" size={17} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={people}
        keyExtractor={(u) => u.userId}
        contentContainerStyle={{
          paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 90,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={profilesQ.isFetching && !profilesQ.isLoading}
            onRefresh={() => profilesQ.refetch()}
            tintColor={colors.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.border }]} />}
        ListEmptyComponent={
          profilesQ.isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {activeTab === 1
                  ? "ما كو أحد متصل الآن"
                  : "ما كو مستخدمون بعد — ادعُ أصدقاءك للتطبيق!"}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => <UserRow user={item} onChat={openChat} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 0,
    marginBottom: 8,
  },
  headerIcons: { flexDirection: "row", gap: 8, paddingBottom: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  avatarContainer: { position: "relative" },
  userInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  userName: { fontSize: 16, fontWeight: "700" as const, flexShrink: 1 },
  flag: { fontSize: 14 },
  badgesRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  lvBadge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: "rgba(139,92,246,0.22)",
  },
  lvText: { fontSize: 11, fontWeight: "700" as const, color: "#C4B5FD" },
  officialBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#2F80ED",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hostBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#EC4899",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" as const },
  ageBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#60A5FA",
  },
  ageText: { fontSize: 11, fontWeight: "700" as const, color: "#fff" },
  status: { fontSize: 13 },
  chatBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  sep: { height: StyleSheet.hairlineWidth },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: { fontSize: 14, textAlign: "center" as const, paddingHorizontal: 40 },
});
