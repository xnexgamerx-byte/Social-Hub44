import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListBlocksQueryKey,
  getListBlocksQueryOptions,
  useDeleteMyAccount,
  useUnblockUser,
} from "@workspace/api-client-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserAvatar } from "@/components/UserAvatar";
import { useColors } from "@/hooks/useColors";

/** Typed to confirm deletion — a destructive, irreversible action. */
const DELETE_PHRASE = "حذف";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const blocksQ = useQuery(getListBlocksQueryOptions());
  const unblockM = useUnblockUser();
  const deleteM = useDeleteMyAccount();

  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const unblock = async (userId: string, name: string) => {
    try {
      await unblockM.mutateAsync({ targetUserId: userId });
      qc.invalidateQueries({ queryKey: getListBlocksQueryKey() });
    } catch {
      Alert.alert("خطأ", `تعذّر رفع الحظر عن ${name}`);
    }
  };

  const deleteAccount = () => {
    Alert.alert(
      "حذف الحساب نهائياً",
      "سيُحذف ملفك ومنشوراتك ورسائلك وغرفك. لا يمكن التراجع عن هذا الإجراء.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف نهائياً",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteM.mutateAsync();
              // The identity is gone server-side; clear the local session too.
              await signOut();
            } catch {
              setDeleting(false);
              Alert.alert("خطأ", "تعذّر حذف الحساب، حاول مرة أخرى");
            }
          },
        },
      ],
    );
  };

  const blocks = blocksQ.data ?? [];
  const canDelete = confirmText.trim() === DELETE_PHRASE && !deleting;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>الإعدادات والخصوصية</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40, gap: 22 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Blocked accounts */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            الحسابات المحظورة
          </Text>
          {blocksQ.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : blocks.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              لم تحظر أي حساب
            </Text>
          ) : (
            blocks.map((b) => (
              <View
                key={b.userId}
                style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <UserAvatar uri={b.avatar} name={b.name || "مستخدم"} size={38} />
                <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
                  {b.name || "مستخدم"}
                </Text>
                <TouchableOpacity
                  style={[styles.unblockBtn, { backgroundColor: colors.secondary }]}
                  onPress={() => unblock(b.userId, b.name)}
                >
                  <Text style={[styles.unblockText, { color: colors.primary }]}>رفع الحظر</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>القانوني</Text>
          <TouchableOpacity
            style={[styles.linkRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "privacy" } })}
          >
            <Ionicons name="shield-checkmark-outline" size={19} color={colors.primary} />
            <Text style={[styles.linkText, { color: colors.foreground }]}>سياسة الخصوصية</Text>
            <Ionicons name="chevron-back" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.linkRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "terms" } })}
          >
            <Ionicons name="document-text-outline" size={19} color={colors.primary} />
            <Text style={[styles.linkText, { color: colors.foreground }]}>شروط الاستخدام</Text>
            <Ionicons name="chevron-back" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Danger zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: "#EF4444" }]}>حذف الحساب</Text>
          <View style={[styles.danger, { borderColor: "#EF444455", backgroundColor: "#EF44440D" }]}>
            <Text style={[styles.dangerText, { color: colors.foreground }]}>
              سيُحذف ملفك الشخصي ومنشوراتك ورسائلك وغرفك نهائياً، ولا يمكن استرجاعها.
            </Text>
            <Text style={[styles.dangerHint, { color: colors.mutedForeground }]}>
              اكتب «{DELETE_PHRASE}» للتأكيد
            </Text>
            <TextInput
              style={[
                styles.confirmInput,
                {
                  backgroundColor: colors.background,
                  borderColor: canDelete ? "#EF4444" : colors.border,
                  color: colors.foreground,
                },
              ]}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder={DELETE_PHRASE}
              placeholderTextColor={colors.mutedForeground}
              textAlign="center"
            />
            <TouchableOpacity
              style={[styles.deleteBtn, { backgroundColor: canDelete ? "#EF4444" : colors.muted }]}
              onPress={deleteAccount}
              disabled={!canDelete}
            >
              {deleting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.deleteText,
                    { color: canDelete ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  حذف حسابي نهائياً
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 16, fontWeight: "700" as const, textAlign: "center" as const },
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "800" as const },
  empty: { fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowName: { flex: 1, fontSize: 14, fontWeight: "600" as const },
  unblockBtn: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  unblockText: { fontSize: 12, fontWeight: "700" as const },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  linkText: { flex: 1, fontSize: 14, fontWeight: "600" as const },
  danger: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  dangerText: { fontSize: 13, lineHeight: 20 },
  dangerHint: { fontSize: 12, marginTop: 2 },
  confirmInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "700" as const,
  },
  deleteBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  deleteText: { fontSize: 15, fontWeight: "800" as const },
});
