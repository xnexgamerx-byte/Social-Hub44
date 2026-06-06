// Calm white / pink — soft, airy light theme.
const lightPalette = {
  text: "#3D2B3E",
  tint: "#EC4899",
  background: "#FFF5F9",
  foreground: "#3D2B3E",
  card: "#FFFFFF",
  cardForeground: "#3D2B3E",
  primary: "#EC4899",
  primaryForeground: "#FFFFFF",
  secondary: "#FFE4F1",
  secondaryForeground: "#D6336C",
  muted: "#FCE7F0",
  mutedForeground: "#A67C90",
  accent: "#F472B6",
  accentForeground: "#FFFFFF",
  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",
  border: "#FBD9E8",
  input: "#FCE7F0",
};

// Current dark purple — the app's signature look.
const darkPalette = {
  text: "#F0EEFF",
  tint: "#8B5CF6",
  background: "#0D0320",
  foreground: "#F0EEFF",
  card: "#1C0B3E",
  cardForeground: "#F0EEFF",
  primary: "#8B5CF6",
  primaryForeground: "#FFFFFF",
  secondary: "rgba(255,255,255,0.08)",
  secondaryForeground: "#C4B5FD",
  muted: "rgba(255,255,255,0.06)",
  mutedForeground: "rgba(200,180,255,0.55)",
  accent: "#FF6B9D",
  accentForeground: "#FFFFFF",
  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",
  border: "rgba(180,140,255,0.15)",
  input: "rgba(255,255,255,0.06)",
};

// Luxury dark — near-black with warm gold accents.
const luxuryPalette = {
  text: "#F5ECD8",
  tint: "#D4AF37",
  background: "#0A0A0B",
  foreground: "#F5ECD8",
  card: "#16140F",
  cardForeground: "#F5ECD8",
  primary: "#D4AF37",
  primaryForeground: "#1A1505",
  secondary: "rgba(212,175,55,0.12)",
  secondaryForeground: "#E5C97B",
  muted: "rgba(255,255,255,0.05)",
  mutedForeground: "rgba(229,201,123,0.55)",
  accent: "#C9A227",
  accentForeground: "#1A1505",
  destructive: "#E5484D",
  destructiveForeground: "#FFFFFF",
  border: "rgba(212,175,55,0.18)",
  input: "rgba(255,255,255,0.05)",
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
