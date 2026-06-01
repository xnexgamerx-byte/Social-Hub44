import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const TOOLS = [
  { icon: "people" as const, label: "العائلة", color: "#7C5CFC", route: null },
  { icon: "checkbox" as const, label: "المهام", color: "#22C55E", route: "/tasks" as const },
  { icon: "eye" as const, label: "الزوار", color: "#06B6D4", route: null },
  { icon: "diamond" as const, label: "ماسات", color: "#FF6B9D", route: "/vip" as const },
];

const GAMES_SHORTCUTS = [
  { icon: "dice" as const, label: "الألعاب", color: "#F59E0B" },
  { icon: "trophy" as const, label: "البطولات", color: "#EC4899" },
  { icon: "gift" as const, label: "الهدايا", color: "#7C5CFC" },
  { icon: "musical-notes" as const, label: "الموسيقى", color: "#06B6D4" },
];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const { signOut } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const confirmSignOut = () => {
    Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج من حسابك؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "خروج",
        style: "destructive",
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: topPad + 10,
        paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 90,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>أنا</Text>
        <View style={{ flexDirection: "row", gap: 14 }}>
          {user.isAdmin && (
            <TouchableOpacity onPress={() => router.push("/admin")}>
              <Ionicons name="construct-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={confirmSignOut}>
            <Ionicons name="settings-outline" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Identity */}
      <TouchableOpacity style={[styles.identityRow]} activeOpacity={0.8}>
        <View style={[styles.avatarWrapper, { borderColor: colors.primary }]}>
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={[styles.name, { color: colors.foreground }]}>{user.name}</Text>
          <Text style={[styles.username, { color: colors.mutedForeground }]}>{user.username}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.lvBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.lvBadgeText}>Lv {user.level}</Text>
            </View>
            {user.vipType && (
              <View style={[styles.vipBadge, { backgroundColor: "#C9972B" }]}>
                <Ionicons name="diamond" size={10} color="#fff" />
                <Text style={styles.vipBadgeText}>
                  {user.vipType === "svip" ? "SVIP" : "VIP"}{user.vipLevel}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-back" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{user.following.toLocaleString()}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>متابَع</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{user.followers.toLocaleString()}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>متابع</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{user.coins.toLocaleString()}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>عملات</Text>
        </View>
      </View>

      {/* Coins recharge banner — economy centerpiece */}
      <TouchableOpacity activeOpacity={0.9} onPress={() => router.push("/recharge")}>
        <LinearGradient
          colors={["#7C5CFC", "#A78BFA"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.recharge}
        >
          <View style={styles.rechargeLeft}>
            <Ionicons name="logo-bitcoin" size={26} color="#F5C242" />
            <View>
              <Text style={styles.rechargeTitle}>شحن كوينزات</Text>
              <Text style={styles.rechargeSub}>رصيدك: {user.coins.toLocaleString()} كوينز</Text>
            </View>
          </View>
          <View style={styles.rechargeBtn}>
            <Text style={styles.rechargeBtnText}>شحن</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Aristocracy: SVIP / VIP */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الأرستقراطية</Text>
      <View style={styles.aristoRow}>
        <TouchableOpacity
          style={styles.aristoCard}
          activeOpacity={0.85}
          onPress={() => router.push("/vip")}
        >
          <LinearGradient colors={["#4A148C", "#7B1FA2"]} style={styles.aristoGrad}>
            <Ionicons name="diamond" size={26} color="#F5C242" />
            <Text style={styles.aristoTitle}>SVIP</Text>
            <Text style={styles.aristoSub}>امتيازات فائقة</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.aristoCard}
          activeOpacity={0.85}
          onPress={() => router.push("/vip")}
        >
          <LinearGradient colors={["#C9972B", "#F5C242"]} style={styles.aristoGrad}>
            <Ionicons name="ribbon" size={26} color="#fff" />
            <Text style={styles.aristoTitle}>VIP</Text>
            <Text style={styles.aristoSub}>16 مستوى حصري</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* General tools */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الأدوات العامة</Text>
      <View style={[styles.toolsCard, { backgroundColor: colors.card }]}>
        {TOOLS.map((t) => (
          <TouchableOpacity
            key={t.label}
            style={styles.toolItem}
            activeOpacity={0.7}
            onPress={() => t.route && router.push(t.route)}
          >
            <View style={[styles.toolIcon, { backgroundColor: t.color + "1A" }]}>
              <Ionicons name={t.icon} size={22} color={t.color} />
            </View>
            <Text style={[styles.toolLabel, { color: colors.foreground }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Entertainment / Games */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الترفيه</Text>
      <View style={[styles.toolsCard, { backgroundColor: colors.card }]}>
        {GAMES_SHORTCUTS.map((g) => (
          <TouchableOpacity
            key={g.label}
            style={styles.toolItem}
            activeOpacity={0.7}
            onPress={() => g.label === "الألعاب" && router.push("/games")}
          >
            <View style={[styles.toolIcon, { backgroundColor: g.color + "1A" }]}>
              <Ionicons name={g.icon} size={22} color={g.color} />
            </View>
            <Text style={[styles.toolLabel, { color: colors.foreground }]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Store entry */}
      <TouchableOpacity
        style={[styles.storeRow, { backgroundColor: colors.card }]}
        activeOpacity={0.8}
        onPress={() => router.push("/store")}
      >
        <Ionicons name="storefront" size={22} color={colors.primary} />
        <Text style={[styles.storeText, { color: colors.foreground }]}>المتجر</Text>
        <Ionicons name="chevron-back" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  screenTitle: { fontSize: 22, fontWeight: "800" as const },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  avatarWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2.5,
    overflow: "hidden",
  },
  avatar: { width: "100%", height: "100%" },
  name: { fontSize: 19, fontWeight: "800" as const, marginBottom: 2 },
  username: { fontSize: 13, marginBottom: 6 },
  badgeRow: { flexDirection: "row", gap: 6 },
  lvBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  lvBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" as const },
  vipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  vipBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" as const },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 18, fontWeight: "800" as const },
  statLabel: { fontSize: 12 },
  recharge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  rechargeLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  rechargeTitle: { color: "#fff", fontSize: 16, fontWeight: "800" as const },
  rechargeSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  rechargeBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  rechargeBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" as const },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    paddingHorizontal: 20,
    marginBottom: 12,
    textAlign: "right",
  },
  aristoRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginBottom: 20 },
  aristoCard: { flex: 1, borderRadius: 18, overflow: "hidden" },
  aristoGrad: { padding: 16, alignItems: "center", gap: 4 },
  aristoTitle: { color: "#fff", fontSize: 18, fontWeight: "900" as const },
  aristoSub: { color: "rgba(255,255,255,0.85)", fontSize: 11 },
  toolsCard: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginHorizontal: 16,
    borderRadius: 18,
    paddingVertical: 18,
    marginBottom: 20,
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  toolItem: { alignItems: "center", gap: 8 },
  toolIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  toolLabel: { fontSize: 12, fontWeight: "600" as const },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
  },
  storeText: { flex: 1, fontSize: 15, fontWeight: "700" as const, textAlign: "right" },
});
