import { useAuth } from "@clerk/expo";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { useColors } from "@/hooks/useColors";
import { cacheSizeBytes, clearImageCache, formatBytes } from "@/lib/cache";

export default function SettingsHubScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [cacheBytes, setCacheBytes] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  const measure = useCallback(() => {
    void cacheSizeBytes().then(setCacheBytes);
  }, []);

  useEffect(measure, [measure]);

  const confirmSignOut = () => {
    Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج من حسابك؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "خروج", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  const clearCache = () => {
    Alert.alert(
      "مسح ذاكرة التخزين المؤقت",
      "سيُعاد تحميل الصور من الإنترنت بعد المسح. لن تفقد أي بيانات.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "مسح",
          onPress: async () => {
            setClearing(true);
            try {
              await clearImageCache();
              measure();
            } catch {
              Alert.alert("خطأ", "تعذّر مسح الذاكرة المؤقتة");
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    );
  };

  const cacheValue = clearing
    ? "جارٍ المسح…"
    : cacheBytes === null
      ? undefined
      : formatBytes(cacheBytes);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="الضبط" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 22 }}
        showsVerticalScrollIndicator={false}
      >
        <SettingsGroup>
          <SettingsRow
            label="الحساب والأمان"
            onPress={() => router.push("/settings/account")}
          />
          <SettingsRow
            label="إخطارات"
            onPress={() => router.push("/settings/notifications")}
          />
          <SettingsRow
            label="اللغة"
            value="العربية"
            disabled
            // Every string in the app is written in Arabic in place; a second
            // language needs a translation layer, not a switch here.
            disabledReason="الإنجليزية قيد التحضير"
          />
          <SettingsRow
            label="ضبط الرسائل"
            onPress={() => router.push("/settings/messages")}
          />
          <SettingsRow
            label="إعدادات الخصوصية"
            onPress={() => router.push("/settings/privacy")}
          />
          <SettingsRow label="عام" onPress={() => router.push("/settings/general")} />
          <SettingsRow
            label="مسح ذاكرة التخزين المؤقت"
            value={cacheValue}
            onPress={clearing ? undefined : clearCache}
          />
          <SettingsRow
            label="حول التطبيق"
            onPress={() => router.push("/settings/about")}
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow
            label="تبديل الحساب"
            disabled
            disabledReason="قيد التحضير — حساب واحد لكل جهاز حالياً"
          />
          <SettingsRow label="تسجيل الخروج" destructive onPress={confirmSignOut} />
        </SettingsGroup>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
