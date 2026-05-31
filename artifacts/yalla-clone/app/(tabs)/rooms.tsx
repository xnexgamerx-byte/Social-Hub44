import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
  ImageBackground,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RoomCard } from "@/components/RoomCard";
import { ROOMS } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { LinearGradient } from "expo-linear-gradient";

const TABS = ["موصى به", "أنا"];

export default function ChatroomScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View style={styles.tabs}>
          {TABS.map((t, i) => (
            <TouchableOpacity key={t} onPress={() => setActiveTab(i)} style={styles.tabBtn} activeOpacity={0.8}>
              <Text style={[styles.tabLabel, { color: i === activeTab ? colors.foreground : colors.mutedForeground, fontWeight: i === activeTab ? "700" : "400" }]}>
                {t}
              </Text>
              {i === activeTab && <View style={[styles.tabUnder, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.secondary }]}>
            <Ionicons name="earth-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.secondary }]}>
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: "#FFF8E1" }]}>
            <Ionicons name="trophy-outline" size={18} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={ROOMS}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{
          paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 90,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.bannerContainer}>
            <View style={styles.banner}>
              <View style={styles.bannerContent}>
                <Text style={styles.bannerTitle}>تمتع بالدردشة</Text>
                <Text style={styles.bannerSub}>في نبضة</Text>
              </View>
              <View style={styles.bannerDots}>
                {[0, 1, 2].map((d) => (
                  <View
                    key={d}
                    style={[styles.dot, d === 0 && styles.dotActive]}
                  />
                ))}
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => <RoomCard room={item} />}
        ItemSeparatorComponent={() => null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  tabs: { flexDirection: "row", gap: 24 },
  tabBtn: { alignItems: "center", paddingBottom: 8 },
  tabLabel: { fontSize: 17 },
  tabUnder: { height: 3, width: "100%", borderRadius: 2, marginTop: 4 },
  headerIcons: { flexDirection: "row", gap: 8, paddingBottom: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  banner: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#7C5CFC",
    height: 100,
    justifyContent: "flex-end",
    padding: 16,
  },
  bannerContent: {},
  bannerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800" as const,
  },
  bannerSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
  },
  bannerDots: {
    flexDirection: "row",
    gap: 5,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: {
    backgroundColor: "#fff",
    width: 18,
  },
});
