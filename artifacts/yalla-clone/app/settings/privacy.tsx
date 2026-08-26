import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { UserSettingsPatchWhoCanDm } from "@workspace/api-client-react";
import { QueryError } from "@/components/QueryError";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup, SettingsRow, SettingsStack } from "@/components/SettingsRow";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/hooks/useSettings";

const PENDING = "قيد التحضير";
/** Depends on location, which the app does not collect. */
const NEEDS_LOCATION = "قيد التحضير — يحتاج ميزة الموقع";

const WHO_CAN_DM: { value: UserSettingsPatchWhoCanDm; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "following", label: "من أتابعهم فقط" },
  { value: "none", label: "لا أحد" },
];

export default function PrivacySettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, isLoading, isError, refetch, update } = useSettings();
  const [pickingDm, setPickingDm] = useState(false);

  const whoCanDm = settings?.whoCanDm ?? "all";
  const whoCanDmLabel = WHO_CAN_DM.find((o) => o.value === whoCanDm)?.label ?? "الكل";

  const toggle = async (patch: Parameters<typeof update>[0]) => {
    const res = await update(patch);
    if (!res.ok) Alert.alert("خطأ", res.error);
  };

  const chooseDm = async (value: UserSettingsPatchWhoCanDm) => {
    setPickingDm(false);
    if (whoCanDm === value) return;
    await toggle({ whoCanDm: value });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="إعدادات الخصوصية" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
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
                hint="إخفاء حالة الاتصال في جميع الحالات."
                switchValue={settings?.hideOnline ?? false}
                onSwitchChange={(v) => void toggle({ hideOnline: v })}
              />
              <SettingsRow
                standalone
                label="المستخدمون القريبون لا يمكنهم رؤيتي"
                hint="إخفائي من القائمة الرئيسية للمستخدمين ضمن نطاق ٥ كم"
                switchValue={false}
                disabled
                disabledReason={NEEDS_LOCATION}
              />
              <SettingsRow
                standalone
                label="إخفاء المسافة"
                hint="سيتم إخفاء مسافتي عن الآخرين."
                switchValue={false}
                disabled
                disabledReason={NEEDS_LOCATION}
              />
              <SettingsRow
                standalone
                label="قائمة الإخفاء"
                hint="الظهور كضيف غامض في لوحات المتصدرين للحفاظ على هويتك مجهولة."
                switchValue={false}
                disabled
                disabledReason={`${PENDING} — يحتاج لوحات المتصدرين`}
              />
              <SettingsRow
                standalone
                label="الدخول متخفي للغرفة"
                hint="إخفاء مؤثر الدخول عند دخولك أي غرفة."
                switchValue={settings?.invisibleRoomEntry ?? false}
                onSwitchChange={(v) => void toggle({ invisibleRoomEntry: v })}
              />
              <SettingsRow
                standalone
                label="الدخول في وضع التصفح المتخفي"
                hint="تصفح الملفات الشخصية دون الظهور في سجل الزوار."
                switchValue={false}
                disabled
                disabledReason={`${PENDING} — يحتاج سجل الزوار`}
              />
              <SettingsRow
                standalone
                label="تبديل الحراسة"
                hint="السماح للآخرين بأن يصبحوا حراسي وعرض قائمة الحراس الخاصة بي"
                switchValue={false}
                disabled
                disabledReason={`${PENDING} — نظام الحراس غير مفعّل`}
              />
            </SettingsStack>

            <SettingsGroup>
              <SettingsRow
                label="من يمكنه مراسلتي؟"
                value={whoCanDmLabel}
                onPress={() => setPickingDm((v) => !v)}
              />
              {pickingDm
                ? WHO_CAN_DM.map((option) => (
                    <SettingsRow
                      key={option.value}
                      label={option.label}
                      selected={whoCanDm === option.value}
                      onPress={() => void chooseDm(option.value)}
                    />
                  ))
                : null}
              <SettingsRow
                label="من يمكنه الإشارة إليّ؟"
                value="الكل"
                disabled
                disabledReason={`${PENDING} — يحتاج ميزة الإشارة`}
              />
              <SettingsRow
                label="القائمة السوداء"
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
