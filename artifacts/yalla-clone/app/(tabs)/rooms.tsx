import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListMyRoomsQueryKey,
  getListMyRoomsQueryOptions,
  getListRoomEventsQueryOptions,
  getListRoomsQueryKey,
  getListRoomsQueryOptions,
  useDeleteRoom,
  type Room,
} from "@workspace/api-client-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RoomCard } from "@/components/RoomCard";
import { useColors } from "@/hooks/useColors";

const TABS = ["موصى به", "أنا"];

/** "اليوم ٩:٠٠" for today, otherwise a short weekday + time. */
function formatEventTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) return `اليوم ${time}`;
  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return `${days[d.getDay()]} ${time}`;
}

export default function ChatroomScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const allRoomsQ = useQuery(getListRoomsQueryOptions());
  const eventsQ = useQuery(getListRoomEventsQueryOptions());
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
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: "#FFF8E1" }]}
            onPress={() => router.push("/games")}
          >
            <Ionicons name="game-controller-outline" size={18} color="#F59E0B" />
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
          <View>
            <View style={styles.bannerContainer}>
              <TouchableOpacity
                style={styles.banner}
                onPress={() => router.push("/invite")}
                activeOpacity={0.9}
              >
                <View style={styles.bannerContent}>
                  <Text style={styles.bannerTitle}>ادعُ أصدقاءك</Text>
                  <Text style={styles.bannerSub}>واربحوا كوينزات سوا 🎁</Text>
                </View>
                <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            </View>

            {/* Upcoming scheduled sessions — a fixed time gives people a
                reason to arrive together. */}
            {(eventsQ.data?.length ?? 0) > 0 && (
              <View style={styles.eventsWrap}>
                <Text style={[styles.eventsTitle, { color: colors.foreground }]}>
                  مواعيد قادمة
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.eventsRow}
                >
                  {(eventsQ.data ?? []).map((ev) => (
                    <TouchableOpacity
                      key={ev.id}
                      style={[
                        styles.eventCard,
                        { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                      onPress={() => router.push(`/room/${ev.roomId}`)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.eventTime, { backgroundColor: colors.primary + "1A" }]}>
                        <Ionicons name="time" size={12} color={colors.primary} />
                        <Text style={[styles.eventTimeText, { color: colors.primary }]}>
                          {formatEventTime(ev.startsAt)}
                        </Text>
                      </View>
                      <Text
                        style={[styles.eventName, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {ev.title}
                      </Text>
                      <Text
                        style={[styles.eventRoom, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {ev.roomName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
  },
  bannerContent: { gap: 3 },
  bannerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800" as const,
  },
  bannerSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
  },
  eventsWrap: { paddingBottom: 10, gap: 8 },
  eventsTitle: { fontSize: 14, fontWeight: "800" as const, paddingHorizontal: 16 },
  eventsRow: { paddingHorizontal: 16, gap: 10 },
  eventCard: {
    width: 168,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  eventTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  eventTimeText: { fontSize: 11, fontWeight: "800" as const },
  eventName: { fontSize: 14, fontWeight: "700" as const },
  eventRoom: { fontSize: 12 },
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
