import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo } from "react";
import {
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
import {
  useLudoSession,
  type LudoColor,
  type LudoPlayer,
} from "@/hooks/useLudoSession";
import { UserAvatar } from "@/components/UserAvatar";

const COLOR_HEX: Record<LudoColor, string> = {
  red: "#EF4444",
  green: "#22C55E",
  yellow: "#F5C242",
  blue: "#3B82F6",
};

const COLOR_LABEL: Record<LudoColor, string> = {
  red: "الأحمر",
  green: "الأخضر",
  yellow: "الأصفر",
  blue: "الأزرق",
};

const FINISH = 57;
const TRACK_LEN = 57; // positions 0..56 then 57 = home

// Pip layouts for a die face (3x3 grid cells that are filled).
const DICE_PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function tokenLabel(pos: number): string {
  if (pos === -1) return "القاعدة";
  if (pos === FINISH) return "وصل ★";
  if (pos >= 51) return `البيت ${pos - 50}/6`;
  return `${pos}`;
}

export default function LudoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const me = useMemo(
    () => ({ userId: user.id, userName: user.name, userAvatar: user.avatar }),
    [user.id, user.name, user.avatar],
  );

  const { state, lastDice, error, connected, start, roll, move, clearError } =
    useLudoSession(id, me);

  useEffect(() => {
    if (error) {
      const t = setTimeout(clearError, 2500);
      return () => clearTimeout(t);
    }
  }, [error, clearError]);

  const myColor = state?.players.find((p) => p.userId === user.id)?.color ?? null;
  const isMyTurn = !!myColor && state?.turn === myColor;
  const canRoll = state?.phase === "playing" && isMyTurn && !state.awaitingMove && state.dice == null;
  const canMove = state?.phase === "playing" && isMyTurn && state.awaitingMove;

  const handleRoll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    roll();
  };

  const handleMove = (tokenIndex: number) => {
    if (!canMove || !state?.movable.includes(tokenIndex)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    move(tokenIndex);
  };

  const renderPlayerCard = (p: LudoPlayer) => {
    const hex = COLOR_HEX[p.color];
    const isTurn = state?.turn === p.color;
    const isMe = p.userId === user.id;
    return (
      <View
        key={p.userId}
        style={[
          styles.playerCard,
          { backgroundColor: colors.card, borderColor: isTurn ? hex : colors.border, borderWidth: isTurn ? 2 : 1 },
        ]}
      >
        <View style={styles.playerHeader}>
          <View style={[styles.colorDot, { backgroundColor: hex }]} />
          <UserAvatar uri={p.userAvatar} size={30} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>
              {p.userName}{isMe ? " (أنت)" : ""}
            </Text>
            <Text style={[styles.playerMeta, { color: colors.mutedForeground }]}>
              {COLOR_LABEL[p.color]} · {p.finished}/4 وصلوا
            </Text>
          </View>
          {isTurn && state?.phase === "playing" && (
            <View style={[styles.turnPill, { backgroundColor: hex + "22" }]}>
              <Text style={[styles.turnPillText, { color: hex }]}>دوره</Text>
            </View>
          )}
        </View>

        <View style={styles.tokensRow}>
          {p.tokens.map((pos, i) => {
            const movable = canMove && isMe && state?.movable.includes(i);
            const home = pos === FINISH;
            return (
              <TouchableOpacity
                key={i}
                disabled={!movable}
                onPress={() => handleMove(i)}
                activeOpacity={0.8}
                style={[
                  styles.token,
                  {
                    backgroundColor: home ? hex : hex + "22",
                    borderColor: movable ? colors.foreground : hex,
                    borderWidth: movable ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.tokenInner}>
                  <Ionicons
                    name={home ? "checkmark" : "ellipse"}
                    size={home ? 14 : 10}
                    color={home ? "#fff" : hex}
                  />
                  <Text style={[styles.tokenText, { color: home ? "#fff" : colors.foreground }]} numberOfLines={1}>
                    {tokenLabel(pos)}
                  </Text>
                </View>
                {movable && (
                  <View style={[styles.movableBadge, { backgroundColor: hex }]}>
                    <Ionicons name="arrow-up" size={9} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* progress bar = best token progress */}
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.progressBar,
              {
                backgroundColor: hex,
                width: `${(p.tokens.reduce((s, t) => s + (t < 0 ? 0 : t), 0) / (TRACK_LEN * 4)) * 100}%`,
              },
            ]}
          />
        </View>
      </View>
    );
  };

  const renderDie = (value: number | null) => (
    <View style={[styles.die, { backgroundColor: "#fff", borderColor: colors.border }]}>
      <View style={styles.dieGrid}>
        {Array.from({ length: 9 }).map((_, i) => {
          const filled = value != null && DICE_PIPS[value]?.includes(i);
          return (
            <View key={i} style={styles.dieCell}>
              {filled && <View style={styles.diePip} />}
            </View>
          );
        })}
      </View>
    </View>
  );

  const players = state?.players ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.gameIcon, { backgroundColor: "#F59E0B33" }]}>
          <Ionicons name="dice" size={22} color="#F59E0B" />
        </View>
        <Text style={[styles.gameName, { color: colors.foreground }]}>لودو</Text>
        <View style={[styles.scoreBadge, { backgroundColor: colors.primary + "22" }]}>
          <Ionicons name="people" size={14} color={colors.primary} />
          <Text style={[styles.scoreVal, { color: colors.primary }]}>{players.length}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={[styles.errorBox, { backgroundColor: "#EF444422", borderColor: "#EF4444" }]}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Status / turn banner */}
        <View style={[styles.statusBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statusRow}>
            <View style={[styles.onlineDot, { backgroundColor: connected ? "#22C55E" : colors.mutedForeground }]} />
            <Text style={[styles.statusText, { color: colors.foreground }]}>
              {state?.phase === "lobby" && (connected ? `${players.length} لاعب — بانتظار البدء` : "جارٍ الاتصال...")}
              {state?.phase === "playing" && (isMyTurn ? "دورك! ارمِ النرد" : `دور ${state.turn ? COLOR_LABEL[state.turn] : ""}`)}
              {state?.phase === "ended" && "انتهت اللعبة"}
            </Text>
          </View>
          {state?.phase === "playing" && renderDie(state.dice)}
        </View>

        {/* Players */}
        {players.map(renderPlayerCard)}

        {players.length === 0 && (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            جارٍ الانضمام إلى الطاولة...
          </Text>
        )}

        {/* Lobby controls */}
        {state?.phase === "lobby" && (
          <View style={{ gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              style={[styles.bigBtn, { backgroundColor: "#F59E0B", opacity: connected && players.length >= 2 ? 1 : 0.5 }]}
              onPress={start}
              disabled={!connected || players.length < 2}
              activeOpacity={0.85}
            >
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.bigBtnText}>ابدأ اللعبة</Text>
            </TouchableOpacity>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              نحتاج من ٢ إلى ٤ لاعبين. ادعُ أصدقاءك لنفس الطاولة وتنافسوا مباشرة.
            </Text>
          </View>
        )}

        {/* Roll control */}
        {state?.phase === "playing" && (
          <TouchableOpacity
            style={[
              styles.bigBtn,
              { backgroundColor: canRoll ? "#F59E0B" : colors.muted, opacity: canRoll ? 1 : 0.6 },
            ]}
            onPress={handleRoll}
            disabled={!canRoll}
            activeOpacity={0.85}
          >
            <Ionicons name="dice" size={20} color={canRoll ? "#fff" : colors.mutedForeground} />
            <Text style={[styles.bigBtnText, { color: canRoll ? "#fff" : colors.mutedForeground }]}>
              {canMove ? "اختر قطعة لتحريكها" : isMyTurn ? "ارمِ النرد" : "بانتظار دورك"}
            </Text>
          </TouchableOpacity>
        )}

        {lastDice && state?.phase === "playing" && (
          <Text style={[styles.diceLog, { color: colors.mutedForeground }]}>
            {COLOR_LABEL[lastDice.color]} رمى {lastDice.dice}
            {lastDice.forfeit ? " — ثلاث ستات! فقد الدور" : ""}
          </Text>
        )}

        {/* Ended */}
        {state?.phase === "ended" && (
          <View style={{ alignItems: "center", gap: 14, marginTop: 8 }}>
            <View style={[styles.trophyCircle, { backgroundColor: colors.accent + "22" }]}>
              <Ionicons name="trophy" size={48} color={colors.accent} />
            </View>
            <Text style={[styles.winnerText, { color: colors.primary }]}>
              🏆 الفائز: {state.winner ? COLOR_LABEL[state.winner] : "—"}
            </Text>
            <TouchableOpacity
              style={[styles.bigBtn, { backgroundColor: "#F59E0B" }]}
              onPress={() => router.back()}
              activeOpacity={0.85}
            >
              <Text style={styles.bigBtnText}>العودة للألعاب</Text>
            </TouchableOpacity>
          </View>
        )}
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  gameIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  gameName: { flex: 1, fontSize: 16, fontWeight: "700" as const },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scoreVal: { fontSize: 15, fontWeight: "800" as const },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  errorText: { color: "#EF4444", fontSize: 13, fontWeight: "600" as const, flex: 1, textAlign: "right" },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: "700" as const, flex: 1 },
  die: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, padding: 5 },
  dieGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
  dieCell: { width: "33.33%", height: "33.33%", alignItems: "center", justifyContent: "center" },
  diePip: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#1A1A2E" },
  playerCard: { borderRadius: 16, padding: 14, gap: 10 },
  playerHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  playerName: { fontSize: 14, fontWeight: "700" as const },
  playerMeta: { fontSize: 11, marginTop: 1 },
  turnPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  turnPillText: { fontSize: 11, fontWeight: "800" as const },
  tokensRow: { flexDirection: "row", gap: 8 },
  token: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tokenInner: { alignItems: "center", gap: 2 },
  tokenText: { fontSize: 10, fontWeight: "700" as const },
  movableBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  progressBar: { height: "100%", borderRadius: 3 },
  bigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 26,
    paddingVertical: 15,
  },
  bigBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" as const },
  hint: { fontSize: 12, textAlign: "center" as const, lineHeight: 18 },
  diceLog: { fontSize: 12, textAlign: "center" as const },
  trophyCircle: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  winnerText: { fontSize: 18, fontWeight: "800" as const },
});
