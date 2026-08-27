import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { UserSettingsPatchNotifyDm } from "@workspace/api-client-react";
import { QueryError } from "@/components/QueryError";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/hooks/useSettings";

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

  const save = async (patch: Parameters<typeof update>[0]) => {
    const res = await update(patch);
    if (!res.ok) Alert.alert("خطأ", res.error);
  };

  const chooseDm = async (value: UserSettingsPatchNotifyDm) => {
    setPickingDm(false);
    if (current === value) return;
    await save({ notifyDm: value });
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

            <SettingsGroup title="اللحظات">
              <SettingsRow
                label="إشعار الإعجاب"
                hint="تنبيه لمّا أحد يعجبه منشورك"
                switchValue={settings?.notifyLikes ?? true}
                onSwitchChange={(v) => void save({ notifyLikes: v })}
              />
              <SettingsRow
                label="لحظات ممّن أتابعهم"
                hint="تنبيه لمّا ينشر أحد تتابعه لحظة جديدة"
                switchValue={settings?.notifyMoments ?? true}
                onSwitchChange={(v) => void save({ notifyMoments: v })}
              />
            </SettingsGroup>

            <SettingsGroup title="ملفي الشخصي">
              <SettingsRow
                label="إشعار زائر"
                hint="تنبيه لمّا أحد يفتح ملفك الشخصي"
                switchValue={settings?.notifyVisitors ?? true}
                onSwitchChange={(v) => void save({ notifyVisitors: v })}
              />
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
