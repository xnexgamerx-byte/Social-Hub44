import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GAMES, TRIVIA_QUESTIONS } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

type GameState = "ready" | "playing" | "answered" | "finished";

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const game = GAMES.find((g) => g.id === id) ?? GAMES[0];
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [gameState, setGameState] = useState<GameState>("ready");
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;

  const question = TRIVIA_QUESTIONS[qIndex % TRIVIA_QUESTIONS.length];
  const isLastQuestion = qIndex >= TRIVIA_QUESTIONS.length - 1;

  const startTimer = () => {
    setTimeLeft(15);
    progressAnim.setValue(1);
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 15000,
      useNativeDriver: false,
    }).start();
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setGameState("answered");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const startGame = () => {
    setGameState("playing");
    setQIndex(0);
    setScore(0);
    setSelected(null);
    startTimer();
  };

  const handleAnswer = (idx: number) => {
    if (gameState !== "playing") return;
    clearInterval(timerRef.current!);
    Haptics.impactAsync(
      idx === question.answer
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Heavy
    );
    setSelected(idx);
    setGameState("answered");
    if (idx === question.answer) {
      setScore((s) => s + Math.ceil((timeLeft / 15) * 100));
    }
  };

  const nextQuestion = () => {
    if (isLastQuestion) {
      setGameState("finished");
      return;
    }
    setQIndex((i) => i + 1);
    setSelected(null);
    setGameState("playing");
    startTimer();
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const getChoiceStyle = (idx: number) => {
    if (gameState !== "answered") return [styles.choice, { backgroundColor: colors.card, borderColor: colors.border }];
    if (idx === question.answer) return [styles.choice, { backgroundColor: "#22C55E22", borderColor: "#22C55E" }];
    if (idx === selected && idx !== question.answer) return [styles.choice, { backgroundColor: "#EF444422", borderColor: "#EF4444" }];
    return [styles.choice, { backgroundColor: colors.card, borderColor: colors.border }];
  };

  const getChoiceTextColor = (idx: number) => {
    if (gameState !== "answered") return colors.foreground;
    if (idx === question.answer) return "#22C55E";
    if (idx === selected && idx !== question.answer) return "#EF4444";
    return colors.mutedForeground;
  };

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
          <Ionicons name="star" size={14} color={colors.accent} />
          <Text style={[styles.scoreVal, { color: colors.primary }]}>{score}</Text>
        </View>
      </View>

      {gameState === "ready" && (
        <View style={styles.center}>
          <View style={[styles.readyIcon, { backgroundColor: game.color + "22" }]}>
            <Ionicons name={game.icon as any} size={64} color={game.color} />
          </View>
          <Text style={[styles.readyTitle, { color: colors.foreground }]}>{game.name}</Text>
          <Text style={[styles.readyDesc, { color: colors.mutedForeground }]}>
            {TRIVIA_QUESTIONS.length} سؤال — 15 ثانية لكل سؤال
          </Text>
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: game.color }]}
            onPress={startGame}
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnText}>ابدأ اللعبة</Text>
          </TouchableOpacity>
        </View>
      )}

      {(gameState === "playing" || gameState === "answered") && (
        <View style={styles.gameArea}>
          <View style={styles.progressRow}>
            <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
              {qIndex + 1} / {TRIVIA_QUESTIONS.length}
            </Text>
            <View style={[styles.timerChip, { backgroundColor: timeLeft <= 5 ? "#EF444422" : colors.muted, borderColor: timeLeft <= 5 ? "#EF4444" : colors.border }]}>
              <Ionicons name="time" size={13} color={timeLeft <= 5 ? "#EF4444" : colors.mutedForeground} />
              <Text style={[styles.timerText, { color: timeLeft <= 5 ? "#EF4444" : colors.mutedForeground }]}>
                {timeLeft}
              </Text>
            </View>
          </View>

          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: timeLeft <= 5 ? "#EF4444" : colors.primary,
                  width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
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
                disabled={gameState === "answered"}
                activeOpacity={0.8}
              >
                <View style={[styles.choiceNum, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.choiceNumText, { color: colors.mutedForeground }]}>
                    {String.fromCharCode(0x0041 + idx)}
                  </Text>
                </View>
                <Text style={[styles.choiceText, { color: getChoiceTextColor(idx) }]}>{choice}</Text>
                {gameState === "answered" && idx === question.answer && (
                  <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                )}
                {gameState === "answered" && idx === selected && idx !== question.answer && (
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {gameState === "answered" && (
            <View style={styles.feedback}>
              <Text style={[styles.feedbackText, { color: selected === question.answer ? "#22C55E" : "#EF4444" }]}>
                {selected === question.answer ? "أحسنت! إجابة صحيحة" : "إجابة خاطئة"}
              </Text>
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: colors.primary }]}
                onPress={nextQuestion}
                activeOpacity={0.85}
              >
                <Text style={styles.nextBtnText}>{isLastQuestion ? "النتيجة النهائية" : "السؤال التالي"}</Text>
                <Ionicons name="arrow-back" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {gameState === "finished" && (
        <View style={styles.center}>
          <View style={[styles.trophyCircle, { backgroundColor: colors.accent + "22" }]}>
            <Ionicons name="trophy" size={64} color={colors.accent} />
          </View>
          <Text style={[styles.finishedTitle, { color: colors.foreground }]}>انتهت اللعبة!</Text>
          <View style={[styles.finalScoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.finalScoreLabel, { color: colors.mutedForeground }]}>نتيجتك</Text>
            <Text style={[styles.finalScoreVal, { color: colors.primary }]}>{score}</Text>
            <Text style={[styles.finalScoreMax, { color: colors.mutedForeground }]}>
              من {TRIVIA_QUESTIONS.length * 100} نقطة
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: game.color }]}
            onPress={startGame}
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnText}>العب مجدداً</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={[styles.backLinkText, { color: colors.mutedForeground }]}>العودة للألعاب</Text>
          </TouchableOpacity>
        </View>
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 20,
  },
  readyIcon: {
    width: 120,
    height: 120,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  readyTitle: { fontSize: 26, fontWeight: "800" as const, textAlign: "center" as const },
  readyDesc: { fontSize: 14, textAlign: "center" as const, lineHeight: 22 },
  startBtn: {
    borderRadius: 28,
    paddingHorizontal: 48,
    paddingVertical: 16,
    marginTop: 8,
  },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" as const },
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
  feedback: { gap: 12, alignItems: "center" },
  feedbackText: { fontSize: 16, fontWeight: "700" as const },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  nextBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" as const },
  trophyCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: "center",
    justifyContent: "center",
  },
  finishedTitle: { fontSize: 28, fontWeight: "800" as const },
  finalScoreCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    width: "100%",
    gap: 6,
  },
  finalScoreLabel: { fontSize: 14 },
  finalScoreVal: { fontSize: 52, fontWeight: "900" as const },
  finalScoreMax: { fontSize: 13 },
  backLink: { marginTop: 4 },
  backLinkText: { fontSize: 14 },
});
