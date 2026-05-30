import { Feather, Ionicons } from "@expo/vector-icons";
import React from "react";
import {
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

const LEVEL_COLORS = ["#06B6D4", "#7C3AED", "#EC4899", "#F59E0B", "#EF4444"];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const levelColor = LEVEL_COLORS[user.level % LEVEL_COLORS.length];

  const SETTINGS = [
    { icon: "person-outline" as const, label: "تعديل الملف الشخصي" },
    { icon: "notifications-outline" as const, label: "الإشعارات" },
    { icon: "shield-checkmark-outline" as const, label: "الخصوصية والأمان" },
    { icon: "language-outline" as const, label: "اللغة" },
    { icon: "help-circle-outline" as const, label: "المساعدة والدعم" },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: topPad + 10,
        paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 90,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>الملف الشخصي</Text>
        <TouchableOpacity>
          <Ionicons name="settings-outline" size={24} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatarWrapper, { borderColor: colors.primary }]}>
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          </View>
          <View style={[styles.levelBadge, { backgroundColor: levelColor }]}>
            <Text style={styles.levelText}>Lv {user.level}</Text>
          </View>
        </View>

        <Text style={[styles.name, { color: colors.foreground }]}>{user.name}</Text>
        <Text style={[styles.username, { color: colors.mutedForeground }]}>{user.username}</Text>
        <Text style={[styles.bio, { color: colors.mutedForeground }]}>{user.bio}</Text>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {user.followers.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>متابع</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {user.following.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>متابَع</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Ionicons name="star" size={14} color={colors.accent} style={{ marginBottom: 2 }} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {user.coins.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>عملات</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.editBtn, { borderColor: colors.primary }]}>
          <Feather name="edit-2" size={15} color={colors.primary} />
          <Text style={[styles.editBtnText, { color: colors.primary }]}>تعديل الملف</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الإعدادات</Text>

      <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {SETTINGS.map((s, i) => (
          <TouchableOpacity
            key={s.label}
            style={[
              styles.settingItem,
              i < SETTINGS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
            activeOpacity={0.7}
          >
            <Ionicons name={s.icon} size={20} color={colors.mutedForeground} />
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>{s.label}</Text>
            <Ionicons name="chevron-back" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[styles.logoutBtn, { borderColor: colors.destructive + "55" }]}>
        <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "800" as const,
  },
  profileCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  avatarRow: {
    position: "relative",
    marginBottom: 14,
  },
  avatarWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  levelBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800" as const,
  },
  name: {
    fontSize: 20,
    fontWeight: "800" as const,
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    marginBottom: 8,
  },
  bio: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    width: "100%",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 16,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800" as const,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: "100%",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  settingsCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 12,
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
});
