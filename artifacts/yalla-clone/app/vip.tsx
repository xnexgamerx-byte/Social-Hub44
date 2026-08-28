import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import {
  getListVipFeaturesQueryOptions,
  getListVipTiersQueryOptions,
  type VipTier,
} from "@workspace/api-client-react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QueryError } from "@/components/QueryError";
import { UserAvatar } from "@/components/UserAvatar";
import { useApp } from "@/context/AppContext";

/**
 * VIP sits on the store's ground on purpose: both screens sell, so they should
 * read as one shop. The previous brown palette here matched nothing else in
 * the app. The only colour that shifts per tier is the accent, and it comes
 * from the tier row itself so the server stays in charge of the ladder's look.
 */
const BG = "#13101F";
const CARD = "#1E1830";
const CARD_HI = "#261E3D";
const LINE = "rgba(255,255,255,0.08)";
const GOLD = "#F5C242";
const TEXT = "#FFFFFF";
const MUTED = "#9A91B5";
const INK = "#150F24";

/** Tier colours arrive as #RRGGBB; alpha is appended for fills and glows. */
function tint(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${a}` : `rgba(245,194,66,${alpha})`;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export default function VipScreen() {
  const insets = useSafeAreaInsets();
  const { user, setVip } = useApp();
  const tiersQ = useQuery(getListVipTiersQueryOptions());
  const featuresQ = useQuery(getListVipFeaturesQueryOptions());

  const [type, setType] = useState<"vip" | "svip">("vip");
  const [selLevel, setSelLevel] = useState(1);
  const [activating, setActivating] = useState(false);

  const tiers = useMemo(
    () =>
      (tiersQ.data ?? [])
        .filter((t) => t.type === type && t.active)
        .sort((a, b) => a.level - b.level),
    [tiersQ.data, type],
  );
  const features = useMemo(
    () => (featuresQ.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [featuresQ.data],
  );

  // Switching type used to jump to level 1 blindly. If a ladder starts higher
  // than 1 that left nothing selected and the screen went blank, so follow the
  // list that actually came back.
  useEffect(() => {
    if (tiers.length > 0 && !tiers.some((t) => t.level === selLevel)) {
      setSelLevel(tiers[0]!.level);
    }
  }, [tiers, selLevel]);

  const selected: VipTier | undefined = tiers.find((t) => t.level === selLevel);
  const accent = selected?.color ?? GOLD;

  const isCurrent = user.vipType === type && user.vipLevel === selLevel;
  const eligible = selected ? user.vPoints >= selected.pointsRequired : false;
  const progress = selected
    ? Math.min(1, user.vPoints / Math.max(1, selected.pointsRequired))
    : 0;
  const remaining = selected ? Math.max(0, selected.pointsRequired - user.vPoints) : 0;

  // Showing what a tier leaves out is the argument for the tier above it, so
  // both halves of the list are rendered rather than one grid of look-alikes.
  const { included, excluded } = useMemo(() => {
    const keys = new Set(selected?.features ?? []);
    return {
      included: features.filter((f) => keys.has(f.key)),
      excluded: features.filter((f) => !keys.has(f.key)),
    };
  }, [features, selected]);

  const activate = async () => {
    if (!selected || isCurrent || activating) return;
    setActivating(true);
    const result = await setVip(selLevel, type);
    setActivating(false);
    if (!result.ok) Alert.alert("VIP", result.error ?? "تعذّر تفعيل العضوية");
  };

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const botPad = Platform.OS === "web" ? 20 : insets.bottom;
  const loading = tiersQ.isLoading || featuresQ.isLoading;
  const failed = tiersQ.isError || featuresQ.isError;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
        >
          <Ionicons name="chevron-forward" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.title}>العضوية المميزة</Text>
        <View style={styles.pointsPill}>
          <Ionicons name="sparkles" size={11} color={GOLD} />
          <Text style={styles.pointsText}>{fmt(user.vPoints)}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={GOLD} />
        </View>
      ) : failed ? (
        <QueryError
          message="تعذّر تحميل بيانات العضوية."
          onRetry={() => {
            void tiersQ.refetch();
            void featuresQ.refetch();
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: botPad + 32, gap: 18 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Type switch */}
          <View style={styles.typeToggle}>
            {(["vip", "svip"] as const).map((t) => {
              const on = t === type;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setType(t)}
                  style={[styles.typeBtn, on && { backgroundColor: CARD_HI }]}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={t === "vip" ? "diamond" : "flame"}
                    size={13}
                    color={on ? GOLD : MUTED}
                  />
                  <Text style={[styles.typeBtnText, on && { color: TEXT }]}>
                    {t === "vip" ? "VIP" : "SVIP"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Hero for the selected tier */}
          <LinearGradient
            colors={[tint(accent, 0.55), tint(accent, 0.12), CARD]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={[styles.hero, { borderColor: tint(accent, 0.45) }]}
          >
            <View style={styles.heroTop}>
              <View style={[styles.heroAvatar, { borderColor: accent }]}>
                <UserAvatar uri={user.avatar} name={user.name} size={54} />
              </View>
              <View style={styles.heroText}>
                <Text style={styles.heroName} numberOfLines={1}>
                  {user.name}
                </Text>
                <View style={[styles.heroBadge, { backgroundColor: accent }]}>
                  <Ionicons name="diamond" size={11} color={INK} />
                  <Text style={styles.heroBadgeText}>
                    {type === "vip" ? "VIP" : "SVIP"} {selLevel}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.progressWrap}>
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.max(2, progress * 100)}%`, backgroundColor: accent },
                  ]}
                />
              </View>
              <View style={styles.progressRow}>
                <Text style={styles.progressHint}>
                  {isCurrent
                    ? "عضويتك الحالية"
                    : remaining > 0
                      ? `باقي ${fmt(remaining)} نقطة`
                      : "مؤهّل للتفعيل"}
                </Text>
                <Text style={styles.progressText}>
                  {fmt(user.vPoints)} / {fmt(selected?.pointsRequired ?? 0)}
                </Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.activateBtn,
                { backgroundColor: accent },
                (isCurrent || !eligible) && styles.activateBtnOff,
              ]}
              onPress={activate}
              disabled={isCurrent || !eligible || activating}
              accessibilityRole="button"
            >
              {activating ? (
                <ActivityIndicator color={INK} />
              ) : (
                <>
                  <Ionicons
                    name={isCurrent ? "checkmark-circle" : eligible ? "flash" : "lock-closed"}
                    size={16}
                    color={isCurrent || !eligible ? MUTED : INK}
                  />
                  <Text
                    style={[
                      styles.activateText,
                      (isCurrent || !eligible) && { color: MUTED },
                    ]}
                  >
                    {isCurrent
                      ? "مفعّل حالياً"
                      : eligible
                        ? "تفعيل العضوية"
                        : `تحتاج ${fmt(remaining)} نقطة`}
                  </Text>
                </>
              )}
            </Pressable>
          </LinearGradient>

          {/* The ladder. Bare numbered circles said nothing about price or
              state, so each tier carries its own cost and standing. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.ladderScroll}
            contentContainerStyle={styles.ladderContent}
          >
            {tiers.map((t) => {
              const on = t.level === selLevel;
              const owned = user.vipType === type && user.vipLevel === t.level;
              const reachable = user.vPoints >= t.pointsRequired;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setSelLevel(t.level)}
                  activeOpacity={0.85}
                  style={[
                    styles.tierCard,
                    { borderColor: on ? t.color : LINE },
                    on && { backgroundColor: tint(t.color, 0.16) },
                  ]}
                >
                  <View style={[styles.tierMark, { backgroundColor: tint(t.color, 0.9) }]}>
                    <Ionicons name="diamond" size={14} color={INK} />
                  </View>
                  <Text style={styles.tierLevel}>
                    {type === "vip" ? "VIP" : "SVIP"} {t.level}
                  </Text>
                  <Text style={styles.tierPoints}>{fmt(t.pointsRequired)}</Text>
                  <Text
                    style={[
                      styles.tierState,
                      { color: owned ? t.color : reachable ? GOLD : MUTED },
                    ]}
                  >
                    {owned ? "مفعّل" : reachable ? "متاح" : "مقفل"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Features, split. A wall of identical tiles where locked meant
              "faded" read as a broken screen rather than a locked one. */}
          <View style={styles.featSection}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>مميزات هذا المستوى</Text>
              <Text style={styles.sectionCount}>{included.length}</Text>
            </View>
            <View style={styles.featList}>
              {included.length === 0 ? (
                <Text style={styles.emptyNote}>لا مميزات مرتبطة بهذا المستوى بعد</Text>
              ) : (
                included.map((f) => (
                  <View key={f.id} style={styles.featRow}>
                    <View style={[styles.featIcon, { backgroundColor: tint(accent, 0.9) }]}>
                      <Ionicons name={(f.icon as never) || "star"} size={17} color={INK} />
                    </View>
                    <Text style={styles.featLabel} numberOfLines={2}>
                      {f.label}
                    </Text>
                    <Ionicons name="checkmark-circle" size={18} color={accent} />
                  </View>
                ))
              )}
            </View>

            {excluded.length > 0 && (
              <>
                <View style={styles.sectionHead}>
                  <Text style={[styles.sectionTitle, { color: MUTED }]}>
                    تفتحها المستويات الأعلى
                  </Text>
                  <Text style={styles.sectionCount}>{excluded.length}</Text>
                </View>
                <View style={styles.featList}>
                  {excluded.map((f) => (
                    <View key={f.id} style={styles.featRow}>
                      <View style={[styles.featIcon, styles.featIconOff]}>
                        <Ionicons name={(f.icon as never) || "star"} size={17} color={MUTED} />
                      </View>
                      <Text style={[styles.featLabel, { color: MUTED }]} numberOfLines={2}>
                        {f.label}
                      </Text>
                      <Ionicons name="lock-closed" size={15} color={MUTED} />
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: TEXT, fontSize: 17, fontWeight: "800" as const },
  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: LINE,
  },
  pointsText: { color: GOLD, fontSize: 12, fontWeight: "800" as const },

  typeToggle: {
    flexDirection: "row",
    backgroundColor: CARD,
    borderRadius: 14,
    marginHorizontal: 16,
    padding: 4,
    gap: 4,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  typeBtnText: { color: MUTED, fontSize: 13.5, fontWeight: "800" as const },

  hero: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 15,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroText: { flex: 1, alignItems: "flex-end", gap: 7 },
  heroName: { color: TEXT, fontSize: 16, fontWeight: "800" as const, textAlign: "right" as const },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  heroBadgeText: { color: INK, fontSize: 11.5, fontWeight: "900" as const },

  progressWrap: { gap: 7 },
  progressBg: {
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.4)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressHint: { color: "rgba(255,255,255,0.72)", fontSize: 11.5 },
  progressText: { color: TEXT, fontSize: 11.5, fontWeight: "700" as const },

  activateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 14,
    paddingVertical: 13,
  },
  activateBtnOff: { backgroundColor: "rgba(255,255,255,0.07)" },
  activateText: { color: INK, fontSize: 14.5, fontWeight: "800" as const },

  ladderScroll: { flexGrow: 0 },
  ladderContent: { paddingHorizontal: 16, gap: 10 },
  tierCard: {
    width: 96,
    backgroundColor: CARD,
    borderRadius: 15,
    borderWidth: 1.5,
    paddingVertical: 12,
    alignItems: "center",
    gap: 5,
  },
  tierMark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  tierLevel: { color: TEXT, fontSize: 12.5, fontWeight: "800" as const },
  tierPoints: { color: MUTED, fontSize: 11 },
  tierState: { fontSize: 10.5, fontWeight: "800" as const },

  featSection: { gap: 10 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 4,
  },
  sectionTitle: { color: TEXT, fontSize: 15, fontWeight: "800" as const, textAlign: "right" as const },
  sectionCount: { color: MUTED, fontSize: 12, fontWeight: "700" as const },
  featList: { marginHorizontal: 16, backgroundColor: CARD, borderRadius: 16, overflow: "hidden" },
  featRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  featIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  featIconOff: { backgroundColor: "rgba(255,255,255,0.06)" },
  featLabel: {
    flex: 1,
    color: TEXT,
    fontSize: 13.5,
    fontWeight: "600" as const,
    textAlign: "right" as const,
    lineHeight: 19,
  },
  emptyNote: {
    color: MUTED,
    fontSize: 13,
    textAlign: "center" as const,
    paddingVertical: 22,
  },
});
