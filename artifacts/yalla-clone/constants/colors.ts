/**
 * Palettes are tuned against the SUGO reference screens.
 *
 * Two surfaces recur there: utility screens (settings, account, profile) sit
 * on a neutral light ground with pure-white cards, while the screens that sell
 * something (store, levels, entrance effects) go deep purple. Both palettes
 * below carry the same violet accent so the app reads as one product whichever
 * ground a screen uses.
 */

// Neutral light ground with a violet accent — the settings/profile surface.
const lightPalette = {
  text: "#1A1A1F",
  tint: "#7C5CF0",
  // Slightly cool grey so pure-white cards lift off it without a border.
  background: "#F2F2F6",
  foreground: "#1A1A1F",
  card: "#FFFFFF",
  cardForeground: "#1A1A1F",
  primary: "#7C5CF0",
  primaryForeground: "#FFFFFF",
  secondary: "#EDE9FD",
  secondaryForeground: "#5B3FD6",
  // Also the "off" track of a switch, so it must stay visible on white.
  muted: "#DFDFE6",
  mutedForeground: "#84848F",
  accent: "#F0447E",
  accentForeground: "#FFFFFF",
  destructive: "#E5484D",
  destructiveForeground: "#FFFFFF",
  border: "#E6E6EC",
  input: "#F2F2F6",
};

// Deep violet — the app's signature, and the ground the store and level
// screens use. Less saturated than a pure indigo so gold and pink accents
// stay legible on top.
const darkPalette = {
  text: "#F2EEFF",
  tint: "#8B6DF5",
  background: "#120C22",
  foreground: "#F2EEFF",
  card: "#1E1636",
  cardForeground: "#F2EEFF",
  primary: "#8B6DF5",
  primaryForeground: "#FFFFFF",
  secondary: "rgba(139,109,245,0.16)",
  secondaryForeground: "#C4B0FF",
  muted: "rgba(255,255,255,0.09)",
  mutedForeground: "rgba(203,191,236,0.62)",
  accent: "#FF6B9D",
  accentForeground: "#FFFFFF",
  destructive: "#F0575C",
  destructiveForeground: "#FFFFFF",
  border: "rgba(160,130,255,0.16)",
  input: "rgba(255,255,255,0.07)",
};

// Near-black with warm gold — for users who want the high-roller look.
const luxuryPalette = {
  text: "#F5ECD8",
  tint: "#D4AF37",
  background: "#0B0A08",
  foreground: "#F5ECD8",
  card: "#191612",
  cardForeground: "#F5ECD8",
  primary: "#D4AF37",
  primaryForeground: "#1A1505",
  secondary: "rgba(212,175,55,0.14)",
  secondaryForeground: "#E5C97B",
  muted: "rgba(255,255,255,0.08)",
  mutedForeground: "rgba(229,201,123,0.58)",
  accent: "#C9A227",
  accentForeground: "#1A1505",
  destructive: "#E5484D",
  destructiveForeground: "#FFFFFF",
  border: "rgba(212,175,55,0.18)",
  input: "rgba(255,255,255,0.06)",
};

export type Palette = typeof darkPalette;
export type ThemeName = "light" | "dark" | "luxury";

const colors = {
  light: lightPalette,
  dark: darkPalette,
  luxury: luxuryPalette,
  radius: 16,
};

export default colors;
