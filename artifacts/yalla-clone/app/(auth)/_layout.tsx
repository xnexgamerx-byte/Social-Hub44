import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import React from "react";

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}
