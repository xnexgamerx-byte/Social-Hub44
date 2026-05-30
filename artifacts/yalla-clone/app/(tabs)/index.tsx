import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameCard } from "@/components/GameCard";
import { RoomCard } from "@/components/RoomCard";
import { VideoCard } from "@/components/VideoCard";
import { useApp } from "@/context/AppContext";
import { GAMES, ROOMS, VIDEOS } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { UserAvatar } from "@/components/UserAvatar";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: topPad + 10,
        paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 90,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>مرحباً بك</Text>
          <Text style={[styles.userName, { color: colors.foreground }]}>{user.name}</Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]}>
            <Ionicons name="search" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]}>
            <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
            <View style={[styles.notifDot, { backgroundColor: "#EF4444" }]} />
          </TouchableOpacity>
          <UserAvatar uri={user.avatar} size={38} online />
        </View>
      </View>

      {/* Coins banner */}
      <View style={[styles.coinsBanner, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "55" }]}>
        <Ionicons name="star" size={20} color={colors.accent} />
        <Text style={[styles.coinsText, { color: colors.foreground }]}>
          لديك <Text style={{ color: colors.accent, fontWeight: "800" }}>{user.coins.toLocaleString()}</Text> عملة
        </Text>
        <TouchableOpacity style={[styles.rechargeBtn, { backgroundColor: colors.primary }]}>
          <Text style={styles.rechargeBtnText}>شحن</Text>
        </TouchableOpacity>
      </View>

      {/* Live rooms section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الغرف المباشرة</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/rooms")} style={styles.seeAll}>
          <Text style={[styles.seeAllText, { color: colors.primary }]}>الكل</Text>
          <Ionicons name="chevron-back" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <FlatList
        horizontal
        data={ROOMS.filter((r) => r.isLive).slice(0, 4)}
        keyExtractor={(r) => r.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        renderItem={({ item }) => (
          <View style={{ width: 260 }}>
            <RoomCard room={item} />
          </View>
        )}
      />

      {/* Videos section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الفيديوهات الرائجة</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/videos")} style={styles.seeAll}>
          <Text style={[styles.seeAllText, { color: colors.primary }]}>الكل</Text>
          <Ionicons name="chevron-back" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <FlatList
        horizontal
        data={VIDEOS.slice(0, 4)}
        keyExtractor={(v) => v.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        renderItem={({ item }) => (
          <View style={{ width: 160 }}>
            <VideoCard video={item} />
          </View>
        )}
      />

      {/* Games section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الألعاب</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/games")} style={styles.seeAll}>
          <Text style={[styles.seeAllText, { color: colors.primary }]}>الكل</Text>
          <Ionicons name="chevron-back" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.gamesGrid}>
        {GAMES.slice(0, 2).map((game) => (
          <View key={game.id} style={{ flex: 1 }}>
            <GameCard game={game} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  greeting: {
    fontSize: 13,
    marginBottom: 2,
  },
  userName: {
    fontSize: 20,
    fontWeight: "800" as const,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notifDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  coinsBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  coinsText: {
    flex: 1,
    fontSize: 14,
  },
  rechargeBtn: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  rechargeBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700" as const,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  gamesGrid: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
});
