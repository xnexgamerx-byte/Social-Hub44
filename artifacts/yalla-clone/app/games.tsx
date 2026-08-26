import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
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
import { LudoBackdrop } from "@/components/ludo/LudoBackdrop";
import { LudoModeCard } from "@/components/ludo/LudoModeCard";
import { LudoWordmark } from "@/components/ludo/LudoWordmark";
import { MiniLudoBoard } from "@/components/ludo/MiniLudoBoard";
import { UserAvatar } from "@/components/UserAvatar";
import { useApp } from "@/context/AppContext";

/** Table ids are short and shareable so friends can join the same game. */
function newTableId(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

/** A die face, drawn rather than shipped as art. */
function Die({ size = 46, pips = 6 }: { size?: number; pips?: number }) {
  const dot = size * 0.15;
  // Columns × rows the pips occupy, per face.
  const layout: Record<number, [number, number][]> = {
    1: [[1, 1]],
    5: [
      [0, 0],
      [2, 0],
      [1, 1],
      [0, 2],
      [2, 2],
    ],
    6: [
      [0, 0],
      [2, 0],
      [0, 1],
      [2, 1],
      [0, 2],
      [2, 2],
    ],
  };
  const spots = layout[pips] ?? layout[6];
  return (
    <View style={[styles.die, { width: size, height: size, borderRadius: size * 0.22 }]}>
      {spots.map(([c, r], i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: "#2A2440",
            left: size * 0.18 + c * (size * 0.29) - dot / 2,
            top: size * 0.18 + r * (size * 0.29) - dot / 2,
          }}
        />
      ))}
    </View>
  );
}

function Coin({ size = 34, color = "#3BA55C" }: { size?: number; color?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: size * 0.09,
        borderColor: "rgba(255,255,255,0.45)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="game-controller" size={size * 0.45} color="rgba(255,255,255,0.9)" />
    </View>
  );
}

function Flag({ color, flip = false }: { color: string; flip?: boolean }) {
  return (
    <View style={[styles.flagWrap, flip && { transform: [{ scaleX: -1 }] }]}>
      <View style={[styles.flagCloth, { backgroundColor: color }]} />
      <View style={styles.flagPole} />
    </View>
  );
}

