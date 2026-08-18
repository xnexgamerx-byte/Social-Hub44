import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import {
  CENTER,
  GRID,
  HOME_COLUMN,
  RING,
  SAFE_RING_INDEXES,
  START_INDEX,
  YARD_ORIGIN,
  cellForPosition,
  yardSlots,
  type Cell,
  type LudoColor,
} from "@/lib/ludoBoard";

/** Deep, saturated board colours — the classic printed-board palette. */
export const LUDO_HEX: Record<LudoColor, string> = {
  red: "#B01D1D",
  green: "#1B7A3D",
  yellow: "#E0A008",
  blue: "#1F5C9E",
};

const LUDO_DEEP: Record<LudoColor, string> = {
  red: "#7E1010",
  green: "#12522A",
  yellow: "#A87200",
  blue: "#153F6E",
};

export const LUDO_LABEL: Record<LudoColor, string> = {
  red: "الأحمر",
  green: "الأخضر",
  yellow: "الأصفر",
  blue: "الأزرق",
};

// Warm board surface: aged cream squares inside a wooden frame.
const CREAM = "#F3E7CC";
const CREAM_LINE = "#C6A97B";
const WOOD_LIGHT = "#A9743F";
const WOOD_DARK = "#6E4522";
const SHIELD = "#B08A57";

interface BoardToken {
  color: LudoColor;
  index: number;
  pos: number;
  movable: boolean;
}

interface LudoBoardProps {
  size: number;
  tokens: BoardToken[];
  seated: LudoColor[];
  onTokenPress?: (color: LudoColor, index: number) => void;
}

/** The ringed disc used for every playing piece. */
function Piece({ color, size, glow }: { color: LudoColor; size: number; glow: boolean }) {
  return (
    <View
      style={[
        styles.piece,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: LUDO_HEX[color],
          borderColor: glow ? "#FFF8DC" : LUDO_DEEP[color],
          borderWidth: glow ? size * 0.09 : size * 0.06,
        },
      ]}
    >
      <View
        style={{
          width: size * 0.58,
          height: size * 0.58,
          borderRadius: size,
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: size * 0.26,
            height: size * 0.26,
            borderRadius: size,
            backgroundColor: LUDO_HEX[color],
          }}
        />
      </View>
    </View>
  );
}

