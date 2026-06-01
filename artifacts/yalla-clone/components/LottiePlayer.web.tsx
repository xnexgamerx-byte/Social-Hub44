import React from "react";

/**
 * Web no-op: there is no reliable Lottie URL player on web here, and rendering
 * nothing lets GiftMedia fall back to its icon badge. Keeping this separate file
 * means the web bundle never imports lottie-react-native.
 */
export default function LottiePlayer(_props: { url: string; size: number }) {
  return null;
}
