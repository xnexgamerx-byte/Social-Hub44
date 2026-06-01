import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import {
  getListCoinPackagesQueryKey,
  getListCoinPackagesQueryOptions,
  getListDailyTasksQueryKey,
  getListDailyTasksQueryOptions,
  getListStoreItemsQueryKey,
  getListStoreItemsQueryOptions,
  getListVipFeaturesQueryKey,
  getListVipFeaturesQueryOptions,
  getListVipTiersQueryKey,
  getListVipTiersQueryOptions,
  useCreateCoinPackage,
  useCreateDailyTask,
  useCreateStoreItem,
  useCreateVipFeature,
  useDeleteCoinPackage,
  useDeleteDailyTask,
  useDeleteStoreItem,
  useDeleteVipFeature,
  useUpdateCoinPackage,
  useUpdateDailyTask,
  useUpdateStoreItem,
  useUpdateVipTier,
  type CoinPackage,
  type DailyTask,
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

type Tab = "store" | "packages" | "tasks" | "tiers" | "features";

type ItemType =
  | "frame"
  | "entrance"
  | "gift"
  | "background"
  | "symbol"
  | "recovery"
  | "other";

const ITEM_TYPE_LABEL: Record<string, string> = {
  frame: "إطار",
  gift: "هدية",
  entrance: "دخولية",
  background: "خلفية",
  symbol: "رمز",
  recovery: "استرجاع",
  other: "أخرى",
};

const ITEM_TYPES: { k: ItemType; l: string }[] = [
  { k: "frame", l: "إطار" },
  { k: "gift", l: "هدية" },
  { k: "entrance", l: "دخولية" },
  { k: "background", l: "خلفية" },
  { k: "symbol", l: "رمز" },
  { k: "recovery", l: "استرجاع" },
  { k: "other", l: "أخرى" },
];

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
          { k: "packages" as const, l: "الباقات" },
          { k: "tasks" as const, l: "المهام" },
          { k: "tiers" as const, l: "VIP" },
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
      {tab === "packages" && <CoinPackagesAdmin />}
      {tab === "tasks" && <DailyTasksAdmin />}
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

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("إطارات");
  const [price, setPrice] = useState("1000");
  const [color, setColor] = useState("#7C3AED");
  const [icon, setIcon] = useState("gift");
  const [vip, setVip] = useState("0");
  const [itemType, setItemType] = useState<ItemType>("frame");
  const [mediaUrl, setMediaUrl] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setCategory("إطارات");
    setPrice("1000");
    setColor("#7C3AED");
    setIcon("gift");
    setVip("0");
    setItemType("frame");
    setMediaUrl("");
  };

  const startEdit = (item: StoreItem) => {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category);
    setPrice(String(item.price));
    setColor(item.color);
    setIcon(item.icon);
    setVip(String(item.vipRequired));
    setItemType(
      ITEM_TYPES.some((t) => t.k === item.itemType)
        ? (item.itemType as ItemType)
        : "other",
    );
    setMediaUrl(item.mediaUrl ?? "");
  };

  const submit = () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      category,
      itemType,
      section: Number(vip) >= 8 ? "svip" : "vip",
      mediaUrl: mediaUrl.trim(),
      color,
      icon,
      price: Number(price) || 0,
      currency: itemType === "gift" ? "coins" : "V",
      vipRequired: Number(vip) || 0,
    };
    if (editingId !== null) {
      updateM.mutate({ id: editingId, data: payload }, { onSuccess: resetForm });
    } else {
      createM.mutate(
        {
          data: {
            ...payload,
            imageUrl: "",
            durationDays: itemType === "gift" ? 0 : 3,
            active: true,
            sortOrder: 99,
          },
        },
        { onSuccess: resetForm },
      );
    }
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
        <View style={styles.formHeaderRow}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>
            {editingId !== null ? "تعديل عنصر" : "إضافة عنصر"}
          </Text>
          {editingId !== null && (
            <TouchableOpacity onPress={resetForm}>
              <Text style={[styles.cancelEdit, { color: colors.mutedForeground }]}>إلغاء</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>النوع</Text>
        <View style={styles.typeRow}>
          {ITEM_TYPES.map((t) => {
            const on = itemType === t.k;
            return (
              <TouchableOpacity
                key={t.k}
                onPress={() => setItemType(t.k)}
                style={[
                  styles.typeChip,
                  { borderColor: colors.border },
                  on && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                <Text style={[styles.typeChipText, { color: on ? "#fff" : colors.mutedForeground }]}>
                  {t.l}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Field label="الاسم" value={name} onChange={setName} colors={colors} />
        <Field label="الفئة" value={category} onChange={setCategory} colors={colors} />
        <Field label="رابط الوسائط (اختياري)" value={mediaUrl} onChange={setMediaUrl} colors={colors} />
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
          onPress={submit}
          disabled={createM.isPending || updateM.isPending}
        >
          {createM.isPending || updateM.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addBtnText}>{editingId !== null ? "حفظ التعديل" : "إضافة"}</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        (data ?? []).map((item) => (
          <View
            key={item.id}
            style={[
              styles.listItem,
              { backgroundColor: colors.card },
              editingId === item.id && { borderWidth: 1, borderColor: colors.primary },
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: item.color }]}>
              <Ionicons name={(item.icon as never) || "gift"} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
                {ITEM_TYPE_LABEL[item.itemType] ?? item.itemType} · {item.price} {item.currency} · VIP{item.vipRequired}
              </Text>
            </View>
            <Switch
              value={item.active}
              onValueChange={(v) =>
                updateM.mutate({ id: item.id, data: { active: v } })
              }
            />
            <TouchableOpacity onPress={() => startEdit(item)} style={styles.delBtn}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
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

function CoinPackagesAdmin() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(getListCoinPackagesQueryOptions());
  const invalidate = () => qc.invalidateQueries({ queryKey: getListCoinPackagesQueryKey() });
  const createM = useCreateCoinPackage({ mutation: { onSuccess: invalidate } });
  const updateM = useUpdateCoinPackage({ mutation: { onSuccess: invalidate } });
  const deleteM = useDeleteCoinPackage({ mutation: { onSuccess: invalidate } });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [coins, setCoins] = useState("1000");
  const [bonus, setBonus] = useState("0");
  const [price, setPrice] = useState("9.99");
  const [color, setColor] = useState("#F5C242");
  const [icon, setIcon] = useState("logo-bitcoin");
  const [popular, setPopular] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setCoins("1000");
    setBonus("0");
    setPrice("9.99");
    setColor("#F5C242");
    setIcon("logo-bitcoin");
    setPopular(false);
  };

  const startEdit = (p: CoinPackage) => {
    setEditingId(p.id);
    setName(p.name);
    setCoins(String(p.coins));
    setBonus(String(p.bonus));
    setPrice(p.price);
    setColor(p.color);
    setIcon(p.icon);
    setPopular(p.popular);
  };

  const submit = () => {
    if (!coins.trim()) return;
    const payload = {
      name: name.trim(),
      coins: Number(coins) || 0,
      bonus: Number(bonus) || 0,
      price: price.trim() || "0",
      color,
      icon,
      popular,
    };
    if (editingId !== null) {
      updateM.mutate({ id: editingId, data: payload }, { onSuccess: resetForm });
    } else {
      createM.mutate(
        { data: { ...payload, active: true, sortOrder: 99 } },
        { onSuccess: resetForm },
      );
    }
  };

  const confirmDelete = (p: CoinPackage) => {
    Alert.alert("حذف", `حذف باقة "${p.coins} كوينز"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteM.mutate({ id: p.id }) },
    ]);
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 30 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.formCard, { backgroundColor: colors.card }]}>
        <View style={styles.formHeaderRow}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>
            {editingId !== null ? "تعديل باقة" : "إضافة باقة كوينزات"}
          </Text>
          {editingId !== null && (
            <TouchableOpacity onPress={resetForm}>
              <Text style={[styles.cancelEdit, { color: colors.mutedForeground }]}>إلغاء</Text>
            </TouchableOpacity>
          )}
        </View>
        <Field label="الاسم (اختياري)" value={name} onChange={setName} colors={colors} />
        <View style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Field label="الكوينزات" value={coins} onChange={setCoins} keyboard="numeric" colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="مكافأة" value={bonus} onChange={setBonus} keyboard="numeric" colors={colors} />
          </View>
        </View>
        <View style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Field label="السعر ($)" value={price} onChange={setPrice} colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="اللون" value={color} onChange={setColor} colors={colors} />
          </View>
        </View>
        <Field label="الأيقونة" value={icon} onChange={setIcon} colors={colors} />
        <View style={styles.popularRow}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
            الأكثر شيوعاً
          </Text>
          <Switch value={popular} onValueChange={setPopular} />
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={submit}
          disabled={createM.isPending || updateM.isPending}
        >
          {createM.isPending || updateM.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addBtnText}>{editingId !== null ? "حفظ التعديل" : "إضافة"}</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        (data ?? []).map((p) => (
          <View
            key={p.id}
            style={[
              styles.listItem,
              { backgroundColor: colors.card },
              editingId === p.id && { borderWidth: 1, borderColor: colors.primary },
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: p.color }]}>
              <Ionicons name={(p.icon as never) || "logo-bitcoin"} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, { color: colors.foreground }]}>
                {p.coins.toLocaleString()} كوينز{p.bonus > 0 ? ` +${p.bonus}` : ""}
              </Text>
              <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
                ${p.price}{p.popular ? " · الأكثر شيوعاً" : ""}
              </Text>
            </View>
            <Switch
              value={p.active}
              onValueChange={(v) => updateM.mutate({ id: p.id, data: { active: v } })}
            />
            <TouchableOpacity onPress={() => startEdit(p)} style={styles.delBtn}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDelete(p)} style={styles.delBtn}>
              <Ionicons name="trash-outline" size={20} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function DailyTasksAdmin() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(getListDailyTasksQueryOptions());
  const invalidate = () => qc.invalidateQueries({ queryKey: getListDailyTasksQueryKey() });
  const createM = useCreateDailyTask({ mutation: { onSuccess: invalidate } });
  const updateM = useUpdateDailyTask({ mutation: { onSuccess: invalidate } });
  const deleteM = useDeleteDailyTask({ mutation: { onSuccess: invalidate } });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("100");
  const [color, setColor] = useState("#22C55E");
  const [icon, setIcon] = useState("checkbox");

  const resetForm = () => {
    setEditingId(null);
    setLabel("");
    setDescription("");
    setReward("100");
    setColor("#22C55E");
    setIcon("checkbox");
  };

  const startEdit = (t: DailyTask) => {
    setEditingId(t.id);
    setLabel(t.label);
    setDescription(t.description);
    setReward(String(t.reward));
    setColor(t.color);
    setIcon(t.icon);
  };

  const submit = () => {
    if (!label.trim()) return;
    const payload = {
      label: label.trim(),
      description: description.trim(),
      reward: Number(reward) || 0,
      color,
      icon,
    };
    if (editingId !== null) {
      updateM.mutate({ id: editingId, data: payload }, { onSuccess: resetForm });
    } else {
      createM.mutate(
        { data: { ...payload, active: true, sortOrder: 99 } },
        { onSuccess: resetForm },
      );
    }
  };

  const confirmDelete = (t: DailyTask) => {
    Alert.alert("حذف", `حذف "${t.label}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteM.mutate({ id: t.id }) },
    ]);
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 30 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.formCard, { backgroundColor: colors.card }]}>
        <View style={styles.formHeaderRow}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>
            {editingId !== null ? "تعديل مهمة" : "إضافة مهمة يومية"}
          </Text>
          {editingId !== null && (
            <TouchableOpacity onPress={resetForm}>
              <Text style={[styles.cancelEdit, { color: colors.mutedForeground }]}>إلغاء</Text>
            </TouchableOpacity>
          )}
        </View>
        <Field label="العنوان" value={label} onChange={setLabel} colors={colors} />
        <Field label="الوصف" value={description} onChange={setDescription} colors={colors} />
        <View style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Field label="المكافأة (كوينز)" value={reward} onChange={setReward} keyboard="numeric" colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="اللون" value={color} onChange={setColor} colors={colors} />
          </View>
        </View>
        <Field label="الأيقونة" value={icon} onChange={setIcon} colors={colors} />
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={submit}
          disabled={createM.isPending || updateM.isPending}
        >
          {createM.isPending || updateM.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addBtnText}>{editingId !== null ? "حفظ التعديل" : "إضافة"}</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        (data ?? []).map((t) => (
          <View
            key={t.id}
            style={[
              styles.listItem,
              { backgroundColor: colors.card },
              editingId === t.id && { borderWidth: 1, borderColor: colors.primary },
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: t.color }]}>
              <Ionicons name={(t.icon as never) || "checkbox"} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, { color: colors.foreground }]}>{t.label}</Text>
              <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
                {t.reward} كوينز{t.description ? ` · ${t.description}` : ""}
              </Text>
            </View>
            <Switch
              value={t.active}
              onValueChange={(v) => updateM.mutate({ id: t.id, data: { active: v } })}
            />
            <TouchableOpacity onPress={() => startEdit(t)} style={styles.delBtn}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDelete(t)} style={styles.delBtn}>
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
  formHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cancelEdit: { fontSize: 13, fontWeight: "700" as const },
  popularRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  formTitle: { fontSize: 15, fontWeight: "800" as const, textAlign: "right" },
  field: { marginBottom: 10 },
  fieldRow: { flexDirection: "row", gap: 10 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  typeChip: {
    flexGrow: 1,
    flexBasis: "30%",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  typeChipText: { fontSize: 13, fontWeight: "700" as const },
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