/** One token, animated between board cells whenever its position changes. */
function Token({
  token,
  unit,
  stackOffset,
  onPress,
}: {
  token: BoardToken;
  unit: number;
  stackOffset: number;
  onPress?: () => void;
}) {
  const target = cellForPosition(token.color, token.pos, token.index);
  const x = useRef(new Animated.Value(target.col * unit)).current;
  const y = useRef(new Animated.Value(target.row * unit)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pieces slide to their new square — a jump makes a move hard to follow.
    Animated.parallel([
      Animated.timing(x, {
        toValue: target.col * unit,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: target.row * unit,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [target.col, target.row, unit, x, y]);

  useEffect(() => {
    if (!token.movable) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    // Stop on unmount as well as on completion, or leaving mid-pulse leaks it.
    return () => loop.stop();
  }, [token.movable, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const lift = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -unit * 0.12] });

  return (
    <Animated.View
      style={[
        styles.tokenWrap,
        { width: unit, height: unit, transform: [{ translateX: x }, { translateY: y }] },
      ]}
      pointerEvents={token.movable ? "auto" : "none"}
    >
      <Pressable onPress={onPress} disabled={!token.movable} hitSlop={8}>
        <Animated.View
          style={{
            transform: [
              { translateX: stackOffset },
              { translateY: lift },
              { scale },
            ],
          }}
        >
          <Piece color={token.color} size={unit * 0.82} glow={token.movable} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function Square({
  cell,
  unit,
  fill,
  shield,
}: {
  cell: Cell;
  unit: number;
  fill: string;
  shield?: boolean;
}) {
  return (
    <View
      style={[
        styles.square,
        {
          left: cell.col * unit,
          top: cell.row * unit,
          width: unit,
          height: unit,
          backgroundColor: fill,
        },
      ]}
    >
      {shield && <Ionicons name="shield" size={unit * 0.52} color={SHIELD} />}
    </View>
  );
}

export function LudoBoard({ size, tokens, seated, onTokenPress }: LudoBoardProps) {
  const frame = size * 0.035;
  const inner = size - frame * 2;
  const unit = inner / GRID;

  // Tokens sharing a square fan sideways so a stack stays countable.
  const stackOffsets = useMemo(() => {
    const seen = new Map<string, number>();
    return tokens.map((t) => {
      const c = cellForPosition(t.color, t.pos, t.index);
      const key = `${c.col.toFixed(1)},${c.row.toFixed(1)}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      return n * (unit * 0.2);
    });
  }, [tokens, unit]);

  const colors = Object.keys(YARD_ORIGIN) as LudoColor[];

  return (
    // Wooden frame
    <LinearGradient
      colors={[WOOD_LIGHT, WOOD_DARK]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.frame, { width: size, height: size, padding: frame }]}
    >
      <View style={{ width: inner, height: inner, backgroundColor: CREAM }}>
        {/* Corner yards */}
        {colors.map((color) => {
          const origin = YARD_ORIGIN[color];
          const active = seated.includes(color);
          const pad = unit * 0.55;
          return (
            <View
              key={`yard-${color}`}
              style={{
                position: "absolute",
                left: origin.col * unit,
                top: origin.row * unit,
                width: unit * 6,
                height: unit * 6,
                backgroundColor: LUDO_HEX[color],
                opacity: active ? 1 : 0.35,
              }}
            >
              {/* Inset panel that holds the four resting nooks */}
              <View
                style={{
                  position: "absolute",
                  left: pad,
                  top: pad,
                  right: pad,
                  bottom: pad,
                  borderRadius: unit * 0.5,
                  backgroundColor: LUDO_DEEP[color],
                }}
              />
              {yardSlots(color).map((slot, i) => (
                <View
                  key={i}
                  style={{
                    position: "absolute",
                    left: (slot.col - origin.col) * unit,
                    top: (slot.row - origin.row) * unit,
                    width: unit,
                    height: unit,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: unit * 0.86,
                      height: unit * 0.86,
                      borderRadius: unit,
                      backgroundColor: "rgba(0,0,0,0.22)",
                    }}
                  />
                </View>
              ))}
            </View>
          );
        })}

        {/* Ring squares — entry squares wear their owner's colour */}
        {RING.map((cell, i) => {
          const owner = colors.find((c) => START_INDEX[c] === i);
          return (
            <Square
              key={`ring-${i}`}
              cell={cell}
              unit={unit}
              fill={owner ? LUDO_HEX[owner] : CREAM}
              shield={SAFE_RING_INDEXES.has(i) && !owner}
            />
          );
        })}

        {/* Home columns */}
        {colors.map((color) =>
          HOME_COLUMN[color].map((cell, i) => (
            <Square
              key={`home-${color}-${i}`}
              cell={cell}
              unit={unit}
              fill={LUDO_HEX[color]}
            />
          )),
        )}

        {/* Centre: four triangles meeting where the home columns arrive */}
        <View
          style={{
            position: "absolute",
            left: (CENTER.col - 1) * unit,
            top: (CENTER.row - 1) * unit,
            width: unit * 3,
            height: unit * 3,
          }}
        >
          {/* green enters from the top, blue from the bottom, red from the
              left and yellow from the right — see HOME_COLUMN. */}
          <View
            style={[
              styles.triangle,
              {
                top: 0,
                left: 0,
                borderLeftWidth: unit * 1.5,
                borderRightWidth: unit * 1.5,
                borderTopWidth: unit * 1.5,
                borderTopColor: LUDO_HEX.green,
              },
            ]}
          />
          <View
            style={[
              styles.triangle,
              {
                bottom: 0,
                left: 0,
                borderLeftWidth: unit * 1.5,
                borderRightWidth: unit * 1.5,
                borderBottomWidth: unit * 1.5,
                borderBottomColor: LUDO_HEX.blue,
              },
            ]}
          />
          <View
            style={[
              styles.triangle,
              {
                left: 0,
                top: 0,
                borderTopWidth: unit * 1.5,
                borderBottomWidth: unit * 1.5,
                borderLeftWidth: unit * 1.5,
                borderLeftColor: LUDO_HEX.red,
              },
            ]}
          />
          <View
            style={[
              styles.triangle,
              {
                right: 0,
                top: 0,
                borderTopWidth: unit * 1.5,
                borderBottomWidth: unit * 1.5,
                borderRightWidth: unit * 1.5,
                borderRightColor: LUDO_HEX.yellow,
              },
            ]}
          />
        </View>

        {/* Tokens */}
        {tokens.map((t, i) => (
          <Token
            key={`${t.color}-${t.index}`}
            token={t}
            unit={unit}
            stackOffset={stackOffsets[i]}
            onPress={onTokenPress ? () => onTokenPress(t.color, t.index) : undefined}
          />
        ))}
      </View>
    </LinearGradient>
  );
}

/** Standalone die face used by the roll control. */
export function DieFace({ value, size }: { value: number | null; size: number }) {
  const pips: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  const filled = value != null ? pips[value] ?? [] : [];
  return (
    <View style={[styles.die, { width: size, height: size, borderRadius: size * 0.2 }]}>
      <View style={styles.dieGrid}>
        {Array.from({ length: 9 }).map((_, i) => (
          <View key={i} style={styles.dieCell}>
            {filled.includes(i) && (
              <View
                style={{
                  width: size * 0.16,
                  height: size * 0.16,
                  borderRadius: size,
                  backgroundColor: "#2A1508",
                }}
              />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  square: {
    position: "absolute",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CREAM_LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  triangle: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  tokenWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  piece: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  die: {
    backgroundColor: "#FFF8E7",
    padding: 4,
    borderWidth: 1,
    borderColor: "#C6A97B",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  dieGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
  dieCell: {
    width: "33.33%",
    height: "33.33%",
    alignItems: "center",
    justifyContent: "center",
  },
});
