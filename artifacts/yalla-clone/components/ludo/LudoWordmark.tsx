import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/**
 * Domed silhouette above the wordmark. Drawn rather than shipped as an image
 * so it stays sharp at any density and adds nothing to the bundle.
 */
function Mosque({ width = 150 }: { width?: number }) {
  const height = width * 0.55;
  return (
    <Svg width={width} height={height} viewBox="0 0 150 82">
      <Defs>
        <LinearGradient id="dome" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE9A8" />
          <Stop offset="0.45" stopColor="#F0BE49" />
          <Stop offset="1" stopColor="#C2841F" />
        </LinearGradient>
      </Defs>

      {/* Minarets */}
      <Rect x="10" y="34" width="9" height="48" rx="3" fill="url(#dome)" />
      <Path d="M10 34 Q14.5 20 19 34 Z" fill="url(#dome)" />
      <Circle cx="14.5" cy="16" r="3" fill="#FFE9A8" />

      <Rect x="131" y="34" width="9" height="48" rx="3" fill="url(#dome)" />
      <Path d="M131 34 Q135.5 20 140 34 Z" fill="url(#dome)" />
      <Circle cx="135.5" cy="16" r="3" fill="#FFE9A8" />

      {/* Side domes */}
      <Path d="M34 82 L34 56 Q34 40 47 36 Q60 40 60 56 L60 82 Z" fill="url(#dome)" />
      <Path d="M90 82 L90 56 Q90 40 103 36 Q116 40 116 56 L116 82 Z" fill="url(#dome)" />

      {/* Central dome */}
      <Path d="M56 82 L56 52 Q56 26 75 20 Q94 26 94 52 L94 82 Z" fill="url(#dome)" />
      <Path d="M75 20 L75 8" stroke="#FFE9A8" strokeWidth="2.5" strokeLinecap="round" />
      <Circle cx="75" cy="6" r="3.4" fill="#FFF3CC" />
    </Svg>
  );
}

/**
 * The lobby title. The gold face sits on a darker copy offset downward, which
 * is what gives the letters their carved depth — React Native has no text
 * stroke, so the shadow layer does that job.
 */
export function LudoWordmark() {
  return (
    <View style={styles.wrap}>
      <Mosque />
      <View style={styles.titleWrap}>
        <Text style={[styles.title, styles.titleShadow]} allowFontScaling={false}>
          LUDO
        </Text>
        <Text style={[styles.title, styles.titleFace]} allowFontScaling={false}>
          LUDO
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginTop: -6 },
  titleWrap: { marginTop: -10 },
  title: {
    fontSize: 62,
    fontWeight: "900" as const,
    letterSpacing: 2,
    lineHeight: 72,
  },
  titleShadow: { color: "#7A3B0B" },
  titleFace: {
    position: "absolute",
    top: -4,
    left: 0,
    right: 0,
    color: "#FFC93C",
    textShadowColor: "rgba(122,59,11,0.55)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
});
