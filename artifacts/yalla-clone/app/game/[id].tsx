import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GAMES } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useGameSession, type GamePlayer } from "@/hooks/useGameSession";
import { UserAvatar } from "@/components/UserAvatar";

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const game = GAMES.find((g) => g.id === id) ?? GAMES[0];
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const me = useMemo(
    () => ({ userId: user.id, userName: user.name, userAvatar: user.avatar }),
    [user.id, user.name, user.avatar],
  );

  const { phase, players, question, revealAnswer, gained, answeredCount, connected, start, answer } =
    useGameSession(id, me);

  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const lastIndexRef = useRef(-1);

  // Reset local selection whenever a new question arrives.
  useEffect(() => {
    if (question && question.index !== lastIndexRef.current) {
      lastIndexRef.current = question.index;
      setSelected(null);
    }
  }, [question]);

  // Server-driven countdown derived from the shared endsAt timestamp.
  useEffect(() => {
    if (phase !== "question" || !question) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((question.endsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [phase, question]);

  const myScore = useMemo(
    () => players.find((p) => p.userId === user.id)?.score ?? 0,
    [players, user.id],
  );

  const handleAnswer = useCallback(
    (idx: number) => {
      if (phase !== "question" || selected !== null) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelected(idx);
      answer(idx);
    },
    [phase, selected, answer],
  );

  const getChoiceStyle = (idx: number) => {
    if (phase !== "reveal" || revealAnswer === null) {
      const picked = selected === idx;
      return [
        styles.choice,
        {
          backgroundColor: picked ? colors.primary + "22" : colors.card,
          borderColor: picked ? colors.primary : colors.border,
        },
      ];
    }
    if (idx === revealAnswer) return [styles.choice, { backgroundColor: "#22C55E22", borderColor: "#22C55E" }];
    if (idx === selected && idx !== revealAnswer) return [styles.choice, { backgroundColor: "#EF444422", borderColor: "#EF4444" }];
    return [styles.choice, { backgroundColor: colors.card, borderColor: colors.border }];
  };

  const getChoiceTextColor = (idx: number) => {
    if (phase !== "reveal" || revealAnswer === null) return colors.foreground;
    if (idx === revealAnswer) return "#22C55E";
    if (idx === selected && idx !== revealAnswer) return "#EF4444";
    return colors.mutedForeground;
  };

  const renderLeaderboard = (list: GamePlayer[], compact = false) => (
    <View style={styles.board}>
      {list.map((p, i) => (
        <View
          key={p.userId}
          style={[
            styles.boardRow,
            { backgroundColor: p.userId === user.id ? colors.primary + "18" : colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.boardRank, { color: i === 0 ? colors.accent : colors.mutedForeground }]}>
            {i + 1}
          </Text>
          <UserAvatar uri={p.userAvatar} size={compact ? 28 : 36} />
          <Text style={[styles.boardName, { color: colors.foreground }]} numberOfLines={1}>
            {p.userName}
            {p.userId === user.id ? " (أنت)" : ""}
          </Text>
          <Text style={[styles.boardScore, { color: colors.primary }]}>{p.score}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.gameIcon, { backgroundColor: game.color + "33" }]}>
          <Ionicons name={game.icon as any} size={22} color={game.color} />
        </View>
        <Text style={[styles.gameName, { color: colors.foreground }]}>{game.name}</Text>
        <View style={[styles.scoreBadge, { backgroundColor: colors.primary + "22" }]}>
          <Ionicons name="people" size={14} color={colors.primary} />
          <Text style={[styles.scoreVal, { color: colors.primary }]}>{players.length}</Text>
        </View>
      </View>

      {phase === "lobby" && (
        <ScrollView contentContainerStyle={styles.lobby}>
          <View style={[styles.readyIcon, { backgroundColor: game.color + "22" }]}>
            <Ionicons name={game.icon as any} size={56} color={game.color} />
          </View>
          <Text style={[styles.readyTitle, { color: colors.foreground }]}>{game.name}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.onlineDot, { backgroundColor: connected ? "#22C55E" : colors.mutedForeground }]} />
            <Text style={[styles.readyDesc, { color: colors.mutedForeground }]}>
              {connected ? `${players.length} لاعب في الغرفة` : "جارٍ الاتصال..."}
            </Text>
          </View>

          {renderLeaderboard(players)}

          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: game.color, opacity: connected ? 1 : 0.5 }]}
            onPress={start}
            disabled={!connected}
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnText}>ابدأ اللعبة</Text>
          </TouchableOpacity>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            ادعُ أصدقاءك لنفس اللعبة وتنافسوا في الوقت الفعلي
          </Text>
        </ScrollView>
      )}

      {(phase === "question" || phase === "reveal") && question && (
        <View style={styles.gameArea}>
          <View style={styles.progressRow}>
            <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
              {question.index + 1} / {question.total}
            </Text>
            <View style={styles.metaRight}>
              <View style={[styles.scoreBadge, { backgroundColor: colors.primary + "22" }]}>
                <Ionicons name="star" size={13} color={colors.accent} />
                <Text style={[styles.scoreVal, { color: colors.primary }]}>{myScore}</Text>
              </View>
              {phase === "question" && (
                <View style={[styles.timerChip, { backgroundColor: timeLeft <= 5 ? "#EF444422" : colors.muted, borderColor: timeLeft <= 5 ? "#EF4444" : colors.border }]}>
                  <Ionicons name="time" size={13} color={timeLeft <= 5 ? "#EF4444" : colors.mutedForeground} />
                  <Text style={[styles.timerText, { color: timeLeft <= 5 ? "#EF4444" : colors.mutedForeground }]}>
                    {timeLeft}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: timeLeft <= 5 ? "#EF4444" : colors.primary,
                  width: `${Math.min(100, (timeLeft / (question.durationMs / 1000)) * 100)}%`,
                },
              ]}
            />
          </View>

          <View style={[styles.questionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.questionText, { color: colors.foreground }]}>{question.question}</Text>
          </View>

          <View style={styles.choices}>
            {question.choices.map((choice, idx) => (
              <TouchableOpacity
                key={idx}
                style={getChoiceStyle(idx)}
                onPress={() => handleAnswer(idx)}
                disabled={phase === "reveal" || selected !== null}
                activeOpacity={0.8}
              >
                <View style={[styles.choiceNum, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.choiceNumText, { color: colors.mutedForeground }]}>
                    {String.fromCharCode(0x0041 + idx)}
                  </Text>
                </View>
                <Text style={[styles.choiceText, { color: getChoiceTextColor(idx) }]}>{choice}</Text>
                {phase === "reveal" && idx === revealAnswer && (
                  <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                )}
                {phase === "reveal" && idx === selected && idx !== revealAnswer && (
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {phase === "question" && (
            <Text style={[styles.answeredText, { color: colors.mutedForeground }]}>
              {selected !== null ? "تم إرسال إجابتك ✓ — بانتظار البقية" : "اختر إجابتك بسرعة!"}
              {`  •  ${answeredCount}/${players.length} أجابوا`}
            </Text>
          )}

          {phase === "reveal" && (
            <View style={styles.revealBox}>
              <Text style={[styles.feedbackText, { color: selected === revealAnswer ? "#22C55E" : "#EF4444" }]}>
                {selected === null
                  ? "انتهى الوقت!"
                  : selected === revealAnswer
                    ? `أحسنت! +${gained[user.id] ?? 0} نقطة`
                    : "إجابة خاطئة"}
              </Text>
              {renderLeaderboard(players, true)}
            </View>
          )}
        </View>
      )}

      {phase === "ended" && (
        <ScrollView contentContainerStyle={styles.lobby}>
          <View style={[styles.trophyCircle, { backgroundColor: colors.accent + "22" }]}>
            <Ionicons name="trophy" size={56} color={colors.accent} />
          </View>
          <Text style={[styles.finishedTitle, { color: colors.foreground }]}>انتهت اللعبة!</Text>
          {players[0] && (
            <Text style={[styles.winnerText, { color: colors.primary }]}>
              🏆 الفائز: {players[0].userName}
            </Text>
          )}
          {renderLeaderboard(players)}
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: game.color }]}
            onPress={start}
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnText}>العب مجدداً</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={[styles.backLinkText, { color: colors.mutedForeground }]}>العودة للألعاب</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
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
  gameIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
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
  metaRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  lobby: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 16,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  readyIcon: {
    width: 110,
    height: 110,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  readyTitle: { fontSize: 24, fontWeight: "800" as const, textAlign: "center" as const },
  readyDesc: { fontSize: 14, textAlign: "center" as const },
  hint: { fontSize: 12, textAlign: "center" as const, lineHeight: 18 },
  startBtn: {
    borderRadius: 28,
    paddingHorizontal: 48,
    paddingVertical: 16,
    marginTop: 4,
  },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" as const },
  board: { width: "100%", gap: 8 },
  boardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  boardRank: { fontSize: 15, fontWeight: "800" as const, width: 20, textAlign: "center" as const },
  boardName: { flex: 1, fontSize: 14, fontWeight: "600" as const },
  boardScore: { fontSize: 16, fontWeight: "800" as const },
  gameArea: { flex: 1, paddingHorizontal: 16, paddingTop: 20, gap: 16 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressText: { fontSize: 13, fontWeight: "600" as const },
  timerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timerText: { fontSize: 13, fontWeight: "700" as const },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2A2A4A",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  questionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  questionText: {
    fontSize: 18,
    fontWeight: "700" as const,
    textAlign: "center" as const,
    lineHeight: 28,
  },
  choices: { gap: 10 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  choiceNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceNumText: { fontSize: 13, fontWeight: "700" as const },
  choiceText: { flex: 1, fontSize: 15, fontWeight: "500" as const },
  answeredText: { fontSize: 13, textAlign: "center" as const },
  revealBox: { gap: 14, alignItems: "center" },
  feedbackText: { fontSize: 16, fontWeight: "700" as const },
  trophyCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
  },
  finishedTitle: { fontSize: 26, fontWeight: "800" as const },
  winnerText: { fontSize: 16, fontWeight: "700" as const },
  backLink: { marginTop: 4 },
  backLinkText: { fontSize: 14 },
});
