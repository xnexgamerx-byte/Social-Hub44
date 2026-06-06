import colors from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

/**
 * Returns the design tokens for the user's selected theme.
 *
 * The active theme is driven by ThemeContext (persisted to AsyncStorage), so
 * every user can pick between the calm light, dark purple, and luxury palettes.
 * The returned object contains all color tokens for the active palette plus
 * scheme-independent values like `radius`.
 */
export function useColors() {
  const { theme } = useTheme();
  const palette = colors[theme] ?? colors.dark;
  return { ...palette, radius: colors.radius };
}
