import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListMyRoomsQueryKey,
  getListMyRoomsQueryOptions,
  getListRoomsQueryKey,
  getListRoomsQueryOptions,
  useDeleteRoom,
  type Room,
} from "@workspace/api-client-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RoomCard } from "@/components/RoomCard";
import { useColors } from "@/hooks/useColors";

const TABS = ["موصى به", "أنا"];

export default function ChatroomScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const allRoomsQ = useQuery(getListRoomsQueryOptions());
  const myRoomsQ = useQuery({
    ...getListMyRoomsQueryOptions(),
    enabled: activeTab === 1,
  });
  const deleteM = useDeleteRoom();

  const rooms = activeTab === 0 ? allRoomsQ.data ?? [] : myRoomsQ.data ?? [];
  const loading = activeTab === 0 ? allRoomsQ.isLoading : myRoomsQ.isLoading;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListRoomsQueryKey() });
    qc.invalidateQueries({ queryKey: getListMyRoomsQueryKey() });
  };

  const confirmDelete = (room: Room) => {
    Alert.alert("حذف الغرفة", `هل تريد حذف غرفة «${room.name}»؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteM.mutateAsync({ id: room.id });
            invalidate();
          } catch {
            Alert.alert("خطأ", "تعذّر حذف الغرفة");
          }
        },
      },
    ]);
  };

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
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.push("/room-create")}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: "#FFF8E1" }]}>
            <Ionicons name="trophy-outline" size={18} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{
          paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 90,
          flexGrow: 1,
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
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="home-outline" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {activeTab === 1 ? "ما عندك غرف بعد — أنشئ غرفتك الأولى!" : "لا توجد غرف متاحة حالياً"}
              </Text>
              {activeTab === 1 && (
                <TouchableOpacity
                  style={[styles.createBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push("/room-create")}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.createBtnText}>إنشاء غرفة</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
        renderItem={({ item }) =>
          activeTab === 1 ? (
            <RoomCard
              room={item}
              onEdit={() => router.push(`/room-create?id=${item.id}`)}
              onDelete={() => confirmDelete(item)}
            />
          ) : (
            <RoomCard room={item} />
          )
        }
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
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: { fontSize: 14, textAlign: "center" as const },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  createBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" as const },
});
