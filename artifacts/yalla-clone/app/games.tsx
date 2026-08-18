import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import type { LudoMode } from "@/hooks/useLudoSession";

const MODES: {
  mode: LudoMode;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: [string, string];
}[] = [
  {
    mode: 2,
    title: "مواجهة ثنائية",
    subtitle: "أنت وخصمك وجهاً لوجه — الأسرع للبيت يفوز",
    icon: "flash",
    colors: ["#F0453A", "#F5B400"],
  },
  {
    mode: 4,
    title: "طاولة رباعية",
    subtitle: "أربعة لاعبين، أربعة ألوان — لودو الكلاسيكية",
    icon: "people",
    colors: ["#7C5CFC", "#2F80ED"],
  },
];

/** Table ids are short and shareable so friends can join the same game. */
function newTableId(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export default function GamesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [joinCode, setJoinCode] = useState("");

  const openTable = (mode: LudoMode, tableId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/ludo/${tableId}?mode=${mode}`);
  };

  const joinByCode = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    // The table's real size comes from whoever opened it; the mode we pass is
    // only a fallback if the code turns out to be a fresh table.
    router.push(`/ludo/${code}?mode=4`);
    setJoinCode("");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>لودو</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 40,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <LinearGradient
          colors={["#2A0E6B", "#4C1D95"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroDice}>
            <Ionicons name="dice" size={34} color="#FFD75E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>لودو أونلاين</Text>
            <Text style={styles.heroSub}>
              العب مع أصدقائك مباشرة — بالصوت والدردشة والهدايا
            </Text>
          </View>
        </LinearGradient>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>اختر الطور</Text>

        {MODES.map((m) => (
          <TouchableOpacity
            key={m.mode}
            activeOpacity={0.9}
            onPress={() => openTable(m.mode, newTableId())}
          >
            <LinearGradient
              colors={m.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modeCard}
            >
              <View style={styles.modeIcon}>
                <Ionicons name={m.icon} size={26} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modeTitle}>{m.title}</Text>
                <Text style={styles.modeSub}>{m.subtitle}</Text>
              </View>
              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>{m.mode}</Text>
                <Ionicons name="person" size={11} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}

        {/* Join by code */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          انضم لطاولة صديق
        </Text>
        <View style={styles.joinRow}>
          <View
            style={[
              styles.joinInputWrap,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TextInput
              style={[styles.joinInput, { color: colors.foreground }]}
              placeholder="رمز الطاولة"
              placeholderTextColor={colors.mutedForeground}
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="characters"
              maxLength={8}
              onSubmitEditing={joinByCode}
              returnKeyType="go"
              textAlign="center"
            />
          </View>
          <TouchableOpacity
            style={[
              styles.joinBtn,
              { backgroundColor: joinCode.trim() ? colors.primary : colors.muted },
            ]}
            onPress={joinByCode}
            disabled={!joinCode.trim()}
          >
            <Ionicons
              name="enter"
              size={19}
              color={joinCode.trim() ? "#fff" : colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          افتح طاولة وشارك رمزها الظاهر بالأعلى مع أصدقائك ليدخلوا نفس اللعبة.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 18, fontWeight: "800" as const, textAlign: "center" as const },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 20,
    padding: 18,
  },
  heroDice: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: "#fff", fontSize: 19, fontWeight: "800" as const },
  heroSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  sectionTitle: { fontSize: 15, fontWeight: "800" as const, marginTop: 6 },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    padding: 16,
  },
  modeIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  modeTitle: { color: "#fff", fontSize: 16, fontWeight: "800" as const },
  modeSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  modeBadgeText: { color: "#fff", fontSize: 13, fontWeight: "800" as const },
  joinRow: { flexDirection: "row", gap: 10 },
  joinInputWrap: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
  },
  joinInput: { fontSize: 16, fontWeight: "700" as const, letterSpacing: 3 },
  joinBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { fontSize: 12, textAlign: "center" as const, lineHeight: 18 },
});
