import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { UserSettingsPatchNotifyDm } from "@workspace/api-client-react";
import { QueryError } from "@/components/QueryError";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/hooks/useSettings";

/**
 * Notification types the app does not send yet. Listed so the screen matches
 * what the app will do, but shown disabled with the reason rather than as
 * switches that silently control nothing.
 */
const PENDING = "قيد التحضير";

const DM_OPTIONS: { value: UserSettingsPatchNotifyDm; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "none", label: "إيقاف" },
];

export default function NotificationSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, isLoading, isError, refetch, update } = useSettings();
  const [pickingDm, setPickingDm] = useState(false);

  const current = settings?.notifyDm ?? "all";
  const currentLabel = DM_OPTIONS.find((o) => o.value === current)?.label ?? "الكل";

  const chooseDm = async (value: UserSettingsPatchNotifyDm) => {
    setPickingDm(false);
    if (current === value) return;
    const res = await update({ notifyDm: value });
    if (!res.ok) Alert.alert("خطأ", res.error);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="إخطارات" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 22 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : isError ? (
          <QueryError message="تعذّر تحميل الإعدادات." onRetry={() => void refetch()} />
        ) : (
          <>
            <SettingsGroup title="إشعارات الدردشة">
              <SettingsRow
                label="إشعارات الرسائل الخاصة"
                value={currentLabel}
                onPress={() => setPickingDm((v) => !v)}
              />
              {pickingDm
                ? DM_OPTIONS.map((option) => (
                    <SettingsRow
                      key={option.value}
                      label={option.label}
                      selected={current === option.value}
                      onPress={() => void chooseDm(option.value)}
                    />
                  ))
                : null}
            </SettingsGroup>

            <SettingsGroup title="إشعار ديناميكي">
              <SettingsRow label="تحديث اللحظات التالية" switchValue={false} disabled disabledReason={PENDING} />
              <SettingsRow label="إشعار الإعجاب" switchValue={false} disabled disabledReason={PENDING} />
              <SettingsRow label="إشعار التعليق" switchValue={false} disabled disabledReason={PENDING} />
              <SettingsRow label="إشعارات الإشارة (@)" switchValue={false} disabled disabledReason={PENDING} />
            </SettingsGroup>

            <SettingsGroup title="تنبيه الرسائل الأخرى">
              <SettingsRow label="إشعار زائر" switchValue={false} disabled disabledReason={PENDING} />
              <SettingsRow label="إشعارات غرفة الدردشة" switchValue={false} disabled disabledReason={PENDING} />
              <SettingsRow label="إشعار مكالمة فيديو" switchValue={false} disabled disabledReason={PENDING} />
              <SettingsRow label="إشعارات المكالمة الصوتية" switchValue={false} disabled disabledReason={PENDING} />
              <SettingsRow label="متابعة إشعارات الغرفة" switchValue={false} disabled disabledReason={PENDING} />
            </SettingsGroup>

            <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
              الإشعارات تصل على النسخة المثبّتة من التطبيق فقط، ولا تعمل داخل Expo Go.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 40 },
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right" as const,
    paddingHorizontal: 6,
  },
});
