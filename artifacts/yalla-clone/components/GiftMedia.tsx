import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import React from "react";
import { Platform, StyleSheet } from "react-native";
import LottiePlayer from "@/components/LottiePlayer";

const VIDEO_EXT = /\.(mp4|mov|m4v|webm)(\?.*)?$/i;
const LOTTIE_EXT = /\.(json|lottie)(\?.*)?$/i;

export type MediaKind = "video" | "lottie" | "image" | "none";

export function mediaKind(url: string | undefined): MediaKind {
  if (!url) return "none";
  if (VIDEO_EXT.test(url)) return "video";
  if (LOTTIE_EXT.test(url)) return "lottie";
  return "image";
}

/**
 * Renders a gift/entrance centerpiece from its mediaUrl. Premium items can point
 * mediaUrl at a video (.mp4/.webm) for a full motion effect, or an animated
 * image (GIF/WebP). Anything else falls back to a colored icon badge so every
 * gift still shows something. Lottie URLs render via their image preview path
 * unless a native Lottie player is added later.
 */
export function GiftMedia({
  url,
  size,
  color,
  icon,
}: {
  url: string | undefined;
  size: number;
  color: string;
  icon?: string;
}) {
  const kind = mediaKind(url);
  const isNative = Platform.OS !== "web";
  // expo-video is a native module; only drive a player when we actually have a
  // video URL so non-video gifts never spin one up.
  const isVideo = kind === "video" && isNative;
  const player = useVideoPlayer(isVideo ? (url as string) : null, (p) => {
    p.loop = true;
    p.muted = true;
    if (isVideo) p.play();
  });

  if (isVideo) {
    return (
      <VideoView
        player={player}
        style={{ width: size, height: size }}
        contentFit="contain"
        nativeControls={false}
        pointerEvents="none"
      />
    );
  }

  // Lottie (.json/.lottie) plays through the native Lottie player. Web has no
  // reliable player here, so it falls through to the icon badge below.
  if (kind === "lottie" && isNative) {
    return <LottiePlayer url={url as string} size={size} />;
  }

  if (kind === "image") {
    return (
      <ExpoImage
        source={{ uri: url }}
        style={{ width: size, height: size }}
        contentFit="contain"
        autoplay
      />
    );
  }

  return (
    <LinearGradient
      colors={[color, color + "55"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.iconCircle,
        { width: size * 0.8, height: size * 0.8, borderRadius: size * 0.4 },
      ]}
    >
      <Ionicons name={(icon as never) || "gift"} size={size * 0.42} color="#fff" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
});
