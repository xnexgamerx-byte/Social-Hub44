import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import {
  getListStoreItemsQueryKey,
  getListStoreItemsQueryOptions,
  getListVipFeaturesQueryKey,
  getListVipFeaturesQueryOptions,
  getListVipTiersQueryKey,
  getListVipTiersQueryOptions,
  useCreateStoreItem,
  useCreateVipFeature,
  useDeleteStoreItem,
  useDeleteVipFeature,
  useUpdateStoreItem,
  useUpdateVipTier,
  type StoreItem,
  type VipFeature,
  type VipTier,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

type Tab = "store" | "tiers" | "features";

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const [tab, setTab] = useState<Tab>("store");

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>لوحة التحكم</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.secondary }]}>
        {([
          { k: "store" as const, l: "المتجر" },
          { k: "tiers" as const, l: "مستويات VIP" },
          { k: "features" as const, l: "المميزات" },
        ]).map((t) => {
          const on = tab === t.k;
          return (
            <TouchableOpacity
              key={t.k}
              onPress={() => setTab(t.k)}
              style={[styles.tab, on && { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.tabText, { color: on ? "#fff" : colors.mutedForeground }]}>
                {t.l}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === "store" && <StoreAdmin />}
      {tab === "tiers" && <TiersAdmin />}
      {tab === "features" && <FeaturesAdmin />}
    </View>
  );
}

function StoreAdmin() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(getListStoreItemsQueryOptions());
  const invalidate = () => qc.invalidateQueries({ queryKey: getListStoreItemsQueryKey() });
  const createM = useCreateStoreItem({ mutation: { onSuccess: invalidate } });
  const updateM = useUpdateStoreItem({ mutation: { onSuccess: invalidate } });
  const deleteM = useDeleteStoreItem({ mutation: { onSuccess: invalidate } });

  const [name, setName] = useState("");
  const [category, setCategory] = useState("إطارات");
  const [price, setPrice] = useState("1000");
  const [color, setColor] = useState("#7C3AED");
  const [icon, setIcon] = useState("gift");
  const [vip, setVip] = useState("0");

  const add = () => {
    if (!name.trim()) return;
    createM.mutate({
      data: {
        name: name.trim(),
        category,
        section: Number(vip) >= 8 ? "svip" : "vip",
        imageUrl: "",
        color,
        icon,
        price: Number(price) || 0,
        currency: "V",
        vipRequired: Number(vip) || 0,
        durationDays: 3,
        active: true,
        sortOrder: 99,
      },
    });
    setName("");
  };

  const confirmDelete = (item: StoreItem) => {
    Alert.alert("حذف", `حذف "${item.name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteM.mutate({ id: item.id }) },
    ]);
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 30 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.formCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.formTitle, { color: colors.foreground }]}>إضافة عنصر</Text>
        <Field label="الاسم" value={name} onChange={setName} colors={colors} />
        <Field label="الفئة" value={category} onChange={setCategory} colors={colors} />
        <View style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Field label="السعر" value={price} onChange={setPrice} keyboard="numeric" colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="VIP مطلوب" value={vip} onChange={setVip} keyboard="numeric" colors={colors} />
          </View>
        </View>
        <View style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Field label="اللون" value={color} onChange={setColor} colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="الأيقونة" value={icon} onChange={setIcon} colors={colors} />
          </View>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={add}
          disabled={createM.isPending}
        >
          {createM.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addBtnText}>إضافة</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        (data ?? []).map((item) => (
          <View key={item.id} style={[styles.listItem, { backgroundColor: colors.card }]}>
            <View style={[styles.swatch, { backgroundColor: item.color }]}>
              <Ionicons name={(item.icon as never) || "gift"} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
                {item.category} · {item.price} · VIP{item.vipRequired}
              </Text>
            </View>
            <Switch
              value={item.active}
              onValueChange={(v) =>
                updateM.mutate({ id: item.id, data: { active: v } })
              }
            />
            <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.delBtn}>
              <Ionicons name="trash-outline" size={20} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function TiersAdmin() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(getListVipTiersQueryOptions());
  const updateM = useUpdateVipTier({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListVipTiersQueryKey() }) },
  });

  const tiers = (data ?? []).slice().sort((a, b) => {
    if (a.type !== b.type) return a.type === "vip" ? -1 : 1;
    return a.level - b.level;
  });

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 30 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        فعّل أو عطّل المستويات وعدّل النقاط المطلوبة
      </Text>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        tiers.map((t: VipTier) => (
          <TierRow key={t.id} tier={t} colors={colors} updateM={updateM} />
        ))
      )}
    </ScrollView>
  );
}

function TierRow({
  tier,
  colors,
  updateM,
}: {
  tier: VipTier;
  colors: ReturnType<typeof useColors>;
  updateM: ReturnType<typeof useUpdateVipTier>;
}) {
  const [points, setPoints] = useState(String(tier.pointsRequired));
  return (
    <View style={[styles.listItem, { backgroundColor: colors.card }]}>
      <View style={[styles.swatch, { backgroundColor: tier.color }]}>
        <Text style={styles.swatchTxt}>{tier.level}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemName, { color: colors.foreground }]}>
          {tier.type === "svip" ? "SVIP" : "VIP"} {tier.level}
        </Text>
        <View style={styles.inlineRow}>
          <TextInput
            value={points}
            onChangeText={setPoints}
            keyboardType="numeric"
            style={[styles.inlineInput, { color: colors.foreground, borderColor: colors.border }]}
            onBlur={() =>
              updateM.mutate({
                id: tier.id,
                data: { pointsRequired: Number(points) || 0 },
              })
            }
          />
          <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
            {tier.features.length} ميزة
          </Text>
        </View>
      </View>
      <Switch
        value={tier.active}
        onValueChange={(v) => updateM.mutate({ id: tier.id, data: { active: v } })}
      />
    </View>
  );
}

function FeaturesAdmin() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(getListVipFeaturesQueryOptions());
  const invalidate = () => qc.invalidateQueries({ queryKey: getListVipFeaturesQueryKey() });
  const createM = useCreateVipFeature({ mutation: { onSuccess: invalidate } });
  const deleteM = useDeleteVipFeature({ mutation: { onSuccess: invalidate } });

  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("star");

  const add = () => {
    if (!key.trim() || !label.trim()) return;
    createM.mutate({
      data: {
        key: key.trim(),
        label: label.trim(),
        description: "",
        icon: icon.trim() || "star",
        sortOrder: 99,
      },
    });
    setKey("");
    setLabel("");
  };

  const confirmDelete = (f: VipFeature) => {
    Alert.alert("حذف", `حذف "${f.label}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteM.mutate({ id: f.id }) },
    ]);
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 30 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.formCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.formTitle, { color: colors.foreground }]}>إضافة ميزة</Text>
        <Field label="المفتاح (key)" value={key} onChange={setKey} colors={colors} />
        <Field label="الاسم" value={label} onChange={setLabel} colors={colors} />
        <Field label="الأيقونة" value={icon} onChange={setIcon} colors={colors} />
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={add}
          disabled={createM.isPending}
        >
          {createM.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addBtnText}>إضافة</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        (data ?? []).map((f) => (
          <View key={f.id} style={[styles.listItem, { backgroundColor: colors.card }]}>
            <View style={[styles.swatch, { backgroundColor: colors.primary }]}>
              <Ionicons name={(f.icon as never) || "star"} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, { color: colors.foreground }]}>{f.label}</Text>
              <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>{f.key}</Text>
            </View>
            <TouchableOpacity onPress={() => confirmDelete(f)} style={styles.delBtn}>
              <Ionicons name="trash-outline" size={20} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboard,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboard?: "numeric";
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
        placeholderTextColor={colors.mutedForeground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 19, fontWeight: "800" as const },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10 },
  tabText: { fontSize: 13, fontWeight: "700" as const },
  formCard: { marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 16 },
  formTitle: { fontSize: 15, fontWeight: "800" as const, marginBottom: 12, textAlign: "right" },
  field: { marginBottom: 10 },
  fieldRow: { flexDirection: "row", gap: 10 },
  fieldLabel: { fontSize: 12, marginBottom: 4, textAlign: "right" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    textAlign: "right",
  },
  addBtn: { borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 6 },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" as const },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchTxt: { color: "#fff", fontSize: 15, fontWeight: "800" as const },
  itemName: { fontSize: 14, fontWeight: "700" as const, textAlign: "right" },
  itemMeta: { fontSize: 12, marginTop: 2, textAlign: "right" },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  inlineInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    minWidth: 110,
    textAlign: "right",
  },
  delBtn: { padding: 6 },
  note: { fontSize: 12, textAlign: "center", marginBottom: 12, paddingHorizontal: 20 },
});
