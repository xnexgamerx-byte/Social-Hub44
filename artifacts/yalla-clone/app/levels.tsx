import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getGetMyLevelQueryOptions } from "@workspace/api-client-react";
import { QueryError } from "@/components/QueryError";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";

/** Where the coins that raise a level actually come from. */
const SOURCES = [
  { icon: "gift" as const, label: "إرسال الهدايا", detail: "كل كوين تهديه يُحسب" },
  { icon: "storefront" as const, label: "الشراء من المتجر", detail: "الإطارات والدخوليات والخلفيات" },
];

const NOT_COUNTED = [
  "شحن الكوينزات — الشراء نفسه لا يرفع المستوى، الصرف هو اللي يرفعه",
  "مكافآت المهام والدعوات",
  "الأغراض المشتراة بالماسات",
];

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export default function LevelsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const levelQ = useQuery(getGetMyLevelQueryOptions());
  const data = levelQ.data;

  const progress = data
    ? Math.min(1, data.nextAt > 0 ? data.spent / data.nextAt : 1)
    : 0;
  const remaining = data ? Math.max(0, data.nextAt - data.spent) : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="مستواي" />

      {levelQ.isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : levelQ.isError || !data ? (
        <QueryError message="تعذّر تحميل مستواك." onRetry={() => void levelQ.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 18 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Current standing */}
          <LinearGradient
            colors={[data.badgeColor, colors.card]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.hero}
          >
            <View style={[styles.badge, { borderColor: data.badgeColor }]}>
              <Text style={styles.badgeNum}>{data.level}</Text>
            </View>
            <Text style={styles.heroLabel}>مستواك الحالي</Text>

            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${Math.max(2, progress * 100)}%`, backgroundColor: data.badgeColor },
                ]}
              />
            </View>
            <Text style={styles.barText}>
              {fmt(data.spent)} / {fmt(data.nextAt)} كوين
            </Text>
            <Text style={styles.remaining}>
              {remaining > 0
                ? `باقي ${fmt(remaining)} كوين للمستوى ${data.level + 1}`
                : "وصلت أعلى مستوى"}
            </Text>
          </LinearGradient>

          {/* How it rises — the part that was never explained anywhere. */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              كيف يرتفع المستوى
            </Text>
            {SOURCES.map((s) => (
              <View key={s.label} style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: colors.secondary }]}>
                  <Ionicons name={s.icon} size={16} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>{s.label}</Text>
                  <Text style={[styles.rowDetail, { color: colors.mutedForeground }]}>
                    {s.detail}
                  </Text>
                </View>
              </View>
            ))}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.cardTitle, { color: colors.mutedForeground, fontSize: 13 }]}>
              لا يُحتسب
            </Text>
            {NOT_COUNTED.map((line) => (
              <View key={line} style={styles.excluded}>
                <Ionicons name="close" size={13} color={colors.mutedForeground} />
                <Text style={[styles.excludedText, { color: colors.mutedForeground }]}>
                  {line}
                </Text>
              </View>
            ))}
          </View>

          {/* What each level unlocks. Short on purpose: only levels that change
              something appear. */}
          <View style={styles.ladder}>
            <Text style={[styles.cardTitle, { color: colors.foreground, paddingHorizontal: 4 }]}>
              ما يفتحه كل مستوى
            </Text>
            {data.perks.map((perk) => {
              const reached = data.level >= perk.level;
              return (
                <View
                  key={perk.level}
                  style={[
                    styles.perk,
                    { backgroundColor: colors.card, opacity: reached ? 1 : 0.62 },
                  ]}
                >
                  <View
                    style={[
                      styles.perkLevel,
                      { backgroundColor: reached ? colors.primary : colors.muted },
                    ]}
                  >
                    <Text
                      style={[
                        styles.perkLevelNum,
                        { color: reached ? colors.primaryForeground : colors.mutedForeground },
                      ]}
                    >
                      {perk.level}
                    </Text>
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.perkTitle, { color: colors.foreground }]}>
                      {perk.title}
                    </Text>
                    <Text style={[styles.perkDetail, { color: colors.mutedForeground }]}>
                      {perk.detail}
                    </Text>
                    <Text style={[styles.perkCost, { color: colors.mutedForeground }]}>
                      {fmt(perk.cost)} كوين مصروف
                    </Text>
                  </View>
                  {reached ? (
                    <Ionicons name="checkmark-circle" size={19} color={colors.primary} />
                  ) : (
                    <Ionicons name="lock-closed" size={15} color={colors.mutedForeground} />
                  )}
                </View>
              );
            })}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name="home" size={16} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                  غرفك المسموحة الآن: {data.roomLimit}
                </Text>
                <Text style={[styles.rowDetail, { color: colors.mutedForeground }]}>
                  يرتفع الحد مع المستوى
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/store")}
            activeOpacity={0.85}
          >
            <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
              تصفّح المتجر
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 50 },

  hero: { borderRadius: 18, padding: 20, alignItems: "center", gap: 9 },
  badge: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeNum: { color: "#FFFFFF", fontSize: 30, fontWeight: "900" as const },
  heroLabel: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600" as const },
  barTrack: {
    width: "100%",
    height: 8,
    borderRadius: 5,
    backgroundColor: "rgba(0,0,0,0.3)",
    overflow: "hidden",
    marginTop: 4,
  },
  barFill: { height: "100%", borderRadius: 5 },
  barText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" as const },
  remaining: { color: "rgba(255,255,255,0.85)", fontSize: 12 },

  card: { borderRadius: 15, padding: 15, gap: 11 },
  cardTitle: { fontSize: 15, fontWeight: "800" as const, textAlign: "right" as const },
  row: { flexDirection: "row", alignItems: "center", gap: 11 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2, alignItems: "flex-end" },
  rowLabel: { fontSize: 14, fontWeight: "600" as const, textAlign: "right" as const },
  rowDetail: { fontSize: 12, lineHeight: 17, textAlign: "right" as const },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 3 },
  excluded: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  excludedText: { flex: 1, fontSize: 12, lineHeight: 18, textAlign: "right" as const },

  ladder: { gap: 10 },
  perk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 14,
  },
  perkLevel: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  perkLevelNum: { fontSize: 14, fontWeight: "900" as const },
  perkTitle: { fontSize: 14.5, fontWeight: "700" as const, textAlign: "right" as const },
  perkDetail: { fontSize: 12.5, lineHeight: 18, textAlign: "right" as const },
  perkCost: { fontSize: 11.5, marginTop: 2, textAlign: "right" as const },

  cta: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  ctaText: { fontSize: 15, fontWeight: "800" as const },
});
