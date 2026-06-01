import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { GiftMedia } from "@/components/GiftMedia";
import type { EntranceEvent } from "@/hooks/useRoomGifts";

export function EntranceOverlay({
  event,
  onDone,
}: {
  event: EntranceEvent;
  onDone: (key: string) => void;
}) {
  const slide = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slide.setValue(0);
    glow.setValue(0);
    sweep.setValue(0);

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    glowLoop.start();

    const sweepAnim = Animated.timing(sweep, {
      toValue: 1,
      duration: 1100,
      delay: 350,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    });
    sweepAnim.start();

    const sequence = Animated.sequence([
      Animated.spring(slide, { toValue: 1, useNativeDriver: true, friction: 7, tension: 60 }),
      Animated.delay(2200),
      Animated.timing(slide, {
        toValue: 2,
        duration: 420,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    sequence.start(() => {
      glowLoop.stop();
      onDone(event.key);
    });

    // Stop loops/animations if the user leaves before the entrance finishes.
    return () => {
      glowLoop.stop();
      sweepAnim.stop();
      sequence.stop();
    };
  }, [event.key]);

  const translateX = slide.interpolate({ inputRange: [0, 1, 2], outputRange: [-380, 0, 380] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.8] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-220, 260] });

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        <Animated.View
          style={[styles.glow, { backgroundColor: event.entrance.color, opacity: glowOpacity }]}
        />
        <LinearGradient
          colors={[event.entrance.color, event.entrance.color + "22"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.banner}
        >
          <Animated.View
            style={[styles.sweep, { transform: [{ translateX: sweepX }, { rotate: "18deg" }] }]}
          />
          <View style={[styles.avatarFrame, { borderColor: event.entrance.color }]}>
            {!!event.userAvatar && (
              <Image source={{ uri: event.userAvatar }} style={styles.avatar} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {event.userName}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              دخل بـ {event.entrance.name}
            </Text>
          </View>
          <GiftMedia
            url={event.entrance.mediaUrl}
            size={44}
            color={event.entrance.color}
            icon={event.entrance.icon || "sparkles"}
          />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: "30%",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 40,
  },
  glow: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 40,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 30,
    minWidth: 250,
    maxWidth: "90%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  sweep: {
    position: "absolute",
    top: -20,
    bottom: -20,
    width: 40,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  avatarFrame: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  name: { color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "right" },
  sub: { color: "rgba(255,255,255,0.9)", fontSize: 12, textAlign: "right" },
});
