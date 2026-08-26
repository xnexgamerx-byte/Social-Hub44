import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QueryError } from "@/components/QueryError";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsRow, SettingsStack } from "@/components/SettingsRow";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/hooks/useSettings";

const PENDING = "قيد التحضير";

export default function MessageSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isLoading, isError, refetch } = useSettings();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="ضبط الرسائل" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 22 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : isError ? (
          <QueryError message="تعذّر تحميل الإعدادات." onRetry={() => void refetch()} />
        ) : (
          <SettingsStack>
            <SettingsRow
              standalone
              label="استلام رسائل المطابقة"
              hint="سيقوم النظام بترشيح مستخدمين من الجنس الآخر لي"
              switchValue={false}
              disabled
              disabledReason={`${PENDING} — يحتاج نظام المطابقة`}
            />
            <SettingsRow
              standalone
              label="طي التحيات المستلمة"
              hint="طي رسائل الترحيب الجديدة"
              switchValue={false}
              disabled
              disabledReason={`${PENDING} — يحتاج ميزة التحيات`}
            />
            <SettingsRow
              standalone
              label="SoulLink"
              hint="اسمح للنظام بإرسال دعوات دردشة مجهولة لك بناءً على اهتماماتك."
              switchValue={false}
              disabled
              disabledReason={`${PENDING} — SoulLink غير مفعّلة`}
            />
          </SettingsStack>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 40 },
});
