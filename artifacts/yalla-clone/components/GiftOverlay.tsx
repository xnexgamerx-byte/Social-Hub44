import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { GiftMedia } from "@/components/GiftMedia";
import { giftTier, type GiftTier } from "@/lib/giftTier";
import type { GiftEvent } from "@/hooks/useRoomGifts";

const MAX_PARTICLES = 30;

interface Particle {
  angle: number;
  distance: number;
  size: number;
  delay: number;
  color: string;
}

function buildParticles(count: number, colors: string[]): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      angle: (Math.PI * 2 * i) / count + Math.random() * 0.5,
      distance: 90 + Math.random() * 150,
      size: 6 + Math.random() * 10,
      delay: Math.random() * 180,
      color: colors[i % colors.length],
    });
  }
  return out;
}

export function GiftOverlay({
  event,
  onDone,
}: {
  event: GiftEvent;
  onDone: (key: string) => void;
}) {
  const tier: GiftTier = giftTier(event.gift.price);
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  const particles = useMemo(
    () => buildParticles(tier.particles, tier.colors),
    [event.key],
  );
  // Fixed-size pool sized to the largest tier so the value array length never
  // depends on the current event's particle count (avoids undefined access when
  // a bigger gift follows a smaller one). We only drive the first N.
  const partVals = useRef(
    Array.from({ length: MAX_PARTICLES }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    scale.setValue(0);
    opacity.setValue(0);
    float.setValue(0);
    scrim.setValue(0);
    burst.setValue(0);
    ring.setValue(0);
    spin.setValue(0);
    partVals.forEach((v) => v.setValue(0));

    const enter = Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 80 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(scrim, {
        toValue: tier.scrim,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(burst, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Only drive the particles this tier actually shows; the rest stay at 0.
      ...partVals.slice(0, particles.length).map((v, i) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 950,
          delay: particles[i]?.delay ?? 0,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    ]);

    const ringLoop = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    if (tier.rings) ringLoop.start();

    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    if (tier.spin) spinLoop.start();

    const sequence = Animated.sequence([
      enter,
      Animated.delay(tier.hold),
      Animated.parallel([
        Animated.timing(float, {
          toValue: 1,
          duration: 520,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 0, duration: 520, useNativeDriver: true }),
        Animated.timing(scrim, { toValue: 0, duration: 520, useNativeDriver: true }),
      ]),
    ]);
    sequence.start(() => {
      ringLoop.stop();
      spinLoop.stop();
      onDone(event.key);
    });

    // Stop every loop/sequence if the component unmounts mid-effect (e.g. the
    // user leaves the room) so no animation keeps running in the background.
    return () => {
      sequence.stop();
      ringLoop.stop();
      spinLoop.stop();
    };
  }, [event.key]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -70] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.4] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View
        style={[styles.scrim, { opacity: scrim, backgroundColor: tier.scrimColor }]}
      />

      {tier.rings && (
        <Animated.View
          style={[
            styles.ring,
            {
              borderColor: tier.colors[0],
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />
      )}

      {particles.map((p, i) => {
        const v = partVals[i];
        const tx = v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(p.angle) * p.distance],
        });
        const ty = v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(p.angle) * p.distance],
        });
        const pOpacity = v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
        const pScale = v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0.4] });
        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: p.color,
                opacity: pOpacity,
                transform: [{ translateX: tx }, { translateY: ty }, { scale: pScale }],
              },
            ]}
          />
        );
      })}

      <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
        <Animated.View style={{ transform: [{ scale }, { rotate }] }}>
          <GiftMedia
            url={event.gift.mediaUrl}
            size={tier.size}
            color={event.gift.color}
            icon={event.gift.icon}
          />
        </Animated.View>
        <View style={styles.row}>
          {!!event.fromAvatar && <Image source={{ uri: event.fromAvatar }} style={styles.avatar} />}
          <Text style={styles.from}>{event.fromName}</Text>
        </View>
        <Text style={[styles.giftName, { color: tier.colors[0] }]}>
          أرسل {event.gift.name}
          {event.toName ? ` إلى ${event.toName}` : ""}
        </Text>
        {tier.label ? (
          <Text style={[styles.tierLabel, { backgroundColor: tier.colors[0] }]}>{tier.label}</Text>
        ) : null}
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
  scrim: { ...StyleSheet.absoluteFillObject },
  ring: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
  },
  particle: { position: "absolute" },
  card: { alignItems: "center", gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: "#F5C242" },
  from: { color: "#fff", fontSize: 15, fontWeight: "800" },
  giftName: {
    fontSize: 14,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    overflow: "hidden",
  },
  tierLabel: {
    color: "#1a1a1a",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: "hidden",
  },
});
