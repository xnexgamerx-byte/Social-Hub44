import Constants from "expo-constants";
import { PermissionsAndroid, Platform } from "react-native";
import { customFetch } from "@workspace/api-client-react";

/**
 * Real voice transport.
 *
 * The mic seats, mute state and speaker list are already synced over our own
 * WebSocket (see `hooks/useRoomVoice.ts`); Agora only carries the audio.
 *
 * `react-native-agora` is a native module, so it is imported lazily and only
 * outside Expo Go — touching it there throws. Everything below activates on
 * the first real build with no further wiring, provided AGORA_APP_ID and
 * AGORA_APP_CERTIFICATE are set on the server.
 */

const isExpoGo = Constants.executionEnvironment === "storeClient";

export interface AgoraToken {
  appId: string;
  channel: string;
  uid: number;
  token: string;
  expiresAt: number;
}

/** True when real audio can run in this build. */
export function isVoiceAvailable(): boolean {
  return !isExpoGo;
}

/**
 * Agora uids are 32-bit unsigned integers, but ours are Clerk strings, so
 * derive a stable numeric id. Collisions inside one room would make two people
 * share an audio slot, hence a 31-bit spread rather than something narrow.
 */
export function numericUid(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  // Keep it inside 1..2^31-1; 0 tells Agora to assign one itself.
  return (hash % 2147483646) + 1;
}

export async function fetchAgoraToken(
  channel: string,
  uid: number,
): Promise<AgoraToken> {
  return customFetch<AgoraToken>(
    `/agora/token?channel=${encodeURIComponent(channel)}&uid=${uid}`,
    { method: "GET" },
  );
}

/**
 * Ask for the microphone at runtime. Declaring RECORD_AUDIO in the manifest
 * only makes it requestable — on Android 6+ the user must grant it or the mic
 * silently records nothing, which looks exactly like "voice is broken".
 */
export async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const granted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  );
  if (granted) return true;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: "إذن الميكروفون",
      message: "نحتاج إذن الميكروفون للتحدث في الغرف الصوتية.",
      buttonPositive: "السماح",
      buttonNegative: "لاحقاً",
    },
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

type Engine = {
  initialize: (config: { appId: string }) => void;
  enableAudio: () => void;
  joinChannel: (
    token: string,
    channel: string,
    uid: number,
    options: Record<string, unknown>,
  ) => void;
  muteLocalAudioStream: (muted: boolean) => void;
  setClientRole: (role: number) => void;
  leaveChannel: () => void;
  release: () => void;
};

/** Distinguishes a real voice failure from an unsupported environment. */
export class VoiceError extends Error {}

let engine: Engine | null = null;
let joinedChannel: string | null = null;

/**
 * Join a room's audio channel. `speaking` decides whether this device
 * publishes audio (on a mic seat) or only listens.
 */
export async function joinVoiceChannel(
  roomId: string,
  userId: string,
  speaking: boolean,
): Promise<void> {
  if (isExpoGo) return;
  // Listeners need no microphone, so only ask when actually publishing.
  if (speaking && !(await ensureMicPermission())) {
    throw new VoiceError("لم يُسمح بالوصول إلى الميكروفون");
  }
  const uid = numericUid(userId);
  const { appId, token } = await fetchAgoraToken(roomId, uid);

  const agora = (await import("react-native-agora")) as unknown as {
    createAgoraRtcEngine: () => Engine;
    ChannelProfileType: { ChannelProfileLiveBroadcasting: number };
    ClientRoleType: { ClientRoleBroadcaster: number; ClientRoleAudience: number };
  };

  if (!engine) {
    engine = agora.createAgoraRtcEngine();
    engine.initialize({ appId });
    engine.enableAudio();
  }
  if (joinedChannel && joinedChannel !== roomId) {
    engine.leaveChannel();
  }
  engine.joinChannel(token, roomId, uid, {
    channelProfile: agora.ChannelProfileType.ChannelProfileLiveBroadcasting,
    clientRoleType: speaking
      ? agora.ClientRoleType.ClientRoleBroadcaster
      : agora.ClientRoleType.ClientRoleAudience,
    publishMicrophoneTrack: speaking,
    autoSubscribeAudio: true,
  });
  joinedChannel = roomId;
}

/** Switch between speaking on a mic seat and listening only. */
export async function setVoiceSpeaking(speaking: boolean): Promise<void> {
  if (isExpoGo || !engine) return;
  // Promoting to speaker without the grant yields a live seat that transmits
  // silence — the exact symptom of "the mic does not work".
  if (speaking && !(await ensureMicPermission())) {
    throw new VoiceError("لم يُسمح بالوصول إلى الميكروفون");
  }
  const agora = (await import("react-native-agora")) as unknown as {
    ClientRoleType: { ClientRoleBroadcaster: number; ClientRoleAudience: number };
  };
  engine.setClientRole(
    speaking
      ? agora.ClientRoleType.ClientRoleBroadcaster
      : agora.ClientRoleType.ClientRoleAudience,
  );
  engine.muteLocalAudioStream(!speaking);
}

/** Mute or unmute the outgoing microphone. */
export function setVoiceMuted(muted: boolean): void {
  if (isExpoGo || !engine) return;
  engine.muteLocalAudioStream(muted);
}

/** Leave the channel and release the engine. */
export function leaveVoiceChannel(): void {
  if (isExpoGo || !engine) return;
  engine.leaveChannel();
  engine.release();
  engine = null;
  joinedChannel = null;
}
