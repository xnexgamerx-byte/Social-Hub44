import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { UserAvatar } from "@/components/UserAvatar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  last: string;
  time: string;
  unread: number;
  online: boolean;
}

const CONVERSATIONS: Conversation[] = [
  { id: "1", name: "سارة محمد", avatar: "https://i.pravatar.cc/150?img=5", last: "مرحباً، كيف حالك اليوم؟", time: "الآن", unread: 2, online: true },
  { id: "2", name: "خالد العتيبي", avatar: "https://i.pravatar.cc/150?img=12", last: "شكراً على الهدية! 🎁", time: "5 د", unread: 0, online: true },
  { id: "3", name: "نورة أحمد", avatar: "https://i.pravatar.cc/150?img=9", last: "هل ستنضم للغرفة الليلة؟", time: "20 د", unread: 1, online: false },
  { id: "4", name: "فيصل الدوسري", avatar: "https://i.pravatar.cc/150?img=15", last: "تمام، نشوفك بكرة", time: "1 س", unread: 0, online: false },
  { id: "5", name: "ريم سالم", avatar: "https://i.pravatar.cc/150?img=20", last: "أرسلت لك دعوة للعائلة", time: "3 س", unread: 0, online: true },
  { id: "6", name: "عبدالله ناصر", avatar: "https://i.pravatar.cc/150?img=33", last: "كانت لعبة ممتعة 🎮", time: "أمس", unread: 0, online: false },
];

const QUICK = [
  { icon: "people" as const, label: "العائلة", color: "#7C5CFC" },
  { icon: "heart" as const, label: "المعجبون", color: "#FF6B9D" },
  { icon: "eye" as const, label: "الزوار", color: "#06B6D4" },
  { icon: "notifications" as const, label: "الإشعارات", color: "#F59E0B" },
];

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>الرسائل</Text>
        <TouchableOpacity>
          <Ionicons name="create-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.quickRow}>
        {QUICK.map((q) => (
          <TouchableOpacity key={q.label} style={styles.quickItem} activeOpacity={0.7}>
            <View style={[styles.quickIcon, { backgroundColor: q.color + "1A" }]}>
              <Ionicons name={q.icon} size={22} color={q.color} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.mutedForeground }]}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={CONVERSATIONS}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{
          paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 90,
        }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.convRow} activeOpacity={0.7}>
            <View style={styles.avatarWrap}>
              <UserAvatar uri={item.avatar} name={item.name} size={54} online={item.online} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.convTop}>
                <Text style={[styles.convName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.convTime, { color: colors.mutedForeground }]}>{item.time}</Text>
              </View>
              <View style={styles.convTop}>
                <Text
                  style={[styles.convLast, { color: colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {item.last}
                </Text>
                {item.unread > 0 && (
                  <View style={[styles.unread, { backgroundColor: colors.accent }]}>
                    <Text style={styles.unreadText}>{item.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  title: { fontSize: 22, fontWeight: "800" as const },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  quickItem: { alignItems: "center", gap: 6 },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 12, fontWeight: "500" as const },
  convRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#fff",
  },
  convTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  convName: { fontSize: 15, fontWeight: "700" as const },
  convTime: { fontSize: 11 },
  convLast: { fontSize: 13, flex: 1 },
  unread: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "800" as const },
});
