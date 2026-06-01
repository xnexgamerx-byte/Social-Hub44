import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { getListStoreItemsQueryOptions } from "@workspace/api-client-react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CARD = "#1E1830";
const PURPLE = "#7C3AED";
const GOLD = "#F5C242";
const TEXT = "#FFFFFF";
const MUTED = "#9A91B5";

export interface GiftItem {
  id: number;
  name: string;
  color: string;
  icon: string;
  price: number;
}

export function GiftPicker({
  visible,
  coins,
  onClose,
  onSend,
}: {
  visible: boolean;
  coins: number;
  onClose: () => void;
  onSend: (item: GiftItem) => void;
}) {
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useQuery(getListStoreItemsQueryOptions());
  const gifts = useMemo(
    () =>
      (data ?? [])
        .filter((i) => i.active && i.itemType === "gift")
        .sort((a, b) => a.price - b.price),
    [data],
  );

  const [selected, setSelected] = useState<number | null>(null);
  const selectedGift = gifts.find((g) => g.id === selected);
  const canSend = selectedGift && coins >= selectedGift.price;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>الهدايا</Text>
          <View style={styles.coinsPill}>
            <Ionicons name="logo-bitcoin" size={14} color={GOLD} />
            <Text style={styles.coinsText}>{coins.toLocaleString()}</Text>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator color={PURPLE} style={{ marginVertical: 30 }} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 280 }}
          >
            {gifts.map((g) => {
              const on = selected === g.id;
              const affordable = coins >= g.price;
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.giftCard, on && styles.giftCardOn, !affordable && styles.giftCardDim]}
                  onPress={() => setSelected(g.id)}
                >
                  <LinearGradient colors={[g.color, g.color + "55"]} style={styles.giftIcon}>
                    {g.mediaUrl ? (
                      <Image source={{ uri: g.mediaUrl }} style={styles.giftMedia} resizeMode="contain" />
                    ) : (
                      <Ionicons name={(g.icon as never) || "gift"} size={30} color="#fff" />
                    )}
                  </LinearGradient>
                  <Text style={styles.giftName} numberOfLines={1}>{g.name}</Text>
                  <View style={styles.priceRow}>
                    <Ionicons name="logo-bitcoin" size={11} color={GOLD} />
                    <Text style={styles.priceText}>{g.price.toLocaleString()}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {gifts.length === 0 && (
              <Text style={styles.empty}>لا توجد هدايا متاحة</Text>
            )}
          </ScrollView>
        )}

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.rechargeLink}
            onPress={() => {
              onClose();
              router.push("/recharge");
            }}
          >
            <Ionicons name="add-circle" size={18} color={GOLD} />
            <Text style={styles.rechargeText}>شحن</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            disabled={!canSend}
            onPress={() => selectedGift && onSend(selectedGift)}
          >
            <Text style={[styles.sendText, !canSend && { color: MUTED }]}>
              {selectedGift && !canSend ? "رصيد غير كافٍ" : "إرسال"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: "#161221",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3A3350",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { color: TEXT, fontSize: 17, fontWeight: "800" },
  coinsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: CARD,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  coinsText: { color: TEXT, fontSize: 13, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "flex-start" },
  giftCard: {
    width: "22%",
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 8,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  giftCardOn: { borderColor: GOLD },
  giftCardDim: { opacity: 0.5 },
  giftIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    overflow: "hidden",
  },
  giftMedia: { width: "100%", height: "100%" },
  giftName: { color: TEXT, fontSize: 11, fontWeight: "600", textAlign: "center" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  priceText: { color: GOLD, fontSize: 11, fontWeight: "800" },
  empty: { color: MUTED, fontSize: 14, textAlign: "center", width: "100%", marginVertical: 30 },
  footer: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  rechargeLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: CARD,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  rechargeText: { color: GOLD, fontSize: 14, fontWeight: "800" },
  sendBtn: {
    flex: 1,
    backgroundColor: PURPLE,
    borderRadius: 22,
    paddingVertical: 12,
    alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: "#2E2640" },
  sendText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
