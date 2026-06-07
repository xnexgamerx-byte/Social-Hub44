import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const AVATAR_COLORS = [
  "#7C3AED", "#EC4899", "#06B6D4", "#10B981",
  "#F59E0B", "#EF4444", "#8B5CF6", "#3B82F6",
];

function nameColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

interface UserAvatarProps {
  uri: string;
  name?: string;
  size?: number;
  online?: boolean;
  bordered?: boolean;
}

export function UserAvatar({ uri, name = "?", size = 44, online = false, bordered = false }: UserAvatarProps) {
  const colors = useColors();
  const [error, setError] = useState(false);
  const bg = nameColor(name);
  const initial = [...name].find((c) => /\S/.test(c)) ?? "?";

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
      {error || !uri ? (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: size * 0.42, fontWeight: "700" }}>
            {initial}
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.muted,
          }}
          onError={() => setError(true)}
        />
      )}
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
