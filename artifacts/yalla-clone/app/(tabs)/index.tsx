import { Feather, Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NEARBY_USERS, type NearbyUser } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { UserAvatar } from "@/components/UserAvatar";
import * as Haptics from "expo-haptics";

const TABS = ["قريبون", "مستخدمون جدد"];

function LevelBadge({ level }: { level: number }) {
  return (
    <View style={styles.lvBadge}>
      <Text style={styles.lvText}>Lv.{level}</Text>
    </View>
  );
}

function VipBadge() {
  return (
    <View style={styles.vipBadge}>
      <Text style={styles.vipText}>VIP</Text>
    </View>
  );
}

function UserRow({ user }: { user: NearbyUser }) {
  const colors = useColors();

  const handleChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.userRow, { backgroundColor: colors.card }]}>
      <View style={styles.avatarContainer}>
        <UserAvatar uri={user.avatar} name={user.name} size={54} online={user.isOnline} />
      </View>

      <View style={styles.userInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.userName, { color: colors.foreground }]}>{user.name}</Text>
          <Text style={styles.flag}>{user.flag}</Text>
          {user.isVoiceChatting && (
            <View style={[styles.voiceBadge, { backgroundColor: colors.primary + "22" }]}>
              <Ionicons name="mic" size={10} color={colors.primary} />
              <Text style={[styles.voiceText, { color: colors.primary }]}>دردشة صوتية</Text>
            </View>
          )}
        </View>
        <View style={styles.badgesRow}>
          <LevelBadge level={user.level} />
          {user.isVip && <VipBadge />}
        </View>
        <Text style={[styles.status, { color: colors.mutedForeground }]} numberOfLines={1}>
          {user.status}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.chatBtn, { backgroundColor: colors.primary }]}
        onPress={handleChat}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubble-ellipses" size={18} color={colors.primaryForeground} />
      </TouchableOpacity>
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View style={styles.tabs}>
          {TABS.map((t, i) => (
            <TouchableOpacity key={t} onPress={() => setActiveTab(i)} style={styles.tabBtn} activeOpacity={0.8}>
              <Text style={[styles.tabLabel, { color: i === activeTab ? colors.foreground : colors.mutedForeground, fontWeight: i === activeTab ? "700" : "400" }]}>
                {t}
              </Text>
              {i === activeTab && <View style={[styles.tabUnder, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.secondary }]}>
            <Feather name="filter" size={17} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.secondary }]}>
            <Ionicons name="trophy-outline" size={17} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={NEARBY_USERS}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{
          paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 90,
        }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.border }]} />}
        renderItem={({ item }) => <UserRow user={item} />}
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
  tabs: { flexDirection: "row", gap: 24 },
  tabBtn: { alignItems: "center", paddingBottom: 8 },
  tabLabel: { fontSize: 17 },
  tabUnder: { height: 3, width: "100%", borderRadius: 2, marginTop: 4 },
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
  avatar: { width: 58, height: 58, borderRadius: 29 },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#fff",
  },
  userInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  userName: { fontSize: 16, fontWeight: "700" as const },
  flag: { fontSize: 14 },
  badgesRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  lvBadge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: "rgba(139,92,246,0.22)",
  },
  lvText: { fontSize: 11, fontWeight: "700" as const, color: "#C4B5FD" },
  vipBadge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: "rgba(245,158,11,0.18)",
  },
  vipText: { fontSize: 11, fontWeight: "700" as const, color: "#FCD34D" },
  voiceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  voiceText: { fontSize: 11, fontWeight: "600" as const },
  status: { fontSize: 13 },
  chatBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  sep: { height: StyleSheet.hairlineWidth },
});
