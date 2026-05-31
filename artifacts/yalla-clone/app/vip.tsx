import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import {
  getListVipFeaturesQueryOptions,
  getListVipTiersQueryOptions,
  type VipTier,
} from "@workspace/api-client-react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";

const BG = "#2A1A12";
const CARD = "#3A2518";
const GOLD = "#F5C242";
const GOLD_DIM = "#C9972B";
const TEXT = "#FFF6E9";
const MUTED = "#B89B7A";

export default function VipScreen() {
  const insets = useSafeAreaInsets();
  const { user, setVip } = useApp();
  const tiersQ = useQuery(getListVipTiersQueryOptions());
  const featuresQ = useQuery(getListVipFeaturesQueryOptions());

  const [type, setType] = useState<"vip" | "svip">("vip");
  const tiers = useMemo(
    () =>
      (tiersQ.data ?? [])
        .filter((t) => t.type === type && t.active)
        .sort((a, b) => a.level - b.level),
    [tiersQ.data, type],
  );
  const features = useMemo(
    () =>
      (featuresQ.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [featuresQ.data],
  );

  const [selLevel, setSelLevel] = useState(1);
  const selected: VipTier | undefined = tiers.find((t) => t.level === selLevel);

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const isCurrent = user.vipType === type && user.vipLevel === selLevel;

  const progress = selected
    ? Math.min(1, user.vPoints / Math.max(1, selected.pointsRequired))
    : 0;

  if (tiersQ.isLoading || featuresQ.isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-forward" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.title}>{type === "vip" ? "VIP" : "SVIP"}</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.typeToggle}>
        {(["vip", "svip"] as const).map((t) => {
          const on = t === type;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => {
                setType(t);
                setSelLevel(1);
              }}
              style={[styles.typeBtn, on && styles.typeBtnOn]}
            >
              <Text style={[styles.typeBtnText, on && styles.typeBtnTextOn]}>
                {t === "vip" ? "VIP" : "SVIP"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 30,
        }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[selected?.color ?? GOLD_DIM, "#1A0F08"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <Image source={{ uri: user.avatar }} style={styles.heroAvatar} />
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={styles.heroName}>{user.name}</Text>
              <View style={styles.heroBadge}>
                <Ionicons name="diamond" size={12} color="#1A0F08" />
                <Text style={styles.heroBadgeText}>
                  {type === "vip" ? "VIP" : "SVIP"} {selLevel}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {user.vPoints.toLocaleString()} / {selected?.pointsRequired.toLocaleString()}
            </Text>
          </View>

          <Pressable
            style={[styles.activateBtn, isCurrent && styles.activateBtnOn]}
            onPress={() => setVip(selLevel, type)}
            disabled={isCurrent}
          >
            <Text style={styles.activateText}>
              {isCurrent ? "مفعّل حالياً" : "تفعيل"}
            </Text>
          </Pressable>
        </LinearGradient>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.levelScroll}
          contentContainerStyle={styles.levelContent}
        >
          {tiers.map((t) => {
            const on = t.level === selLevel;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setSelLevel(t.level)}
                style={[styles.levelChip, { borderColor: t.color }, on && { backgroundColor: t.color }]}
              >
                <Text style={[styles.levelChipText, on && styles.levelChipTextOn]}>
                  {t.level}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>المميزات الحصرية</Text>
        <View style={styles.featGrid}>
          {features.map((f) => {
            const unlocked = selected?.features.includes(f.key) ?? false;
            return (
              <View key={f.id} style={[styles.featCard, !unlocked && styles.featLocked]}>
                <View style={[styles.featIcon, unlocked && styles.featIconOn]}>
                  <Ionicons
                    name={(f.icon as never) || "star"}
                    size={20}
                    color={unlocked ? "#1A0F08" : MUTED}
                  />
                  {!unlocked && (
                    <View style={styles.lockBadge}>
                      <Ionicons name="lock-closed" size={9} color="#1A0F08" />
                    </View>
                  )}
                </View>
                <Text style={[styles.featLabel, !unlocked && { color: MUTED }]} numberOfLines={2}>
                  {f.label}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: GOLD, fontSize: 20, fontWeight: "800" },
  typeToggle: {
    flexDirection: "row",
    backgroundColor: CARD,
    borderRadius: 22,
    marginHorizontal: 16,
    padding: 4,
    marginBottom: 12,
  },
  typeBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 18 },
  typeBtnOn: { backgroundColor: GOLD },
  typeBtnText: { color: MUTED, fontSize: 14, fontWeight: "800" },
  typeBtnTextOn: { color: "#1A0F08" },
  hero: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  heroAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: GOLD },
  heroName: { color: TEXT, fontSize: 16, fontWeight: "800", marginBottom: 6 },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  heroBadgeText: { color: "#1A0F08", fontSize: 12, fontWeight: "800" },
  progressWrap: { marginBottom: 16 },
  progressBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.35)",
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: { height: "100%", backgroundColor: GOLD, borderRadius: 4 },
  progressText: { color: TEXT, fontSize: 11, textAlign: "right", fontWeight: "600" },
  activateBtn: {
    backgroundColor: GOLD,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: "center",
  },
  activateBtnOn: { backgroundColor: "rgba(245,194,66,0.3)" },
  activateText: { color: "#1A0F08", fontSize: 15, fontWeight: "800" },
  levelScroll: { flexGrow: 0, marginBottom: 16 },
  levelContent: { paddingHorizontal: 16, gap: 10 },
  levelChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD,
  },
  levelChipText: { color: TEXT, fontSize: 15, fontWeight: "800" },
  levelChipTextOn: { color: "#1A0F08" },
  sectionTitle: {
    color: GOLD,
    fontSize: 16,
    fontWeight: "800",
    paddingHorizontal: 20,
    marginBottom: 12,
    textAlign: "right",
  },
  featGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    gap: 10,
  },
  featCard: {
    width: "30%",
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    gap: 8,
  },
  featLocked: { opacity: 0.55 },
  featIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4A3322",
    alignItems: "center",
    justifyContent: "center",
  },
  featIconOn: { backgroundColor: GOLD },
  lockBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: MUTED,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  featLabel: { color: TEXT, fontSize: 11, fontWeight: "600", textAlign: "center", lineHeight: 15 },
});
