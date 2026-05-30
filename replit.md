# نبضة - دردشة وترفيه

تطبيق موبايل اجتماعي عربي يشمل غرف الدردشة الصوتية، الفيديوهات، والألعاب — مشابه ليلا وسوغو.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **Mobile:** Expo (React Native) + Expo Router
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- State: AsyncStorage (local), React Context, React Query

## Where things live

- `artifacts/yalla-clone/` — Expo mobile app (نبضة)
  - `app/(tabs)/` — main tab screens (index, rooms, videos, games, profile)
  - `app/room/[id].tsx` — voice/text chat room detail screen
  - `app/game/[id].tsx` — trivia game screen
  - `components/` — RoomCard, VideoCard, GameCard, UserAvatar, LiveBadge
  - `context/AppContext.tsx` — global user & app state
  - `data/mockData.ts` — mock rooms, videos, games, trivia questions
  - `constants/colors.ts` — dark purple theme (#7C3AED primary, #F59E0B accent)
- `artifacts/api-server/` — Express API server

## Architecture decisions

- Frontend-only for first build: all data stored locally via AsyncStorage + mock data
- Forced dark mode (userInterfaceStyle: "dark") — fits social entertainment aesthetic
- Inverted FlatList for chat messages — avoids scrollToEnd() timing bugs
- KeyboardAvoidingView from react-native-keyboard-controller for reliable keyboard handling
- NativeTabs (liquid glass) on iOS 26+, classic BlurView Tabs on older devices

## Product

- **الرئيسية (Home):** Discovery feed — live rooms, trending videos, games
- **الغرف (Rooms):** Voice/text chat rooms with speaker grid and category filters
- **فيديوهات (Videos):** Grid view + TikTok-style vertical feed mode
- **الألعاب (Games):** Social game lobby + fully working trivia game
- **ملفي (Profile):** User profile, stats, settings

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Do NOT use 'uuid' package in Expo — use Date.now().toString() + Math.random() instead
- react-native-maps must be pinned to exactly 1.18.0 for Expo Go compatibility
- NativeTabs cannot use custom brand colors — liquid glass is system-level on iOS 26+

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
