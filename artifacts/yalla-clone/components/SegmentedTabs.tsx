import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface SegmentedTabsProps {
  tabs: string[];
  value: number;
  onChange: (index: number) => void;
  /** Extra spacing between tabs; defaults to the header spacing. */
  gap?: number;
}

/**
 * The underline tab strip used across the app headers. Extracted because the
 * same markup and styles were duplicated verbatim in the home and rooms tabs,
 * so a change to one silently diverged from the other.
 */
export function SegmentedTabs({ tabs, value, onChange, gap = 24 }: SegmentedTabsProps) {
  const colors = useColors();
  return (
    <View style={[styles.tabs, { gap }]}>
      {tabs.map((label, i) => (
        <TouchableOpacity
          key={label}
          onPress={() => onChange(i)}
          style={styles.tabBtn}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === value }}
        >
          <Text
            style={[
              styles.tabLabel,
              {
                color: i === value ? colors.foreground : colors.mutedForeground,
                fontWeight: i === value ? "700" : "400",
              },
            ]}
          >
            {label}
          </Text>
          {i === value ? (
            <View style={[styles.tabUnder, { backgroundColor: colors.primary }]} />
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row" },
  tabBtn: { alignItems: "center", paddingBottom: 8 },
  tabLabel: { fontSize: 17 },
  tabUnder: { height: 3, width: "100%", borderRadius: 2, marginTop: 4 },
});
