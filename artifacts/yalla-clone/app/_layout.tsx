import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather, Ionicons } from "@expo/vector-icons";
import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppContextProvider } from "@/context/AppContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { setSocketTokenGetter } from "@/lib/socket";
import { RevenueCatProvider, initializeRevenueCat } from "@/lib/revenuecat";

SplashScreen.preventAutoHideAsync();
initializeRevenueCat();

const apiDomain = process.env.EXPO_PUBLIC_DOMAIN;
if (apiDomain) {
  setBaseUrl(`https://${apiDomain}`);
}

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="room/[id]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="game/[id]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="ludo/[id]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="dm/[id]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen name="room-create" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="profile-edit" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="store" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="recharge" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="tasks" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="vip" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="games" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="admin/index" options={{ headerShown: false, presentation: "card" }} />
    </Stack>
  );
}

// Gates the whole app behind authentication: unauthenticated users are pushed to
// the sign-in flow, authenticated users out of the auth group land in the app.
// Also wires the verified Clerk token into the API client and socket transport.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    setSocketTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    // Wait until the root navigator has mounted (navState.key exists) before
    // navigating, otherwise expo-router has no route tree to handle the action
    // and throws "REPLACE ... was not handled by any navigator".
    if (!navState?.key || !isLoaded) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [navState?.key, isLoaded, isSignedIn, segments, router]);

  if (!isLoaded) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Ionicons.font,
    ...Feather.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
      proxyUrl={proxyUrl}
    >
      <ClerkLoaded>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <RevenueCatProvider>
                <ThemeProvider>
                  <AppContextProvider>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <KeyboardProvider>
                        <AuthGate>
                          <RootLayoutNav />
                        </AuthGate>
                      </KeyboardProvider>
                    </GestureHandlerRootView>
                  </AppContextProvider>
                </ThemeProvider>
              </RevenueCatProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
