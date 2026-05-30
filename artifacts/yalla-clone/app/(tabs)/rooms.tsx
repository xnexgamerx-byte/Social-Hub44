import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
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

const CATEGORIES = [
  { id: "all", label: "الكل" },
  { id: "chat", label: "دردشة" },
  { id: "music", label: "موسيقى" },
  { id: "gaming", label: "ألعاب" },
  { id: "family", label: "عائلة" },
];

export default function RoomsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState("all");

  const filtered = activeCategory === "all"
    ? ROOMS
    : ROOMS.filter((r) => r.category === activeCategory);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>الغرف</Text>
        <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createText}>غرفة جديدة</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.categories, { borderBottomColor: colors.border }]}>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(c) => c.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catList}
          renderItem={({ item }) => {
            const active = item.id === activeCategory;
            return (
              <TouchableOpacity
                style={[
                  styles.catItem,
                  { borderColor: active ? colors.primary : "transparent",
                    backgroundColor: active ? colors.primary + "22" : "transparent" },
                ]}
                onPress={() => setActiveCategory(item.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.catText, { color: active ? colors.primary : colors.mutedForeground }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <RoomCard room={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="mic-off" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              لا توجد غرف في هذه الفئة
            </Text>
          </View>
        }
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
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: "800" as const,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  createText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  categories: {
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  catList: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  catItem: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 1,
  },
  catText: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  empty: {
    alignItems: "center",
    gap: 12,
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
  },
});
