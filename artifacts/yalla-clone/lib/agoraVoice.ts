/**
 * Agora voice bridge — the client side of the "Agora-ready" voice stage.
 *
 * `fetchAgoraToken` works today (it just calls our server). The real audio
 * transport is added when the app is built natively (outside Expo Go, for the
 * App Store / Play Store), because `react-native-agora` is a native module that
 * Expo Go cannot load.
 *
 * Native drop-in (after `expo prebuild` + installing `react-native-agora`):
 *
 *   import { createAgoraRtcEngine, ChannelProfileType, ClientRoleType } from "react-native-agora";
 *
 *   const { appId, token, uid } = await fetchAgoraToken(roomId, numericUid);
 *   const engine = createAgoraRtcEngine();
 *   engine.initialize({ appId });
 *   engine.enableAudio();
 *   engine.joinChannel(token, roomId, uid, {
 *     channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
 *     clientRoleType: ClientRoleType.ClientRoleBroadcaster, // listener => ClientRoleAudience
 *   });
 *   // mute/unmute -> engine.muteLocalAudioStream(muted)
 *   // leave        -> engine.leaveChannel()
 *
 * The mic seat / mute state is already synced live over our WebSocket
 * (see hooks/useRoomVoice.ts); Agora only adds the actual audio.
 */

export interface AgoraToken {
  appId: string;
  channel: string;
  uid: number;
  token: string;
  expiresAt: number;
}

/**
 * Agora RTC uses a numeric uid. Derive a stable one from our string user id so
 * the same user always maps to the same channel uid.
 */
export function uidFromUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  // Keep it positive and within Agora's 32-bit unsigned range.
  return Math.abs(hash) % 1_000_000_000;
}

export async function fetchAgoraToken(channel: string, uid: number): Promise<AgoraToken> {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const url = `https://${domain}/api/agora/token?channel=${encodeURIComponent(channel)}&uid=${uid}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "تعذّر الحصول على إذن الصوت");
  }
  return (await res.json()) as AgoraToken;
}
