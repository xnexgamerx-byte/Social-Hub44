import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, {
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Stop,
} from "react-native-svg";

/** Height of the curtain valance, including the drapes hanging beside it. */
const CURTAIN_HEIGHT = 250;
const STAR_COUNT = 44;

/**
 * Deterministic pseudo-random so the star field is identical on every render.
 * A Math.random() field would twinkle into a different sky on each re-render.
 */
function seededStars(count: number, width: number, height: number) {
  let seed = 20260826;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    left: next() * width,
    // Keep stars below the curtain, where the sky is actually visible.
    top: CURTAIN_HEIGHT * 0.7 + next() * (height - CURTAIN_HEIGHT * 0.7),
    size: 1.5 + next() * 2.2,
    opacity: 0.25 + next() * 0.6,
  }));
}

function Curtain({ width }: { width: number }) {
  const h = CURTAIN_HEIGHT;
  // The valance hangs to `drop` at the sides and swings lower in the middle.
  const drop = h * 0.46;
  const dip = h * 0.68;
  const valance = `M0 0 H${width} V${drop} C${width * 0.78} ${dip} ${width * 0.22} ${dip} 0 ${drop} Z`;
  const hem = `M0 ${drop} C${width * 0.22} ${dip} ${width * 0.78} ${dip} ${width} ${drop}`;
  const leftDrape = `M0 ${drop - 4} C${width * 0.1} ${drop + 30} ${width * 0.15} ${h * 0.85} ${width * 0.13} ${h} L0 ${h} Z`;
  const rightDrape = `M${width} ${drop - 4} C${width * 0.9} ${drop + 30} ${width * 0.85} ${h * 0.85} ${width * 0.87} ${h} L${width} ${h} Z`;

  return (
    <Svg width={width} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgGradient id="cloth" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2FB3A8" />
          <Stop offset="0.55" stopColor="#1B9089" />
          <Stop offset="1" stopColor="#0E6E6C" />
        </SvgGradient>
        <SvgGradient id="drape" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#25A79E" />
          <Stop offset="1" stopColor="#0B5F60" />
        </SvgGradient>
        <SvgGradient id="gold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FBE08A" />
          <Stop offset="0.5" stopColor="#E9B93F" />
          <Stop offset="1" stopColor="#B8801F" />
        </SvgGradient>
      </Defs>

      <Path d={leftDrape} fill="url(#drape)" />
      <Path d={rightDrape} fill="url(#drape)" />
      <Path d={valance} fill="url(#cloth)" />
      {/* Gold hem tracing the curve, which is what makes it read as a curtain. */}
      <Path d={hem} stroke="url(#gold)" strokeWidth={7} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Moon({ x, y, size }: { x: number; y: number; size: number }) {
  const r = size / 2;
  return (
    <View style={[styles.moonWrap, { left: x - size, top: y - size, width: size * 2, height: size * 2 }]}>
      {/* Soft halo behind the crescent. */}
      <View
        style={[
          styles.halo,
          { width: size * 2, height: size * 2, borderRadius: size, backgroundColor: "#CFE6FF" },
        ]}
      />
      <Svg width={size} height={size} style={{ position: "absolute", left: r, top: r }}>
        <Defs>
          <SvgGradient id="moonFill" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#BBD8FF" />
          </SvgGradient>
        </Defs>
        <Path
          d={`M${r} 1 A${r - 1} ${r - 1} 0 1 0 ${r} ${size - 1} A${r * 1.25} ${r * 1.25} 0 0 1 ${r} 1 Z`}
          fill="url(#moonFill)"
        />
      </Svg>
    </View>
  );
}

/**
 * The night sky, curtain and moon the Ludo lobby sits on. Purely decorative —
 * it renders behind the lobby content and never intercepts touches.
 */
export function LudoBackdrop() {
  const { width, height } = useWindowDimensions();
  const stars = useMemo(() => seededStars(STAR_COUNT, width, height), [width, height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={["#5B5ECB", "#4038A4", "#2B2570", "#1D1852"]}
        locations={[0, 0.38, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      {stars.map((s, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: "#FFFFFF",
            opacity: s.opacity,
          }}
        />
      ))}

      <Moon x={width / 2} y={CURTAIN_HEIGHT * 0.86} size={26} />
      <Curtain width={width} />
    </View>
  );
}

export { CURTAIN_HEIGHT };

const styles = StyleSheet.create({
  moonWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", opacity: 0.16 },
});
