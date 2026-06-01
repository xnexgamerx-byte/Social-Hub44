import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import {
  getListStoreItemsQueryOptions,
  type StoreItem,
} from "@workspace/api-client-react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";

const BG = "#13101F";
const CARD = "#1E1830";
const PURPLE = "#7C3AED";
const GOLD = "#F5C242";
const TEXT = "#FFFFFF";
const MUTED = "#9A91B5";

function lighten(hex: string): string {
  return hex + "AA";
}

export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const { user, buyItem, equipItem, isOwned, isEquipped } = useApp();
  const { data, isLoading } = useQuery(getListStoreItemsQueryOptions());
  const items = useMemo(() => (data ?? []).filter((i) => i.active), [data]);

  const categories = useMemo(() => {
    const set: string[] = [];
    for (const it of items) if (!set.includes(it.category)) set.push(it.category);
    return set;
  }, [items]);

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const currentCat = activeCat ?? categories[0] ?? null;

  const sections = useMemo(() => {
    const inCat = items.filter((i) => i.category === currentCat);
    const set: string[] = [];
    for (const it of inCat) if (!set.includes(it.section)) set.push(it.section);
    return set;
  }, [items, currentCat]);

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const currentSection = activeSection ?? sections[0] ?? null;

  const visible = items.filter(
    (i) => i.category === currentCat && i.section === currentSection,
  );

  const [busyId, setBusyId] = useState<number | null>(null);
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  const sectionLabel = (s: string) =>
    s === "svip" ? "SVIP" : s === "vip" ? "VIP" : s;

  const handleBuy = async (item: StoreItem) => {
    if (busyId !== null) return;
    if (item.vipRequired > user.vipLevel) {
      Alert.alert("مطلوب VIP", `هذا العنصر يتطلب مستوى VIP${item.vipRequired}`);
      return;
    }
    setBusyId(item.id);
    const res = await buyItem(item.id);
    setBusyId(null);
    if (!res.ok) Alert.alert("خطأ", res.error ?? "تعذّر إتمام الشراء");
  };

  const handleEquip = async (item: StoreItem) => {
    if (busyId !== null || isEquipped(item.id)) return;
    setBusyId(item.id);
    const res = await equipItem(item.id);
    setBusyId(null);
    if (!res.ok) Alert.alert("خطأ", res.error ?? "تعذّر تجهيز العنصر");
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-forward" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.title}>المتجر</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/vip")}>
          <Ionicons name="diamond" size={20} color={GOLD} />
        </TouchableOpacity>
      </View>

      {/* Coins-first balance bar — recharge is the centerpiece */}
      <View style={styles.walletBar}>
        <TouchableOpacity
          style={styles.coinsPill}
          activeOpacity={0.85}
          onPress={() => router.push("/recharge")}
        >
          <Ionicons name="logo-bitcoin" size={18} color={GOLD} />
          <Text style={styles.coinsText}>{user.coins.toLocaleString()}</Text>
          <View style={styles.addBadge}>
            <Ionicons name="add" size={14} color="#3A2E00" />
          </View>
        </TouchableOpacity>
        <View style={styles.vPill}>
          <Ionicons name="diamond" size={14} color="#A855F7" />
          <Text style={styles.vText}>{user.vPoints.toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catContent}
      >
        {categories.map((cat) => {
          const on = cat === currentCat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => {
                setActiveCat(cat);
                setActiveSection(null);
              }}
              style={[styles.catChip, on && styles.catChipOn]}
            >
              <Text style={[styles.catText, on && styles.catTextOn]}>{cat}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {sections.length > 1 && (
        <View style={styles.sectionRow}>
          {sections.map((s) => {
            const on = s === currentSection;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => setActiveSection(s)}
                style={[styles.sectionTab, on && styles.sectionTabOn]}
              >
                <Text style={[styles.sectionTabText, on && styles.sectionTabTextOn]}>
                  {sectionLabel(s)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PURPLE} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.grid,
            { paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {visible.map((item) => {
            const owned = isOwned(item.id);
            const equipped = isEquipped(item.id);
            const busy = busyId === item.id;
            return (
              <View key={item.id} style={styles.itemCard}>
                <LinearGradient
                  colors={[item.color, lighten(item.color)]}
                  style={styles.itemPreview}
                >
                  {item.mediaUrl ? (
                    <Image
                      source={{ uri: item.mediaUrl }}
                      style={styles.previewMedia}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons name={(item.icon as never) || "gift"} size={42} color="#fff" />
                  )}
                  {item.vipRequired > 0 && (
                    <View style={styles.vipTag}>
                      <Text style={styles.vipTagText}>VIP{item.vipRequired}</Text>
                    </View>
                  )}
                  {equipped && (
                    <View style={styles.equippedTag}>
                      <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                    </View>
                  )}
                </LinearGradient>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.durationDays > 0 && (
                  <Text style={styles.itemDays}>{item.durationDays} أيام</Text>
                )}
                {owned ? (
                  <Pressable
                    style={[styles.buyBtn, equipped ? styles.equippedBtn : styles.equipBtn]}
                    onPress={() => handleEquip(item)}
                    disabled={equipped || busy}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={equipped ? styles.equippedBtnText : styles.equipBtnText}>
                        {equipped ? "مُجهَّز" : "تجهيز"}
                      </Text>
                    )}
                  </Pressable>
                ) : (
                  <Pressable style={styles.buyBtn} onPress={() => handleBuy(item)} disabled={busy}>
                    {busy ? (
                      <ActivityIndicator size="small" color="#3A2E00" />
                    ) : (
                      <>
                        <Ionicons
                          name={item.currency === "coins" ? "logo-bitcoin" : "diamond"}
                          size={12}
                          color="#3A2E00"
                        />
                        <Text style={styles.buyBtnText}>{item.price.toLocaleString()}</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            );
          })}
          {visible.length === 0 && (
            <Text style={styles.empty}>لا توجد عناصر في هذا القسم</Text>
          )}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.recharge, { bottom: (Platform.OS === "web" ? 20 : insets.bottom) + 16 }]}
        onPress={() => router.push("/recharge")}
      >
        <Ionicons name="flash" size={18} color="#fff" />
        <Text style={styles.rechargeText}>شحن كوينزات</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: TEXT, fontSize: 20, fontWeight: "800" },
  walletBar: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  coinsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2A2140",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: GOLD,
  },
  coinsText: { color: TEXT, fontSize: 15, fontWeight: "800" },
  addBadge: {
    backgroundColor: GOLD,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  vPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: CARD,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  vText: { color: TEXT, fontSize: 13, fontWeight: "700" },
  catScroll: { maxHeight: 52, flexGrow: 0 },
  catContent: { paddingHorizontal: 16, gap: 10, alignItems: "center" },
  catChip: {
    backgroundColor: CARD,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    height: 36,
    justifyContent: "center",
  },
  catChipOn: { backgroundColor: PURPLE },
  catText: { color: MUTED, fontSize: 13, fontWeight: "600" },
  catTextOn: { color: "#fff" },
  sectionRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginVertical: 8 },
  sectionTab: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#2E2640",
  },
  sectionTabOn: { backgroundColor: "#2E2640", borderColor: GOLD },
  sectionTabText: { color: MUTED, fontSize: 13, fontWeight: "700" },
  sectionTabTextOn: { color: GOLD },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 12,
    justifyContent: "flex-start",
  },
  itemCard: {
    width: "30%",
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 8,
    alignItems: "center",
  },
  itemPreview: {
    width: "100%",
    height: 84,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    overflow: "hidden",
  },
  previewMedia: { width: "100%", height: "100%" },
  vipTag: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vipTagText: { color: GOLD, fontSize: 9, fontWeight: "800" },
  equippedTag: { position: "absolute", top: 6, left: 6 },
  itemName: { color: TEXT, fontSize: 12, fontWeight: "700", textAlign: "center" },
  itemDays: { color: MUTED, fontSize: 10, marginTop: 2 },
  buyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 8,
    minWidth: 64,
    minHeight: 26,
  },
  buyBtnText: { color: "#3A2E00", fontSize: 12, fontWeight: "800" },
  equipBtn: { backgroundColor: PURPLE },
  equipBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  equippedBtn: { backgroundColor: "#2E2640" },
  equippedBtnText: { color: "#22C55E", fontSize: 11, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: MUTED, fontSize: 14, textAlign: "center", width: "100%", marginTop: 40 },
  recharge: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: PURPLE,
    borderRadius: 26,
    paddingHorizontal: 32,
    paddingVertical: 12,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  rechargeText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
