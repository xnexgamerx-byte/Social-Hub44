import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface UserAvatarProps {
  uri: string;
  size?: number;
  online?: boolean;
  bordered?: boolean;
}

export function UserAvatar({ uri, size = 44, online = false, bordered = false }: UserAvatarProps) {
  const colors = useColors();
  return (
    <View style={[styles.wrapper, { width: size + (bordered ? 4 : 0), height: size + (bordered ? 4 : 0) }]}>
      {bordered && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.border,
            { borderRadius: (size + 4) / 2, borderColor: colors.primary },
          ]}
        />
      )}
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.muted,
        }}
      />
      {online && (
        <View
          style={[
            styles.onlineDot,
            {
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
              borderColor: colors.background,
              backgroundColor: "#22C55E",
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  border: {
    borderWidth: 2,
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    borderWidth: 2,
  },
});
