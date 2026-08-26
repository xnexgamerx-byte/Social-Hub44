import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import colors, { type ThemeName } from "@/constants/colors";

const STORAGE_KEY = "themeName";
const DEFAULT_THEME: ThemeName = "dark";

export interface ThemeOption {
  name: ThemeName;
  label: string;
  description: string;
  swatch: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    name: "light",
    label: "فاتح",
    description: "خلفية هادئة وبطاقات بيضاء — أوضح للقراءة نهاراً",
    swatch: "#7C5CF0",
  },
  {
    name: "dark",
    label: "بنفسجي داكن",
    description: "المظهر الأساسي للتطبيق",
    swatch: "#8B6DF5",
  },
  {
    name: "luxury",
    label: "فخامة ذهبية",
    description: "أسود فاخر مع لمسات ذهبية",
    swatch: "#D4AF37",
  },
];

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  ready: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && saved && saved in colors) {
          setThemeState(saved as ThemeName);
        }
      } catch {
        // ignore — fall back to the default theme
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = (next: ThemeName) => {
    setThemeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const value = useMemo(() => ({ theme, setTheme, ready }), [theme, ready]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
