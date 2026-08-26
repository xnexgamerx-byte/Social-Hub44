import React from "react";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

/** Matches the seat colours the real board uses, so the art never lies. */
const RED = "#D93A2B";
const GREEN = "#1E9E4A";
const YELLOW = "#EFB008";
const BLUE = "#2273C7";
const CREAM = "#FBF3DE";
const LINE = "rgba(60,40,10,0.18)";

interface MiniLudoBoardProps {
  size?: number;
  /** Corners to leave empty — used to show a duel board with two seats. */
  seats?: 2 | 4;
}

/**
 * A small ludo board for the lobby cards. Drawn from the same geometry as the
 * real board so a mode card looks like the game it opens.
 */
export function MiniLudoBoard({ size = 96, seats = 4 }: MiniLudoBoardProps) {
  // 15x15 grid, the standard ludo layout.
  const u = 100 / 15;
  const yardCorners: { x: number; y: number; color: string; show: boolean }[] = [
    { x: 0, y: 0, color: RED, show: true },
    { x: u * 9, y: 0, color: GREEN, show: seats === 4 },
    { x: 0, y: u * 9, color: BLUE, show: seats === 4 },
    { x: u * 9, y: u * 9, color: YELLOW, show: true },
  ];

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x="0" y="0" width="100" height="100" rx="8" fill={CREAM} />

      {yardCorners.map((c, i) =>
        c.show ? (
          <G key={i}>
            <Rect x={c.x} y={c.y} width={u * 6} height={u * 6} rx="5" fill={c.color} />
            <Rect
              x={c.x + u * 1.2}
              y={c.y + u * 1.2}
              width={u * 3.6}
              height={u * 3.6}
              rx="3"
              fill={CREAM}
            />
            <Circle cx={c.x + u * 2.1} cy={c.y + u * 2.1} r={u * 0.62} fill={c.color} />
            <Circle cx={c.x + u * 3.9} cy={c.y + u * 2.1} r={u * 0.62} fill={c.color} />
            <Circle cx={c.x + u * 2.1} cy={c.y + u * 3.9} r={u * 0.62} fill={c.color} />
            <Circle cx={c.x + u * 3.9} cy={c.y + u * 3.9} r={u * 0.62} fill={c.color} />
          </G>
        ) : null,
      )}

      {/* Home columns running into the centre. */}
      <Rect x={u * 6} y={u} width={u * 3} height={u * 5} fill={seats === 4 ? GREEN : CREAM} />
      <Rect x={u * 9} y={u * 6} width={u * 5} height={u * 3} fill={YELLOW} />
      <Rect x={u * 6} y={u * 9} width={u * 3} height={u * 5} fill={seats === 4 ? BLUE : CREAM} />
      <Rect x={u} y={u * 6} width={u * 5} height={u * 3} fill={RED} />

      {/* Centre triangles — the finish. */}
      <Path d={`M${u * 6} ${u * 6} L${u * 9} ${u * 6} L${u * 7.5} ${u * 7.5} Z`} fill={seats === 4 ? GREEN : CREAM} />
      <Path d={`M${u * 9} ${u * 6} L${u * 9} ${u * 9} L${u * 7.5} ${u * 7.5} Z`} fill={YELLOW} />
      <Path d={`M${u * 9} ${u * 9} L${u * 6} ${u * 9} L${u * 7.5} ${u * 7.5} Z`} fill={seats === 4 ? BLUE : CREAM} />
      <Path d={`M${u * 6} ${u * 9} L${u * 6} ${u * 6} L${u * 7.5} ${u * 7.5} Z`} fill={RED} />

      <Rect
        x="0.75"
        y="0.75"
        width="98.5"
        height="98.5"
        rx="8"
        fill="none"
        stroke={LINE}
        strokeWidth="1.5"
      />
    </Svg>
  );
}
