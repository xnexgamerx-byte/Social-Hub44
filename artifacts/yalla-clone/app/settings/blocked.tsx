import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getListBlocksQueryKey,
  getListBlocksQueryOptions,
  useUnblockUser,
} from "@workspace/api-client-react";
import { QueryError } from "@/components/QueryError";
import { ScreenHeader } from "@/components/ScreenHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { useColors } from "@/hooks/useColors";
import { apiErrorMessage } from "@/lib/apiError";

export default function BlockedAccountsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const blocksQ = useQuery(getListBlocksQueryOptions());
  const unblockM = useUnblockUser();

  const unblock = (userId: string, name: string) => {
    Alert.alert("رفع الحظر", `هل تريد رفع الحظر عن ${name}؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "رفع الحظر",
        onPress: async () => {
          try {
            await unblockM.mutateAsync({ targetUserId: userId });
            qc.invalidateQueries({ queryKey: getListBlocksQueryKey() });
          } catch (err) {
            Alert.alert("خطأ", apiErrorMessage(err, `تعذّر رفع الحظر عن ${name}`));
          }
        },
      },
    ]);
  };

  const blocks = blocksQ.data ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="القائمة السوداء" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {blocksQ.isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : blocksQ.isError ? (
          <QueryError
            message="تعذّر تحميل قائمة المحظورين."
            onRetry={() => void blocksQ.refetch()}
          />
        ) : blocks.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="shield-outline" size={38} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              لم تحظر أي حساب
            </Text>
          </View>
        ) : (
          blocks.map((b) => (
            <View
              key={b.userId}
              style={[styles.row, { backgroundColor: colors.card }]}
            >
              <UserAvatar uri={b.avatar} name={b.name || "مستخدم"} size={38} />
              <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                {b.name || "مستخدم"}
              </Text>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.secondary }]}
                onPress={() => unblock(b.userId, b.name || "هذا الحساب")}
              >
                <Text style={[styles.btnText, { color: colors.primary }]}>رفع الحظر</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 40 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 13.5 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  name: { flex: 1, fontSize: 14, fontWeight: "600" as const, textAlign: "right" as const },
  btn: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  btnText: { fontSize: 12, fontWeight: "700" as const },
});
