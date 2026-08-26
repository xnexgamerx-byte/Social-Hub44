import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface LudoModeCardProps {
  label: string;
  /** Body gradient, light stop first. */
  colors: [string, string];
  /** Banner colours for the label scroll. */
  banner: [string, string];
  height: number;
  onPress: () => void;
  children: React.ReactNode;
}

/**
 * A lobby mode tile: an illustrated body with a rolled banner carrying the
 * label, matching the reference lobby's card language.
 */
export function LudoModeCard({
  label,
  colors,
  banner,
  height,
  onPress,
  children,
}: LudoModeCardProps) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.touch}>
      <LinearGradient
        colors={colors}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[styles.body, { height }]}
      >
        {/* Inset highlight — reads as a bevelled edge rather than a flat fill. */}
        <View style={styles.inset} pointerEvents="none" />
        <View style={styles.art}>{children}</View>
      </LinearGradient>

      <View style={styles.bannerRow}>
        {/* The rolled ends of the scroll. */}
        <View style={[styles.curl, { backgroundColor: banner[1] }]} />
        <LinearGradient
          colors={banner}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.banner}
        >
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </LinearGradient>
        <View style={[styles.curl, { backgroundColor: banner[1] }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touch: { alignItems: "center" },
  body: {
    width: "100%",
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  inset: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
  },
  art: { alignItems: "center", justifyContent: "center" },
  bannerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: -16,
    paddingHorizontal: 6,
  },
  curl: { width: 12, height: 22, borderRadius: 6 },
  banner: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    marginHorizontal: -3,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900" as const,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
});
