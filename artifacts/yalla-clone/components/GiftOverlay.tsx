import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import type { GiftEvent } from "@/hooks/useRoomGifts";

export function GiftOverlay({
  event,
  onDone,
}: {
  event: GiftEvent;
  onDone: (key: string) => void;
}) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scale.setValue(0);
    opacity.setValue(0);
    float.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(1400),
      Animated.parallel([
        Animated.timing(float, {
          toValue: 1,
          duration: 500,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start(() => onDone(event.key));
  }, [event.key]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -60] });

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }, { translateY }] }]}>
        {event.gift.mediaUrl ? (
          <Image source={{ uri: event.gift.mediaUrl }} style={styles.media} resizeMode="contain" />
        ) : (
          <LinearGradient
            colors={[event.gift.color, event.gift.color + "55"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
          >
            <Ionicons name={(event.gift.icon as never) || "gift"} size={56} color="#fff" />
          </LinearGradient>
        )}
        <View style={styles.row}>
          {!!event.fromAvatar && <Image source={{ uri: event.fromAvatar }} style={styles.avatar} />}
          <Text style={styles.from}>{event.fromName}</Text>
        </View>
        <Text style={styles.giftName}>
          أرسل {event.gift.name}
          {event.toName ? ` إلى ${event.toName}` : ""}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  card: { alignItems: "center", gap: 10 },
  media: { width: 140, height: 140 },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: "#F5C242" },
  from: { color: "#fff", fontSize: 15, fontWeight: "800" },
  giftName: {
    color: "#F5C242",
    fontSize: 14,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    overflow: "hidden",
  },
});
