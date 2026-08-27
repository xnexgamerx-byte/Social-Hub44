import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getListVisitorsQueryOptions } from "@workspace/api-client-react";
import { QueryError } from "@/components/QueryError";
import { ScreenHeader } from "@/components/ScreenHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { useColors } from "@/hooks/useColors";

function relativeVisit(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `قبل ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `قبل ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "أمس";
  if (days < 30) return `قبل ${days} يوم`;
  return new Date(iso).toLocaleDateString("ar");
}

export default function VisitorsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const visitorsQ = useQuery(getListVisitorsQueryOptions());
  const visitors = visitorsQ.data ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="الزوار" />
      <FlatList
        data={visitors}
        keyExtractor={(v) => v.userId}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 40,
          gap: 10,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          visitors.length > 0 ? (
            <Text style={[styles.note, { color: colors.mutedForeground }]}>
              تكدر تتصفح بدون ما تظهر بقائمة زوار الآخرين من: الضبط ← إعدادات الخصوصية.
            </Text>
          ) : null
        }
        ListEmptyComponent={
          visitorsQ.isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : visitorsQ.isError ? (
            <QueryError
              message="تعذّر تحميل الزوار."
              onRetry={() => void visitorsQ.refetch()}
            />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="eye-outline" size={38} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                ما زار ملفك أحد بعد
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { backgroundColor: colors.card }]}
            onPress={() =>
              router.push({ pathname: "/user/[userId]", params: { userId: item.userId } })
            }
            activeOpacity={0.75}
          >
            <UserAvatar uri={item.avatar} name={item.name || "مستخدم"} size={44} />
            <View style={styles.rowText}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                  {item.name || "مستخدم"}
                </Text>
                {item.isOfficial ? (
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                ) : null}
                {item.country ? <Text style={styles.flag}>{item.country}</Text> : null}
              </View>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                Lv.{item.level} · {relativeVisit(item.visitedAt)}
              </Text>
            </View>
            <Ionicons name="chevron-back" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  note: { fontSize: 12, lineHeight: 18, textAlign: "right" as const, paddingHorizontal: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 70, gap: 12 },
  emptyText: { fontSize: 13.5 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowText: { flex: 1, gap: 3, alignItems: "flex-end" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { fontSize: 14.5, fontWeight: "700" as const, maxWidth: 180 },
  flag: { fontSize: 13 },
  meta: { fontSize: 12 },
});
