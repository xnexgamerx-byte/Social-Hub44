import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameCard } from "@/components/GameCard";
import { GAMES } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

export default function GamesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  const pairs: (typeof GAMES)[] = [];
  for (let i = 0; i < GAMES.length; i += 2) {
    pairs.push(GAMES.slice(i, i + 2));
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>الألعاب</Text>
        <View style={[styles.onlineBadge, { backgroundColor: colors.secondary }]}>
          <View style={styles.onlineDot} />
          <Text style={[styles.onlineText, { color: colors.mutedForeground }]}>
            {GAMES.reduce((s, g) => s + g.players, 0).toLocaleString()} لاعب الآن
          </Text>
        </View>
      </View>

      <View style={[styles.featuredBanner, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "33" }]}>
        <Ionicons name="trophy" size={28} color="#F59E0B" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.featuredTitle, { color: colors.foreground }]}>بطولة اليوم</Text>
          <Text style={[styles.featuredSub, { color: colors.mutedForeground }]}>
            انضم للتحدي واكسب مكافآت يومية
          </Text>
        </View>
        <View style={[styles.featuredPill, { backgroundColor: "#F59E0B" }]}>
          <Text style={styles.featuredPillText}>جديد</Text>
        </View>
      </View>

      <FlatList
        data={pairs}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: pair }) => (
          <View style={styles.row}>
            {pair.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
            {pair.length === 1 && <View style={{ flex: 1 }} />}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800" as const, flex: 1 },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#22C55E" },
  onlineText: { fontSize: 12, fontWeight: "500" as const },
  featuredBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  featuredTitle: { fontSize: 15, fontWeight: "700" as const },
  featuredSub: { fontSize: 12, marginTop: 2 },
  featuredPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  featuredPillText: { color: "#000", fontSize: 12, fontWeight: "700" as const },
  list: { paddingHorizontal: 16 },
  row: { flexDirection: "row", gap: 12, marginBottom: 12 },
});
