import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import {
  getListDailyTasksQueryOptions,
  getListTaskClaimsQueryOptions,
  type DailyTask,
} from "@workspace/api-client-react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";

const BG = "#13101F";
const CARD = "#1E1830";
const PURPLE = "#7C3AED";
const GOLD = "#F5C242";
const TEXT = "#FFFFFF";
const MUTED = "#9A91B5";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { user, claimTask } = useApp();
  const tasksQ = useQuery(getListDailyTasksQueryOptions());
  const claimsQ = useQuery(getListTaskClaimsQueryOptions(user.id));

  const tasks = useMemo(
    () =>
      (tasksQ.data ?? [])
        .filter((t) => t.active)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [tasksQ.data],
  );

  const claimedToday = useMemo(() => {
    const today = todayKey();
    return new Set(
      (claimsQ.data ?? [])
        .filter((c) => c.claimedOn === today)
        .map((c) => c.taskId),
    );
  }, [claimsQ.data]);

  const [busyId, setBusyId] = useState<number | null>(null);
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  const totalReward = tasks.reduce((sum, t) => sum + t.reward, 0);
  const claimedReward = tasks
    .filter((t) => claimedToday.has(t.id))
    .reduce((sum, t) => sum + t.reward, 0);
  const progress = totalReward > 0 ? claimedReward / totalReward : 0;

  const handleClaim = async (task: DailyTask) => {
    if (busyId !== null || claimedToday.has(task.id)) return;
    setBusyId(task.id);
    const res = await claimTask(task.id);
    setBusyId(null);
    if (res.ok) {
      claimsQ.refetch();
      Alert.alert("أحسنت!", `حصلت على ${task.reward.toLocaleString()} كوينز`);
    } else {
      Alert.alert("خطأ", res.error ?? "تعذّر استلام المكافأة");
    }
  };

  const isLoading = tasksQ.isLoading || claimsQ.isLoading;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-forward" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.title}>المهام اليومية</Text>
        <View style={styles.iconBtn} />
      </View>

      <LinearGradient
        colors={["#7C3AED", "#A855F7"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroTitle}>أكمل المهام واربح الكوينزات</Text>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.heroSub}>
          {claimedReward.toLocaleString()} / {totalReward.toLocaleString()} كوينز اليوم
        </Text>
      </LinearGradient>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PURPLE} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 100 }}
          showsVerticalScrollIndicator={false}
        >
          {tasks.map((task) => {
            const done = claimedToday.has(task.id);
            return (
              <View key={task.id} style={styles.taskCard}>
                <View style={[styles.taskIcon, { backgroundColor: task.color + "22" }]}>
                  <Ionicons name={(task.icon as never) || "checkmark"} size={22} color={task.color} />
                </View>
                <View style={styles.taskBody}>
                  <Text style={styles.taskLabel}>{task.label}</Text>
                  <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text>
                  <View style={styles.rewardRow}>
                    <Ionicons name="logo-bitcoin" size={12} color={GOLD} />
                    <Text style={styles.rewardText}>{task.reward.toLocaleString()}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.claimBtn, done && styles.claimBtnDone]}
                  disabled={done || busyId === task.id}
                  onPress={() => handleClaim(task)}
                >
                  {busyId === task.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : done ? (
                    <Ionicons name="checkmark" size={18} color={MUTED} />
                  ) : (
                    <Text style={styles.claimText}>استلام</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
          {tasks.length === 0 && (
            <Text style={styles.empty}>لا توجد مهام متاحة حالياً</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: TEXT, fontSize: 20, fontWeight: "800" },
  hero: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  heroTitle: { color: "#fff", fontSize: 16, fontWeight: "800", textAlign: "right", marginBottom: 12 },
  progressBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: { height: "100%", backgroundColor: GOLD, borderRadius: 4 },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: 12, textAlign: "right", fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  taskIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  taskBody: { flex: 1, alignItems: "flex-end" },
  taskLabel: { color: TEXT, fontSize: 14, fontWeight: "700", textAlign: "right" },
  taskDesc: { color: MUTED, fontSize: 11, marginTop: 2, textAlign: "right" },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  rewardText: { color: GOLD, fontSize: 13, fontWeight: "800" },
  claimBtn: {
    backgroundColor: PURPLE,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  claimBtnDone: { backgroundColor: "#2E2640" },
  claimText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  empty: { color: MUTED, fontSize: 14, textAlign: "center", marginTop: 40 },
});
