import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { THEME_OPTIONS, useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";

export default function GeneralSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { theme, setTheme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="عام" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 22 }}
        showsVerticalScrollIndicator={false}
      >
        <SettingsGroup title="المظهر">
          {THEME_OPTIONS.map((option) => (
            <SettingsRow
              key={option.name}
              label={option.label}
              hint={option.description}
              selected={theme === option.name}
              onPress={() => setTheme(option.name)}
            />
          ))}
        </SettingsGroup>

        <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
          المظهر يُحفظ على هذا الجهاز فقط.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right" as const,
    paddingHorizontal: 6,
  },
});
