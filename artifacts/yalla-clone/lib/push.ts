import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken } from "@workspace/api-client-react";

/**
 * Remote push is not delivered to Expo Go (SDK 53+), so this is a no-op there.
 * Everything below is ready for the first real build — no further wiring
 * needed once the app ships as its own binary.
 */
const isExpoGo = Constants.executionEnvironment === "storeClient";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Ask for permission and hand this device's Expo push token to the server.
 * Safe to call on every launch: registration is idempotent server-side.
 */
export async function registerForPush(): Promise<void> {
  if (isExpoGo || !Device.isDevice) return;

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
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  if (!token?.data) return;

  await registerPushToken({ token: token.data, platform: Platform.OS });
}
