---
name: Yalla-clone Expo app
description: Architecture and key decisions for the نبضة mobile app (chat rooms, videos, games).
---

## Key decisions

- **Now full-stack for admin-managed content:** store items + VIP/SVIP tiers + VIP features live in Postgres (api-server `/api`), exposed via OpenAPI-generated hooks; mobile reads them with React Query. Other app data (likes, joined rooms, coins/VIP balance) still AsyncStorage. Admin panel is an IN-APP Expo screen (`app/admin/index.tsx`), not a separate web artifact.
- **Generated client has no `useListX` hooks** — only `getListXQueryOptions()`. Use `useQuery(getListStoreItemsQueryOptions())`. Mutations do have `useCreate/Update/DeleteX` hooks. After admin mutation, invalidate `getListXQueryKey()`.
- **Mobile→API base URL:** `setBaseUrl(\`https://${process.env.EXPO_PUBLIC_DOMAIN}\`)` in root `app/_layout.tsx` (EXPO_PUBLIC_DOMAIN = REPLIT_DEV_DOMAIN). Expo reaches the API cross-origin via absolute URL.
- **No auth system exists.** Admin gating is client-only (`AppUser.isAdmin`, default true); write APIs are unauthenticated and VIP/purchase rules are client-enforced. Acceptable for prototype; real RBAC needs an auth/login system built first.
- **Store/VIP screens are locally dark-themed** (store purple/black, VIP brown/gold) — they do NOT use `useColors()`; the main app is light (primary `#7C5CFC`). Don't assume the dark palette below.
- **Frontend-only original first build:** AsyncStorage for all persistence (now partially superseded above).
- **Dark mode forced:** `userInterfaceStyle: "dark"` in app.json; colors.ts has matching `light` and `dark` keys both set to dark purple palette.
- **Color palette:** primary `#7C3AED`, accent `#F59E0B`, background `#0A0A12`, card `#141426`.
- **Real-time layer = Socket.io on the existing api-server**, NOT Firebase/Supabase. Server attaches Socket.io to an `http.Server` (index.ts) at path **`/api/socket.io`** so the shared mTLS proxy (routes `/api`) forwards WS upgrades. Mobile client connects to `https://${EXPO_PUBLIC_DOMAIN}` with that path, `transports:["websocket"]`. Verified WS upgrade works through the proxy.
- **Chat:** messages persisted to Postgres `messages` table (roomId/userId/userName/userAvatar/text). On `room:join` server emits last 50 as `room:history`; new ones broadcast as `message:new`; presence via `room:presence`. Client hook `hooks/useRoomChat.ts` stores chronological, room screen reverses for the inverted list.
- **Multiplayer trivia is SERVER-AUTHORITATIVE** (`lib/gameSession.ts` + `lib/trivia.ts` on api-server). Server runs the loop (question→reveal→advance), broadcasts synced `game:question {endsAt}`, `game:reveal`, `game:end`; clients only render + submit `game:answer`. Speed-based scoring computed server-side at reveal. Client hook `hooks/useGameSession.ts`; countdown derived from shared `endsAt` timestamp. Questions live on the SERVER now (client `TRIVIA_QUESTIONS` no longer drives gameplay).
- **Inverted FlatList for chat** in `app/room/[id].tsx` — never use scrollToEnd().
- **KeyboardAvoidingView** from `react-native-keyboard-controller` (not RN built-in).
- **NativeTabs** on iOS 26+ with liquid glass; classic BlurView Tabs fallback.

**Why:** Social entertainment apps need dark, rich palettes; AsyncStorage avoids backend complexity for MVP.
**How to apply:** Adding new screens should respect dark palette from colors.ts via useColors() hook.
