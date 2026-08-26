import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface ScreenHeaderProps {
  title: string;
  /** Optional control on the leading (left) edge. */
  action?: React.ReactNode;
  onBack?: () => void;
}

/**
 * Title bar for pushed screens: a back chevron, a centred title, and room for
 * one trailing control. In Arabic the back affordance points right, which is
 * why this is `chevron-forward` while list rows use `chevron-back`.
 */
export function ScreenHeader({ title, action, onBack }: ScreenHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View
      style={[
        styles.header,
        { paddingTop: topPad + 10, borderBottomColor: colors.border },
      ]}
    >
      <TouchableOpacity
        onPress={onBack ?? (() => router.back())}
        style={styles.side}
        accessibilityRole="button"
        accessibilityLabel="رجوع"
      >
        <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.side}>{action}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  side: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 16, fontWeight: "700" as const, textAlign: "center" as const },
});
