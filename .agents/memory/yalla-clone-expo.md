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
- **Voice rooms are "Agora-ready", not live-audio yet.** Real audio (`react-native-agora`) is a NATIVE module that Expo Go cannot load and Replit's Expo preview is Expo-Go-based — so installing it would break the preview, and Replit only publishes iOS (Expo Launch), not Google Play. Decision (user agreed): build everything EXCEPT audio transport now. The live mic STAGE (who's on mic / who's muted, max 12 seats) syncs over our Socket.io via `lib/roomVoice.ts` (in-memory seats) + events `mic:join`/`mic:leave`/`mic:mute` → broadcast `mic:state`; snapshot sent on `room:join`; `mic:full` when stage maxed. Client hook `hooks/useRoomVoice.ts`. Server token endpoint `GET /api/agora/token?channel&uid` (`routes/agora.ts`, `agora-token` pkg, PUBLISHER role, 1h TTL) returns 503 when `AGORA_APP_ID`/`AGORA_APP_CERTIFICATE` secrets absent. Client bridge `lib/agoraVoice.ts` (`fetchAgoraToken`, `uidFromUserId`) has the native RtcEngine drop-in documented in comments. **How to apply:** to go fully live, prebuild off Expo Go, install react-native-agora, wire it in `agoraVoice.ts` using the existing token + seat state. Do NOT install react-native-agora into the running Expo Go app.
- **Inverted FlatList for chat** in `app/room/[id].tsx` — never use scrollToEnd().
- **KeyboardAvoidingView** from `react-native-keyboard-controller` (not RN built-in).
- **NativeTabs** on iOS 26+ with liquid glass; classic BlurView Tabs fallback.

## Coins economy (SUGO-style)

- **Two currencies:** `coins` (كوينزات, gold) — bought via coin packages, spent on live gifts; `vPoints`/`V` (diamonds, purple) — earned, spent on frames/entrances/etc. Wallet is backend-authoritative (`wallets` table) with a `wallet_transactions` ledger; `lib/wallet.ts` does atomic adjust+ledger. AppContext reads coins/vPoints from the wallet via React Query; `vip` stays local in AsyncStorage.
- **store_items.itemType** drives behavior: `gift` (priced in coins, sent live into rooms), `entrance` (equipped, plays on room join), `frame`/`background`/`symbol`/`recovery` (cosmetic). Gifts/entrances are seeded store items, NOT separate tables.
- **Live gifts + entrances over Socket.io:** client emits `gift:send {roomId,userId,itemId,...}`; server deducts coins, broadcasts `gift:new` + `wallet:update` (or `gift:error`). On `room:join` server broadcasts `room:entrance` using the joiner's equipped entrance. Client hook `hooks/useRoomGifts.ts` + overlays `GiftOverlay`/`EntranceOverlay` (call `onDone(event.key)`), picker `GiftPicker`. `useRoomChat(id, me)` must pass `{userId,userName,userAvatar}` so the server knows who joined.
- **Admin** (`app/admin/index.tsx`) has 5 tabs: store (with itemType selector + mediaUrl), packages (coin packages CRUD), tasks (daily tasks CRUD), VIP tiers, features.
- **CoinPackage.price is a string** ("$9.99") not a number. DailyTask.reward is coins.

## Gotchas (durable)

- [Metro stale resolution after codegen](metro-stale-codegen-cache.md) — Metro caches "module not found" for freshly codegen'd files and persists it across workflow restarts.
- **Seed must be idempotent per item-type, not all-or-nothing.** `seed.ts` originally guarded store_items insert on `count===0`; once frames were seeded, later-added gift/entrance types never inserted. Fix: backfill only itemTypes not already present (`selectDistinct(itemType)` → insert missing). Same trap applies any time you add new seed rows to an already-populated table.

**Why:** Social entertainment apps need dark, rich palettes; AsyncStorage avoids backend complexity for MVP.
**How to apply:** Adding new screens should respect dark palette from colors.ts via useColors() hook.