export default function GamesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const { user } = useApp();

  const [joinCode, setJoinCode] = useState("");
  const [showJoin, setShowJoin] = useState(false);

  const openTable = (query: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/ludo/${newTableId()}?${query}`);
  };

  const joinByCode = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    // The table's real size comes from whoever opened it; the mode here is
    // only a fallback if the code turns out to be a fresh table.
    router.push(`/ludo/${code}?mode=4`);
    setJoinCode("");
    setShowJoin(false);
  };

  return (
    <View style={styles.container}>
      <LudoBackdrop />

      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 18,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.powerBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="خروج"
          >
            <Ionicons name="power" size={20} color="#EAF6FF" />
          </TouchableOpacity>

          <View style={styles.coinPill}>
            <TouchableOpacity
              style={styles.coinPlus}
              onPress={() => router.push("/recharge")}
              accessibilityLabel="شحن"
            >
              <Ionicons name="add" size={15} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.coinText}>{user.coins.toLocaleString("en-US")}</Text>
            <View style={styles.coinIcon}>
              <Ionicons name="logo-bitcoin" size={13} color="#8A5B00" />
            </View>
          </View>

          <View style={styles.identity}>
            <Text style={styles.userName} numberOfLines={1}>
              {user.name || "لاعب"}
            </Text>
            <View style={styles.avatarWrap}>
              <UserAvatar uri={user.avatar} name={user.name} size={42} />
              <View style={styles.levelDot}>
                <Text style={styles.levelText}>{user.level}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Store shortcut, tucked under the curtain like the reference */}
        <TouchableOpacity
          style={styles.storeBtn}
          onPress={() => router.push("/store")}
          activeOpacity={0.85}
        >
          <View style={styles.storeIcon}>
            <Ionicons name="basket" size={22} color="#FFD75E" />
          </View>
          <Text style={styles.storeLabel}>المتجر</Text>
        </TouchableOpacity>

        <LudoWordmark />

        {/* Modes */}
        <View style={styles.modes}>
          <LudoModeCard
            label="1V1"
            colors={["#3FC3B8", "#159189"]}
            banner={["#2FB3A8", "#0E7A78"]}
            height={150}
            onPress={() => openTable("mode=2")}
          >
            <View style={styles.duelArt}>
              <View style={styles.tiltBoard}>
                <MiniLudoBoard size={104} seats={2} />
              </View>
              <View style={styles.duelDie}>
                <Die size={54} pips={6} />
              </View>
              <View style={styles.duelCoin}>
                <Coin size={38} color="#3BA55C" />
              </View>
            </View>
          </LudoModeCard>

          <View style={styles.modeRow}>
            <View style={styles.modeHalf}>
              <LudoModeCard
                label="الفرق pk"
                colors={["#E56BD6", "#A032C9"]}
                banner={["#C74BC0", "#8626A8"]}
                height={128}
                onPress={() => openTable("mode=4&teams=1")}
              >
                <View style={styles.teamArt}>
                  <View style={styles.flagRow}>
                    <Flag color="#E14B4B" />
                    <Flag color="#3E7BE0" flip />
                  </View>
                  <Text style={styles.vsText} allowFontScaling={false}>
                    VS
                  </Text>
                </View>
              </LudoModeCard>
            </View>

            <View style={styles.modeHalf}>
              <LudoModeCard
                label="4 لاعبين"
                colors={["#5AA6F0", "#1E5FC4"]}
                banner={["#3E88DE", "#1A4FA8"]}
                height={128}
                onPress={() => openTable("mode=4")}
              >
                <View style={styles.quadArt}>
                  <View style={styles.tiltBoardSmall}>
                    <MiniLudoBoard size={84} seats={4} />
                  </View>
                  <View style={styles.quadCoin}>
                    <Coin size={30} color="#F0B429" />
                  </View>
                </View>
              </LudoModeCard>
            </View>
          </View>
        </View>

        {/* Joining a friend's table — kept out of the way but reachable. */}
        {showJoin ? (
          <View style={styles.joinRow}>
            <TextInput
              style={styles.joinInput}
              placeholder="رمز الطاولة"
              placeholderTextColor="rgba(255,255,255,0.45)"
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="characters"
              maxLength={8}
              onSubmitEditing={joinByCode}
              returnKeyType="go"
              textAlign="center"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.joinGo, !joinCode.trim() && styles.joinGoOff]}
              onPress={joinByCode}
              disabled={!joinCode.trim()}
            >
              <Ionicons name="enter" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.joinToggle} onPress={() => setShowJoin(true)}>
            <Ionicons name="key-outline" size={15} color="rgba(255,255,255,0.75)" />
            <Text style={styles.joinToggleText}>انضم لطاولة برمز</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#2B2570" },

  topBar: { flexDirection: "row", alignItems: "center", gap: 10 },
  powerBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(60,150,220,0.55)",
    borderWidth: 2,
    borderColor: "rgba(180,225,255,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  coinPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 5,
    backgroundColor: "rgba(20,40,90,0.5)",
    borderWidth: 1.5,
    borderColor: "rgba(150,200,255,0.45)",
  },
  coinPlus: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#3E8FE0",
    alignItems: "center",
    justifyContent: "center",
  },
  coinText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800" as const,
    textAlign: "center" as const,
  },
  coinIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFC93C",
    alignItems: "center",
    justifyContent: "center",
  },
  identity: { flexDirection: "row", alignItems: "center", gap: 8 },
  userName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700" as const,
    maxWidth: 78,
    textAlign: "right" as const,
  },
  avatarWrap: {
    borderWidth: 2,
    borderColor: "#F0C24B",
    borderRadius: 25,
    padding: 1,
  },
  levelDot: {
    position: "absolute",
    top: -3,
    left: -6,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: "#E8892B",
    borderWidth: 1.5,
    borderColor: "#FFE0A8",
    alignItems: "center",
    justifyContent: "center",
  },
  levelText: { color: "#fff", fontSize: 10, fontWeight: "900" as const },

  storeBtn: { alignItems: "center", alignSelf: "flex-start", marginTop: 14, gap: 2 },
  storeIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(30,70,140,0.55)",
    borderWidth: 2,
    borderColor: "#F0C24B",
    alignItems: "center",
    justifyContent: "center",
  },
  storeLabel: {
    color: "#FFE9A8",
    fontSize: 11,
    fontWeight: "800" as const,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  modes: { marginTop: 26, gap: 16 },
  modeRow: { flexDirection: "row", gap: 14 },
  modeHalf: { flex: 1 },

  duelArt: { width: "100%", alignItems: "center", justifyContent: "center" },
  tiltBoard: { transform: [{ rotate: "-14deg" }] },
  duelDie: { position: "absolute", top: 4, alignSelf: "center" },
  duelCoin: { position: "absolute", right: 26, bottom: 12 },

  quadArt: { alignItems: "center", justifyContent: "center" },
  tiltBoardSmall: { transform: [{ rotate: "-10deg" }] },
  quadCoin: { position: "absolute", top: 2, left: 6 },

  teamArt: { alignItems: "center", justifyContent: "center" },
  flagRow: { flexDirection: "row", gap: 34 },
  flagWrap: { width: 30, height: 44 },
  flagCloth: {
    position: "absolute",
    left: 4,
    top: 2,
    width: 26,
    height: 18,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  flagPole: {
    position: "absolute",
    left: 2,
    top: 0,
    width: 3.5,
    height: 44,
    borderRadius: 2,
    backgroundColor: "#D8DEE8",
  },
  vsText: {
    position: "absolute",
    color: "#FFD75E",
    fontSize: 40,
    fontWeight: "900" as const,
    textShadowColor: "rgba(90,20,110,0.7)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 3,
  },

  die: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },

  joinToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 22,
    paddingVertical: 10,
  },
  joinToggleText: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "600" as const },
  joinRow: { flexDirection: "row", gap: 10, marginTop: 22 },
  joinInput: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    color: "#fff",
    fontSize: 16,
    fontWeight: "700" as const,
    letterSpacing: 3,
  },
  joinGo: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#3E8FE0",
    alignItems: "center",
    justifyContent: "center",
  },
  joinGoOff: { backgroundColor: "rgba(255,255,255,0.15)" },
});
