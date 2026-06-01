import LottieView from "lottie-react-native";
import React from "react";

/**
 * Native Lottie player. Web uses LottiePlayer.web.tsx (a no-op) so the web
 * bundle never pulls in lottie-react-native's browser build.
 */
export default function LottiePlayer({ url, size }: { url: string; size: number }) {
  return (
    <LottieView
      source={{ uri: url }}
      style={{ width: size, height: size }}
      autoPlay
      loop
    />
  );
}
