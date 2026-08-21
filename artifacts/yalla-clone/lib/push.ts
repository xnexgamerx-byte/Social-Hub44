import Constants from "expo-constants";
import { Platform } from "react-native";
import { registerPushToken } from "@workspace/api-client-react";

/**
 * Remote push was removed from Expo Go in SDK 53, and merely touching the
 * native module there logs a hard error. So expo-notifications is imported
 * lazily, *after* the environment check — nothing at module scope may reach
 * for it. Everything below activates untouched on the first real build.
 */
const isExpoGo = Constants.executionEnvironment === "storeClient";

/**
 * Ask for permission and hand this device's Expo push token to the server.
 * Safe to call on every launch: registration is idempotent server-side.
 */
export async function registerForPush(): Promise<void> {
  if (isExpoGo) return;

  const [Notifications, Device] = await Promise.all([
    import("expo-notifications"),
    import("expo-device"),
  ]);
  if (!Device.isDevice) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "الإشعارات",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const asked = await Notifications.requestPermissionsAsync();
    granted = asked.granted;
  }
  if (!granted) return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  if (!token?.data) return;

  await registerPushToken({ token: token.data, platform: Platform.OS });
}
