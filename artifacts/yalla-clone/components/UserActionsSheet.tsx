import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListBlocksQueryKey,
  getListProfilesQueryKey,
  useBlockUser,
  useCreateReport,
  type ReportInputReason,
  type ReportInputTargetType,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

/** Reasons mirror the server's allowed list. */
const REASONS: { key: ReportInputReason; label: string }[] = [
  { key: "harassment", label: "تحرش أو إساءة" },
  { key: "sexual", label: "محتوى جنسي" },
  { key: "scam", label: "نصب أو احتيال" },
  { key: "spam", label: "إزعاج ورسائل مكررة" },
  { key: "hate", label: "كراهية أو عنصرية" },
  { key: "underage", label: "المستخدم قاصر" },
  { key: "other", label: "سبب آخر" },
];

interface UserActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Who or what is being acted on. */
  targetUserId: string;
  targetName: string;
  targetType?: ReportInputTargetType;
  /** Defaults to the user id; pass a post/message/room id for those types. */
  targetId?: string;
  /** Called after a successful block so the screen can navigate away. */
  onBlocked?: () => void;
}

/**
 * The single place a user reports or blocks someone. Every surface that shows
 * another person's content opens this, so the actions are always one tap away
 * — which is what the store policies actually require.
 */
export function UserActionsSheet({
  visible,
  onClose,
  targetUserId,
  targetName,
  targetType = "user",
  targetId,
  onBlocked,
}: UserActionsSheetProps) {
  const colors = useColors();
  const qc = useQueryClient();
  const blockM = useBlockUser();
  const reportM = useCreateReport();

  const [mode, setMode] = useState<"menu" | "report">("menu");
  const [reason, setReason] = useState<ReportInputReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setMode("menu");
    setReason(null);
    setNote("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const confirmBlock = () => {
    Alert.alert(
      "حظر المستخدم",
      `لن يتمكن ${targetName || "هذا المستخدم"} من مراسلتك، ولن تظهرا لبعضكما.`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حظر",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await blockM.mutateAsync({ data: { targetUserId } });
              qc.invalidateQueries({ queryKey: getListBlocksQueryKey() });
              qc.invalidateQueries({ queryKey: getListProfilesQueryKey() });
              close();
              onBlocked?.();
            } catch {
              Alert.alert("خطأ", "تعذّر حظر المستخدم");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const submitReport = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await reportM.mutateAsync({
        data: {
          targetType,
          targetId: targetId ?? targetUserId,
          reason,
          note: note.trim(),
        },
      });
      close();
      Alert.alert("تم الإبلاغ", "شكراً لك. سيراجع الفريق البلاغ ويتخذ الإجراء المناسب.");
    } catch (err) {
      const body = (err as { response?: { data?: { error?: string } } })?.response?.data;
      Alert.alert("تعذّر", body?.error ?? "تعذّر إرسال البلاغ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={styles.flex} onPress={close} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {mode === "menu" ? (
            <View style={styles.menu}>
              <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
                {targetName || "المستخدم"}
              </Text>

              <TouchableOpacity
                style={[styles.action, { borderColor: colors.border }]}
                onPress={() => setMode("report")}
                activeOpacity={0.8}
              >
                <Ionicons name="flag-outline" size={20} color="#F59E0B" />
                <View style={styles.actionBody}>
                  <Text style={[styles.actionLabel, { color: colors.foreground }]}>إبلاغ</Text>
                  <Text style={[styles.actionHint, { color: colors.mutedForeground }]}>
                    أبلغ الفريق عن محتوى أو سلوك مخالف
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.action, { borderColor: colors.border }]}
                onPress={confirmBlock}
                disabled={busy}
                activeOpacity={0.8}
              >
                <Ionicons name="ban-outline" size={20} color="#EF4444" />
                <View style={styles.actionBody}>
                  <Text style={[styles.actionLabel, { color: "#EF4444" }]}>حظر</Text>
                  <Text style={[styles.actionHint, { color: colors.mutedForeground }]}>
                    يمنع المراسلة ويخفيكما عن بعض
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancel} onPress={close}>
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.menu}>
              <Text style={[styles.title, { color: colors.foreground }]}>سبب الإبلاغ</Text>
              <ScrollView style={styles.reasons} keyboardShouldPersistTaps="handled">
                {REASONS.map((r) => {
                  const selected = reason === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      style={[
                        styles.reason,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primary + "1A" : "transparent",
                        },
                      ]}
                      onPress={() => setReason(r.key)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={selected ? "radio-button-on" : "radio-button-off"}
                        size={18}
                        color={selected ? colors.primary : colors.mutedForeground}
                      />
                      <Text style={[styles.reasonText, { color: colors.foreground }]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TextInput
                  style={[
                    styles.note,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  placeholder="تفاصيل إضافية (اختياري)"
                  placeholderTextColor={colors.mutedForeground}
                  value={note}
                  onChangeText={setNote}
                  maxLength={500}
                  multiline
                  textAlign="right"
                />
              </ScrollView>

              <View style={styles.reportActions}>
                <TouchableOpacity style={styles.cancel} onPress={() => setMode("menu")}>
                  <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>رجوع</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submit,
                    { backgroundColor: reason && !busy ? "#EF4444" : colors.muted },
                  ]}
                  onPress={submitReport}
                  disabled={!reason || busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text
                      style={[
                        styles.submitText,
                        { color: reason ? "#fff" : colors.mutedForeground },
                      ]}
                    >
                      إرسال البلاغ
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 26,
    maxHeight: "82%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
  },
  menu: { padding: 18, gap: 10 },
  title: {
    fontSize: 16,
    fontWeight: "800" as const,
    textAlign: "center" as const,
    marginBottom: 4,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  actionBody: { flex: 1, gap: 2 },
  actionLabel: { fontSize: 15, fontWeight: "700" as const },
  actionHint: { fontSize: 12 },
  cancel: { alignItems: "center", paddingVertical: 12 },
  cancelText: { fontSize: 15, fontWeight: "600" as const },
  reasons: { maxHeight: 340 },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  reasonText: { fontSize: 14, fontWeight: "600" as const },
  note: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top" as const,
    marginTop: 4,
  },
  reportActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  submit: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitText: { fontSize: 15, fontWeight: "700" as const },
});
