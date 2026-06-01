import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import type { EntranceEvent } from "@/hooks/useRoomGifts";

export function EntranceOverlay({
  event,
  onDone,
}: {
  event: EntranceEvent;
  onDone: (key: string) => void;
}) {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slide.setValue(0);
    Animated.sequence([
      Animated.timing(slide, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(slide, {
        toValue: 2,
        duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => onDone(event.key));
  }, [event.key]);

  const translateX = slide.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [-340, 0, 340],
  });

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        <LinearGradient
          colors={[event.entrance.color, event.entrance.color + "33"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.banner}
        >
          {!!event.userAvatar && (
            <Image source={{ uri: event.userAvatar }} style={styles.avatar} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{event.userName}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              دخل بـ {event.entrance.name}
            </Text>
          </View>
          {event.entrance.mediaUrl ? (
            <Image source={{ uri: event.entrance.mediaUrl }} style={styles.media} resizeMode="contain" />
          ) : (
            <Ionicons name={(event.entrance.icon as never) || "sparkles"} size={24} color="#fff" />
          )}
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: "32%",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 40,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 30,
    minWidth: 240,
    maxWidth: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: "#fff" },
  media: { width: 40, height: 40 },
  name: { color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "right" },
  sub: { color: "rgba(255,255,255,0.9)", fontSize: 12, textAlign: "right" },
});
