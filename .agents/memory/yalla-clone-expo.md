---
name: Yalla-clone Expo app
description: Architecture and key decisions for the نبضة mobile app (chat rooms, videos, games).
---

## Key decisions

- **Frontend-only first build:** no backend, no OpenAPI, AsyncStorage for all persistence.
- **Dark mode forced:** `userInterfaceStyle: "dark"` in app.json; colors.ts has matching `light` and `dark` keys both set to dark purple palette.
- **Color palette:** primary `#7C3AED`, accent `#F59E0B`, background `#0A0A12`, card `#141426`.
- **Inverted FlatList for chat** in `app/room/[id].tsx` — never use scrollToEnd().
- **KeyboardAvoidingView** from `react-native-keyboard-controller` (not RN built-in).
- **NativeTabs** on iOS 26+ with liquid glass; classic BlurView Tabs fallback.

**Why:** Social entertainment apps need dark, rich palettes; AsyncStorage avoids backend complexity for MVP.
**How to apply:** Adding new screens should respect dark palette from colors.ts via useColors() hook.
