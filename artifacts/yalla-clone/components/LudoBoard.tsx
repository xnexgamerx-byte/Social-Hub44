import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import {
  CENTER,
  GRID,
  HOME_COLUMN,
  RING,
  SAFE_RING_INDEXES,
  START_INDEX,
  YARD_ORIGIN,
  cellForPosition,
  type Cell,
  type LudoColor,
} from "@/lib/ludoBoard";

export const LUDO_HEX: Record<LudoColor, string> = {
  red: "#F0453A",
  green: "#22C55E",
  yellow: "#F5B400",
  blue: "#2F80ED",
};

const LUDO_DARK: Record<LudoColor, string> = {
  red: "#B4241C",
  green: "#15803D",
  yellow: "#B98600",
  blue: "#1D5FBF",
};

export const LUDO_LABEL: Record<LudoColor, string> = {
  red: "الأحمر",
  green: "الأخضر",
  yellow: "الأصفر",
  blue: "الأزرق",
};

interface BoardToken {
  color: LudoColor;
  index: number;
  pos: number;
  movable: boolean;
}

interface LudoBoardProps {
  size: number;
  tokens: BoardToken[];
  /** Colours seated at this table; unseated corners render dimmed. */
  seated: LudoColor[];
  onTokenPress?: (color: LudoColor, index: number) => void;
}

/** A single token, animated between board cells whenever its position changes. */
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
    // Tokens slide to their new cell rather than teleporting, which is what
    // makes a move readable at a glance.
    Animated.parallel([
      Animated.timing(x, {
        toValue: target.col * unit,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: target.row * unit,
        duration: 320,
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
          duration: 620,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 620,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    // Stop the loop on unmount/!movable, not only when it completes — leaving
    // a screen mid-pulse would otherwise leak a running animation.
    return () => loop.stop();
  }, [token.movable, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const dot = unit * 0.78;
  const hex = LUDO_HEX[token.color];

  return (
    <Animated.View
      style={[
        styles.tokenWrap,
        {
          width: unit,
          height: unit,
          transform: [{ translateX: x }, { translateY: y }],
        },
      ]}
      pointerEvents={token.movable ? "auto" : "none"}
    >
      <Pressable onPress={onPress} disabled={!token.movable} hitSlop={6}>
        <Animated.View
          style={{
            transform: [{ scale }, { translateX: stackOffset }, { translateY: -stackOffset }],
          }}
        >
          <View
            style={[
              styles.token,
              {
                width: dot,
                height: dot,
                borderRadius: dot / 2,
                backgroundColor: hex,
                borderColor: token.movable ? "#FFFFFF" : LUDO_DARK[token.color],
                borderWidth: token.movable ? 2.5 : 1.5,
              },
            ]}
          >
            <View
              style={[
                styles.tokenGloss,
                { width: dot * 0.34, height: dot * 0.34, borderRadius: dot },
              ]}
            />
            {token.pos >= 57 && (
              <Ionicons name="star" size={dot * 0.42} color="#fff" style={styles.tokenStar} />
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** Flat square used for every path cell. */
function PathCell({
  cell,
  unit,
  fill,
  star,
}: {
  cell: Cell;
  unit: number;
  fill: string;
  star?: boolean;
}) {
  return (
    <View
      style={[
        styles.cell,
        {
          left: cell.col * unit,
          top: cell.row * unit,
          width: unit,
          height: unit,
          backgroundColor: fill,
        },
      ]}
    >
      {star && <Ionicons name="star" size={unit * 0.5} color="rgba(0,0,0,0.28)" />}
    </View>
  );
}

export function LudoBoard({ size, tokens, seated, onTokenPress }: LudoBoardProps) {
  const unit = size / GRID;

  // Tokens sharing a cell fan out slightly so a stack stays countable.
  const stackOffsets = useMemo(() => {
    const byCell = new Map<string, number>();
    return tokens.map((t) => {
      const c = cellForPosition(t.color, t.pos, t.index);
      const key = `${c.col.toFixed(1)},${c.row.toFixed(1)}`;
      const n = byCell.get(key) ?? 0;
      byCell.set(key, n + 1);
      return n * (unit * 0.16);
    });
  }, [tokens, unit]);

  return (
    <View style={[styles.board, { width: size, height: size }]}>
      {/* Base felt */}
      <LinearGradient
        colors={["#FFFFFF", "#F3F0FF"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Corner yards */}
      {(Object.keys(YARD_ORIGIN) as LudoColor[]).map((color) => {
        const origin = YARD_ORIGIN[color];
        const active = seated.includes(color);
        return (
          <View
            key={`yard-${color}`}
            style={[
              styles.yard,
              {
                left: origin.col * unit,
                top: origin.row * unit,
                width: unit * 6,
                height: unit * 6,
                backgroundColor: LUDO_HEX[color],
                opacity: active ? 1 : 0.28,
              },
            ]}
          >
            <View
              style={[
                styles.yardInner,
                {
                  margin: unit * 0.75,
                  borderRadius: unit * 0.5,
                },
              ]}
            />
          </View>
        );
      })}

      {/* Ring path */}
      {RING.map((cell, i) => {
        const owner = (Object.keys(START_INDEX) as LudoColor[]).find(
          (c) => START_INDEX[c] === i,
        );
        const fill = owner ? LUDO_HEX[owner] : "#FFFFFF";
        return (
          <PathCell
            key={`ring-${i}`}
            cell={cell}
            unit={unit}
            fill={fill}
            star={SAFE_RING_INDEXES.has(i) && !owner}
          />
        );
      })}

      {/* Home columns */}
      {(Object.keys(HOME_COLUMN) as LudoColor[]).map((color) =>
        HOME_COLUMN[color].map((cell, i) => (
          <PathCell
            key={`home-${color}-${i}`}
            cell={cell}
            unit={unit}
            fill={LUDO_HEX[color]}
          />
        )),
      )}

      {/* Centre triangle target */}
      <View
        style={[
          styles.center,
          {
            left: (CENTER.col - 1) * unit,
            top: (CENTER.row - 1) * unit,
            width: unit * 3,
            height: unit * 3,
          },
        ]}
      >
        <LinearGradient
          colors={["#7C5CFC", "#4C1D95"]}
          style={[StyleSheet.absoluteFill, { borderRadius: unit * 0.4 }]}
        />
        <Ionicons name="trophy" size={unit * 1.3} color="#FFD75E" />
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
  );
}

/** Standalone die face, used by the game screen's roll control. */
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
    <View style={[styles.die, { width: size, height: size, borderRadius: size * 0.22 }]}>
      <View style={styles.dieGrid}>
        {Array.from({ length: 9 }).map((_, i) => (
          <View key={i} style={styles.dieCell}>
            {filled.includes(i) && (
              <View
                style={[
                  styles.diePip,
                  { width: size * 0.15, height: size * 0.15, borderRadius: size },
                ]}
              />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
    borderWidth: 2,
    borderColor: "rgba(124,92,252,0.25)",
  },
  yard: {
    position: "absolute",
    borderRadius: 14,
  },
  yardInner: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  cell: {
    position: "absolute",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,40,110,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  tokenWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  token: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  tokenGloss: {
    position: "absolute",
    top: "14%",
    left: "18%",
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  tokenStar: { position: "absolute" },
  die: {
    backgroundColor: "#FFFFFF",
    padding: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dieGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
  dieCell: {
    width: "33.33%",
    height: "33.33%",
    alignItems: "center",
    justifyContent: "center",
  },
  diePip: { backgroundColor: "#221B3A" },
});
