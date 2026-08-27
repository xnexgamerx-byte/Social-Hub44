import React from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { UserSettingsPatchWhoCanDm } from "@workspace/api-client-react";
import { QueryError } from "@/components/QueryError";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/hooks/useSettings";

const WHO_CAN_DM: { value: UserSettingsPatchWhoCanDm; label: string; hint: string }[] = [
  { value: "all", label: "الكل", hint: "أي مستخدم يقدر يبدأ محادثة معك" },
  {
    value: "following",
    label: "من أتابعهم فقط",
    hint: "الحسابات اللي تتابعها بس تقدر تراسلك",
  },
  { value: "none", label: "لا أحد", hint: "ما راح توصلك محادثات جديدة" },
];

export default function MessageSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, isLoading, isError, refetch, update } = useSettings();

  const choose = async (value: UserSettingsPatchWhoCanDm) => {
    if (settings?.whoCanDm === value) return;
    const res = await update({ whoCanDm: value });
    if (!res.ok) Alert.alert("خطأ", res.error);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="ضبط الرسائل" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : isError ? (
          <QueryError message="تعذّر تحميل الإعدادات." onRetry={() => void refetch()} />
        ) : (
          <>
            <SettingsGroup title="من يمكنه مراسلتي">
              {WHO_CAN_DM.map((option) => (
                <SettingsRow
                  key={option.value}
                  label={option.label}
                  hint={option.hint}
                  selected={settings?.whoCanDm === option.value}
                  onPress={() => void choose(option.value)}
                />
              ))}
            </SettingsGroup>

            <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
              الحساب الرسمي للتطبيق يقدر يراسلك دائماً، مهما كان الإعداد.
              {"\n"}
              المحادثات المفتوحة من قبل تبقى شغّالة.
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
    lineHeight: 19,
    textAlign: "right" as const,
    paddingHorizontal: 6,
  },
});
