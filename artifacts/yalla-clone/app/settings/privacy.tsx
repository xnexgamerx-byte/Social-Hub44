import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QueryError } from "@/components/QueryError";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup, SettingsRow, SettingsStack } from "@/components/SettingsRow";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/hooks/useSettings";

export default function PrivacySettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, isLoading, isError, refetch, update } = useSettings();

  const toggle = async (patch: Parameters<typeof update>[0]) => {
    const res = await update(patch);
    if (!res.ok) Alert.alert("خطأ", res.error);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="إعدادات الخصوصية" />
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
            <SettingsStack>
              <SettingsRow
                standalone
                label="متصل متخفي"
                hint="تظهر دائماً كغير متصل للآخرين. أنت تشوف حالتك الحقيقية بملفك."
                switchValue={settings?.hideOnline ?? false}
                onSwitchChange={(v) => void toggle({ hideOnline: v })}
              />
              <SettingsRow
                standalone
                label="الدخول متخفي للغرفة"
                hint="ادخل الغرف بدون تشغيل مؤثر الدخول."
                switchValue={settings?.invisibleRoomEntry ?? false}
                onSwitchChange={(v) => void toggle({ invisibleRoomEntry: v })}
              />
              <SettingsRow
                standalone
                label="الدخول في وضع التصفح المتخفي"
                hint="تصفح الملفات الشخصية دون الظهور في سجل الزوار."
                switchValue={settings?.invisibleBrowsing ?? false}
                onSwitchChange={(v) => void toggle({ invisibleBrowsing: v })}
              />
            </SettingsStack>

            <SettingsGroup>
              <SettingsRow
                icon="eye-outline"
                label="الزوار"
                hint="مَن زار ملفك الشخصي"
                onPress={() => router.push("/visitors")}
              />
              <SettingsRow
                icon="ban-outline"
                label="القائمة السوداء"
                hint="الحسابات اللي حظرتها"
                onPress={() => router.push("/settings/blocked")}
              />
            </SettingsGroup>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 40 },
});
