import Constants from "expo-constants";
import { router } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { useColors } from "@/hooks/useColors";

const SUPPORT_EMAIL = "xsacexs@gmail.com";

export default function AboutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const version = Constants.expoConfig?.version ?? "—";
  // Present on installed builds; absent when running through Expo Go.
  const build = Constants.expoConfig?.android?.versionCode;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="حول التطبيق" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 22 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <Text style={[styles.name, { color: colors.foreground }]}>Viber Tok</Text>
          <Text style={[styles.version, { color: colors.mutedForeground }]}>
            الإصدار {version}
            {build ? ` (${build})` : ""}
          </Text>
        </View>

        <SettingsGroup title="القانوني">
          <SettingsRow
            icon="shield-checkmark-outline"
            label="سياسة الخصوصية"
            onPress={() =>
              router.push({ pathname: "/legal/[doc]", params: { doc: "privacy" } })
            }
          />
          <SettingsRow
            icon="document-text-outline"
            label="شروط الاستخدام"
            onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "terms" } })}
          />
        </SettingsGroup>

        <SettingsGroup title="تواصل">
          <SettingsRow icon="mail-outline" label="البريد الإلكتروني" value={SUPPORT_EMAIL} />
          <SettingsRow
            icon="headset-outline"
            label="خدمة العملاء"
            onPress={() => router.push("/support")}
          />
        </SettingsGroup>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  brand: { alignItems: "center", gap: 6, paddingVertical: 18 },
  name: { fontSize: 24, fontWeight: "800" as const },
  version: { fontSize: 13 },
});
