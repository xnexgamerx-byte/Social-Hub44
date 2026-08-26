import { useAuth, useUser } from "@clerk/expo";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDeleteMyAccount } from "@workspace/api-client-react";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { useColors } from "@/hooks/useColors";
import { clerkErrorMessage } from "@/lib/clerkError";

/** Typed to confirm deletion — a destructive, irreversible action. */
const DELETE_PHRASE = "حذف";
const MIN_PASSWORD = 8;

export default function AccountSecurityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useAuth();
  const deleteM = useDeleteMyAccount();

  const [showPassword, setShowPassword] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Accounts created through Google have no password yet; they set one rather
  // than change one, so the current-password field would be unanswerable.
  const hasPassword = user?.passwordEnabled ?? false;
  const canSavePassword =
    next.trim().length >= MIN_PASSWORD && (!hasPassword || current.length > 0) && !savingPassword;

  const savePassword = async () => {
    if (!user) return;
    setSavingPassword(true);
    try {
      await user.updatePassword({
        newPassword: next.trim(),
        ...(hasPassword ? { currentPassword: current } : {}),
      });
      setCurrent("");
      setNext("");
      setShowPassword(false);
      Alert.alert("تم", hasPassword ? "تم تغيير كلمة المرور" : "تم تعيين كلمة المرور");
    } catch (err) {
      Alert.alert("خطأ", clerkErrorMessage(err, "تعذّر تغيير كلمة المرور"));
    } finally {
      setSavingPassword(false);
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

  const canDelete = confirmText.trim() === DELETE_PHRASE && !deleting;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="الحساب والأمان" />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 22 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SettingsGroup>
          <SettingsRow
            icon="key-outline"
            label={hasPassword ? "تعديل كلمة مرور الحساب" : "تعيين كلمة مرور"}
            hint={hasPassword ? undefined : "حسابك مسجّل عبر Google — عيّن كلمة مرور للدخول المباشر"}
            onPress={() => setShowPassword((v) => !v)}
          />
          <SettingsRow
            icon="phone-portrait-outline"
            label="ربط رقم الهاتف"
            disabled
            disabledReason="قيد التحضير — يحتاج تفعيل إرسال الرموز عبر SMS"
          />
          <SettingsRow
            icon="card-outline"
            label="إعدادات حماية المدفوعات"
            disabled
            disabledReason="تُفعَّل مع تشغيل الشراء داخل التطبيق"
          />
        </SettingsGroup>

        {showPassword ? (
          <View
            style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            {hasPassword ? (
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
                value={current}
                onChangeText={setCurrent}
                placeholder="كلمة المرور الحالية"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                textAlign="right"
              />
            ) : null}
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              value={next}
              onChangeText={setNext}
              placeholder={`كلمة المرور الجديدة (${MIN_PASSWORD} أحرف على الأقل)`}
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              textAlign="right"
            />
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: canSavePassword ? colors.primary : colors.muted },
              ]}
              onPress={savePassword}
              disabled={!canSavePassword}
            >
              {savingPassword ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.saveText,
                    { color: canSavePassword ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  حفظ
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.destructive }]}>حذف الحساب</Text>
          <View style={[styles.danger, { borderColor: colors.destructive + "55", backgroundColor: colors.destructive + "0D" }]}>
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
                  borderColor: canDelete ? colors.destructive : colors.border,
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
              style={[styles.deleteBtn, { backgroundColor: canDelete ? colors.destructive : colors.muted }]}
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
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "800" as const, textAlign: "right" as const },
  form: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
  },
  saveBtn: { borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  saveText: { fontSize: 14.5, fontWeight: "800" as const },
  danger: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  dangerText: { fontSize: 13, lineHeight: 20, textAlign: "right" as const },
  dangerHint: { fontSize: 12, marginTop: 2, textAlign: "right" as const },
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
