import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  getListAdminsQueryKey,
  getListAdminsQueryOptions,
  getListAdminAuditQueryKey,
  getListAdminAuditQueryOptions,
  useCreateAdmin,
  useCreateCoinPackage,
  useCreateDailyTask,
  useCreateStoreItem,
  useCreateVipFeature,
  useDeleteAdmin,
  useDeleteCoinPackage,
  useDeleteDailyTask,
  useDeleteStoreItem,
  useDeleteVipFeature,
  useUpdateCoinPackage,
  useUpdateDailyTask,
  useUpdateStoreItem,
  useUpdateVipTier,
  type Admin,
  type AdminAuditEvent,
  type CoinPackage,
  type DailyTask,
  type StoreItem,
  type VipFeature,
  type VipTier,
} from "@workspace/api-client-react";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const BG = "#0D0320";
const CARD = "#1C0B3E";
const CARD2 = "#241550";
const PURPLE = "#8B5CF6";
const GOLD = "#F5C242";
const BORDER = "rgba(180,140,255,0.18)";
const MUTED = "rgba(200,180,255,0.55)";
const TEXT = "#F0EEFF";
const GREEN = "#22C55E";
const RED = "#EF4444";

const COLOR_PALETTE = [
  "#8B5CF6", "#7C3AED", "#6D28D9", "#A855F7", "#C084FC",
  "#EC4899", "#F472B6", "#FF6B9D",
  "#3B82F6", "#60A5FA", "#0EA5E9", "#06B6D4",
  "#22C55E", "#4ADE80",
  "#F5C242", "#F59E0B", "#FF7A00",
  "#EF4444", "#374151", "#1C0B3E",
];

const ICON_OPTIONS: { name: string; label: string }[] = [
  { name: "gift", label: "هدية" },
  { name: "trophy", label: "كأس" },
  { name: "star", label: "نجمة" },
  { name: "diamond", label: "ماسة" },
  { name: "rocket", label: "صاروخ" },
  { name: "heart", label: "قلب" },
  { name: "flame", label: "نار" },
  { name: "flash", label: "برق" },
  { name: "shield-checkmark", label: "درع" },
  { name: "ribbon", label: "وسام" },
  { name: "medal", label: "ميدالية" },
  { name: "game-controller", label: "ألعاب" },
  { name: "musical-notes", label: "موسيقى" },
  { name: "film", label: "فيلم" },
  { name: "camera", label: "كاميرا" },
  { name: "people", label: "مجموعة" },
  { name: "chatbubbles", label: "دردشة" },
  { name: "logo-bitcoin", label: "كوينز" },
  { name: "wallet", label: "محفظة" },
  { name: "card", label: "بطاقة" },
  { name: "checkbox", label: "مهمة" },
  { name: "checkmark-circle", label: "تأكيد" },
  { name: "add-circle", label: "إضافة" },
  { name: "time", label: "وقت" },
  { name: "crown", label: "تاج" },
  { name: "sparkles", label: "تألق" },
  { name: "storefront", label: "متجر" },
  { name: "eye", label: "زيارة" },
];

type Tab = "store" | "packages" | "tasks" | "tiers" | "features" | "notifications" | "admins";
type ItemType = "frame" | "entrance" | "gift" | "background" | "symbol" | "recovery" | "other";
type AdminRole = "owner" | "admin" | "moderator" | "editor";
type NotifTarget = "all" | "vip" | "admins";

const ITEM_TYPE_LABEL: Record<string, string> = {
  frame: "إطار", gift: "هدية", entrance: "دخولية",
  background: "خلفية", symbol: "رمز", recovery: "استرجاع", other: "أخرى",
};
const ITEM_TYPES: { k: ItemType; l: string }[] = [
  { k: "frame", l: "إطار" }, { k: "gift", l: "هدية" }, { k: "entrance", l: "دخولية" },
  { k: "background", l: "خلفية" }, { k: "symbol", l: "رمز" }, { k: "recovery", l: "استرجاع" },
  { k: "other", l: "أخرى" },
];
const ADMIN_ROLES: { k: AdminRole; l: string; icon: string; color: string }[] = [
  { k: "owner", l: "مالك", icon: "crown", color: "#F5C242" },
  { k: "admin", l: "مشرف", icon: "shield-checkmark", color: "#8B5CF6" },
  { k: "moderator", l: "مراقب", icon: "eye", color: "#06B6D4" },
  { k: "editor", l: "محرر", icon: "create", color: "#22C55E" },
];

const TAB_ITEMS: { k: Tab; l: string; icon: string }[] = [
  { k: "store", l: "المتجر", icon: "storefront" },
  { k: "packages", l: "الباقات", icon: "logo-bitcoin" },
  { k: "tasks", l: "المهام", icon: "checkbox" },
  { k: "tiers", l: "VIP", icon: "diamond" },
  { k: "features", l: "المميزات", icon: "star" },
  { k: "notifications", l: "الإشعارات", icon: "notifications" },
  { k: "admins", l: "المشرفون", icon: "shield-checkmark" },
];

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const [tab, setTab] = useState<Tab>("store");
  const { isAdmin, isAdminLoading } = useApp();

  useEffect(() => {
    if (!isAdminLoading && !isAdmin) router.replace("/(tabs)");
  }, [isAdmin, isAdminLoading]);

  if (isAdminLoading) {
    return (
      <View style={[S.screen, S.center]}>
        <ActivityIndicator color={PURPLE} size="large" />
      </View>
    );
  }
  if (!isAdmin) return <View style={S.screen} />;

  return (
    <View style={[S.screen, { paddingTop: topPad }]}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.iconBtn}>
          <Ionicons name="chevron-forward" size={22} color={TEXT} />
        </TouchableOpacity>
        <View style={S.headerCenter}>
          <Ionicons name="construct" size={18} color={PURPLE} />
          <Text style={S.headerTitle}>لوحة التحكم</Text>
        </View>
        <View style={S.iconBtn} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={S.tabBar}
        contentContainerStyle={S.tabBarContent}
      >
        {TAB_ITEMS.map((t) => {
          const on = tab === t.k;
          return (
            <TouchableOpacity
              key={t.k}
              onPress={() => setTab(t.k)}
              style={[S.tabItem, on && S.tabItemOn]}
              activeOpacity={0.8}
            >
              <Ionicons name={t.icon as never} size={16} color={on ? "#fff" : MUTED} />
              <Text style={[S.tabLabel, on && S.tabLabelOn]}>{t.l}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tab === "store" && <StoreAdmin />}
      {tab === "packages" && <CoinPackagesAdmin />}
      {tab === "tasks" && <DailyTasksAdmin />}
      {tab === "tiers" && <TiersAdmin />}
      {tab === "features" && <FeaturesAdmin />}
      {tab === "notifications" && <NotificationsAdmin />}
      {tab === "admins" && <AdminsAdmin />}
    </View>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={S.pickerSection}>
      <Text style={S.pickerLabel}>اللون</Text>
      <View style={S.colorGrid}>
        {COLOR_PALETTE.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => onChange(c)}
            style={[
              S.colorSwatch,
              { backgroundColor: c },
              value === c && S.colorSwatchSelected,
            ]}
            activeOpacity={0.8}
          >
            {value === c && <Ionicons name="checkmark" size={14} color="#fff" />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function IconPicker({ value, onChange, color }: { value: string; onChange: (i: string) => void; color: string }) {
  return (
    <View style={S.pickerSection}>
      <Text style={S.pickerLabel}>الأيقونة</Text>
      <View style={S.iconGrid}>
        {ICON_OPTIONS.map((opt) => {
          const on = value === opt.name;
          return (
            <TouchableOpacity
              key={opt.name}
              onPress={() => onChange(opt.name)}
              style={[S.iconCell, on && { backgroundColor: color + "33", borderColor: color }]}
              activeOpacity={0.8}
            >
              <Ionicons name={opt.name as never} size={22} color={on ? color : MUTED} />
              <Text style={[S.iconCellLabel, on && { color: color }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function MediaUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("إذن مطلوب", "يجب منح إذن الوصول إلى المكتبة.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      setUploading(true);
      onChange(result.assets[0].uri);
      setUploading(false);
    }
  };

  return (
    <View style={S.pickerSection}>
      <Text style={S.pickerLabel}>الوسائط</Text>
      <TouchableOpacity style={S.mediaBtn} onPress={pick} activeOpacity={0.8}>
        {uploading ? (
          <ActivityIndicator color={PURPLE} />
        ) : (
          <>
            <Ionicons name="cloud-upload" size={20} color={PURPLE} />
            <Text style={S.mediaBtnText}>رفع من الاستوديو</Text>
          </>
        )}
      </TouchableOpacity>
      {!!value && (
        <View style={S.mediaPreview}>
          {value.startsWith("http") || value.startsWith("file") ? (
            <Image source={{ uri: value }} style={S.mediaImg} resizeMode="cover" />
          ) : null}
          <Text style={S.mediaUrl} numberOfLines={1}>{value}</Text>
          <TouchableOpacity onPress={() => onChange("")} style={S.mediaClear}>
            <Ionicons name="close-circle" size={18} color={RED} />
          </TouchableOpacity>
        </View>
      )}
      <Text style={S.mediaOrLabel}>— أو أدخل رابطاً —</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="https://..."
        placeholderTextColor={MUTED}
        style={S.inputDark}
      />
    </View>
  );
}

function Field({
  label, value, onChange, keyboard, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  keyboard?: "numeric"; placeholder?: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={S.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        placeholder={placeholder ?? ""}
        placeholderTextColor={MUTED}
        style={S.inputDark}
      />
    </View>
  );
}

function SectionCard({ title, action, onAction, children }: {
  title: string; action?: string; onAction?: () => void; children: React.ReactNode;
}) {
  return (
    <View style={S.sectionCard}>
      <View style={S.sectionCardHeader}>
        <Text style={S.sectionCardTitle}>{title}</Text>
        {action && (
          <TouchableOpacity onPress={onAction}>
            <Text style={S.sectionCardAction}>{action}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

function StoreAdmin() {
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
  const [color, setColor] = useState("#8B5CF6");
  const [icon, setIcon] = useState("gift");
  const [vip, setVip] = useState("0");
  const [itemType, setItemType] = useState<ItemType>("frame");
  const [mediaUrl, setMediaUrl] = useState("");

  const resetForm = () => {
    setEditingId(null); setName(""); setCategory("إطارات"); setPrice("1000");
    setColor("#8B5CF6"); setIcon("gift"); setVip("0"); setItemType("frame"); setMediaUrl("");
  };

  const startEdit = (item: StoreItem) => {
    setEditingId(item.id); setName(item.name); setCategory(item.category);
    setPrice(String(item.price)); setColor(item.color); setIcon(item.icon);
    setVip(String(item.vipRequired));
    setItemType(ITEM_TYPES.some((t) => t.k === item.itemType) ? item.itemType as ItemType : "other");
    setMediaUrl(item.mediaUrl ?? "");
  };

  const submit = () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(), category, itemType,
      section: Number(vip) >= 8 ? "svip" : "vip",
      mediaUrl: mediaUrl.trim(), color, icon,
      price: Number(price) || 0,
      currency: itemType === "gift" ? "coins" : "V",
      vipRequired: Number(vip) || 0,
    };
    if (editingId !== null) {
      updateM.mutate({ id: editingId, data: payload }, { onSuccess: resetForm });
    } else {
      createM.mutate({ data: { ...payload, imageUrl: "", durationDays: itemType === "gift" ? 0 : 3, active: true, sortOrder: 99 } }, { onSuccess: resetForm });
    }
  };

  const confirmDelete = (item: StoreItem) => {
    Alert.alert("حذف", `حذف "${item.name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteM.mutate({ id: item.id }) },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 40 }} showsVerticalScrollIndicator={false}>
      <SectionCard title={editingId !== null ? "تعديل عنصر" : "عنصر جديد"} action={editingId !== null ? "إلغاء" : undefined} onAction={resetForm}>
        <Text style={S.fieldLabel}>النوع</Text>
        <View style={S.chipRow}>
          {ITEM_TYPES.map((t) => (
            <TouchableOpacity key={t.k} onPress={() => setItemType(t.k)} style={[S.chip, itemType === t.k && S.chipOn]} activeOpacity={0.8}>
              <Text style={[S.chipText, itemType === t.k && S.chipTextOn]}>{t.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Field label="الاسم" value={name} onChange={setName} />
        <Field label="الفئة" value={category} onChange={setCategory} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="السعر" value={price} onChange={setPrice} keyboard="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="VIP مطلوب" value={vip} onChange={setVip} keyboard="numeric" />
          </View>
        </View>
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker value={icon} onChange={setIcon} color={color} />
        <MediaUploader value={mediaUrl} onChange={setMediaUrl} />
        <TouchableOpacity style={S.submitBtn} onPress={submit} disabled={createM.isPending || updateM.isPending} activeOpacity={0.85}>
          {createM.isPending || updateM.isPending ? <ActivityIndicator color="#fff" /> : (
            <Text style={S.submitBtnText}>{editingId !== null ? "حفظ التعديل" : "إضافة للمتجر"}</Text>
          )}
        </TouchableOpacity>
      </SectionCard>

      <Text style={S.listHeader}>العناصر الحالية</Text>
      {isLoading ? <ActivityIndicator color={PURPLE} style={{ marginTop: 20 }} /> : ((data ?? []) as StoreItem[]).map((item) => (
        <View key={item.id} style={[S.listRow, editingId === item.id && S.listRowSelected]}>
          <View style={[S.listIcon, { backgroundColor: item.color }]}>
            <Ionicons name={(item.icon as never) || "gift"} size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.listName}>{item.name}</Text>
            <Text style={S.listMeta}>{ITEM_TYPE_LABEL[item.itemType] ?? item.itemType} · {item.price} {item.currency} · VIP{item.vipRequired}</Text>
          </View>
          <Switch
            value={item.active}
            onValueChange={(v) => updateM.mutate({ id: item.id, data: { active: v } })}
            trackColor={{ true: PURPLE }}
            thumbColor="#fff"
          />
          <TouchableOpacity onPress={() => startEdit(item)} style={S.rowBtn}>
            <Ionicons name="create-outline" size={19} color={PURPLE} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => confirmDelete(item)} style={S.rowBtn}>
            <Ionicons name="trash-outline" size={19} color={RED} />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

function CoinPackagesAdmin() {
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
  const [productId, setProductId] = useState("");
  const [color, setColor] = useState("#F5C242");
  const [icon, setIcon] = useState("logo-bitcoin");
  const [popular, setPopular] = useState(false);

  const resetForm = () => {
    setEditingId(null); setName(""); setCoins("1000"); setBonus("0");
    setPrice("9.99"); setProductId(""); setColor("#F5C242"); setIcon("logo-bitcoin"); setPopular(false);
  };

  const startEdit = (p: CoinPackage) => {
    setEditingId(p.id); setName(p.name); setCoins(String(p.coins));
    setBonus(String(p.bonus)); setPrice(p.price); setProductId(p.productId);
    setColor(p.color); setIcon(p.icon); setPopular(p.popular);
  };

  const submit = () => {
    const payload = { name: name.trim(), coins: Number(coins) || 0, bonus: Number(bonus) || 0, price: price.trim() || "0", productId: productId.trim(), color, icon, popular };
    if (editingId !== null) {
      updateM.mutate({ id: editingId, data: payload }, { onSuccess: resetForm });
    } else {
      createM.mutate({ data: { ...payload, active: true, sortOrder: 99 } }, { onSuccess: resetForm });
    }
  };

  const confirmDelete = (p: CoinPackage) => {
    Alert.alert("حذف", `حذف باقة "${p.coins} كوينز"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteM.mutate({ id: p.id }) },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 40 }} showsVerticalScrollIndicator={false}>
      <SectionCard title={editingId !== null ? "تعديل باقة" : "باقة كوينزات جديدة"} action={editingId !== null ? "إلغاء" : undefined} onAction={resetForm}>
        <Field label="الاسم" value={name} onChange={setName} placeholder="اختياري" />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}><Field label="الكوينزات" value={coins} onChange={setCoins} keyboard="numeric" /></View>
          <View style={{ flex: 1 }}><Field label="مكافأة" value={bonus} onChange={setBonus} keyboard="numeric" /></View>
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}><Field label="السعر ($)" value={price} onChange={setPrice} /></View>
          <View style={{ flex: 1 }}><Field label="معرّف RevenueCat" value={productId} onChange={setProductId} /></View>
        </View>
        <View style={[S.switchRow, { marginBottom: 12 }]}>
          <Text style={S.fieldLabel}>الأكثر شيوعاً</Text>
          <Switch value={popular} onValueChange={setPopular} trackColor={{ true: GOLD }} thumbColor="#fff" />
        </View>
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker value={icon} onChange={setIcon} color={color} />
        <TouchableOpacity style={S.submitBtn} onPress={submit} disabled={createM.isPending || updateM.isPending} activeOpacity={0.85}>
          {createM.isPending || updateM.isPending ? <ActivityIndicator color="#fff" /> : (
            <Text style={S.submitBtnText}>{editingId !== null ? "حفظ التعديل" : "إضافة باقة"}</Text>
          )}
        </TouchableOpacity>
      </SectionCard>

      <Text style={S.listHeader}>الباقات الحالية</Text>
      {isLoading ? <ActivityIndicator color={PURPLE} style={{ marginTop: 20 }} /> : ((data ?? []) as CoinPackage[]).map((p) => (
        <View key={p.id} style={[S.listRow, editingId === p.id && S.listRowSelected]}>
          <View style={[S.listIcon, { backgroundColor: p.color }]}>
            <Ionicons name={(p.icon as never) || "logo-bitcoin"} size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.listName}>{p.coins.toLocaleString()} كوينز{p.bonus > 0 ? ` +${p.bonus}` : ""}</Text>
            <Text style={S.listMeta}>${p.price}{p.popular ? " · ⭐ الأكثر شيوعاً" : ""}</Text>
          </View>
          <Switch value={p.active} onValueChange={(v) => updateM.mutate({ id: p.id, data: { active: v } })} trackColor={{ true: PURPLE }} thumbColor="#fff" />
          <TouchableOpacity onPress={() => startEdit(p)} style={S.rowBtn}><Ionicons name="create-outline" size={19} color={PURPLE} /></TouchableOpacity>
          <TouchableOpacity onPress={() => confirmDelete(p)} style={S.rowBtn}><Ionicons name="trash-outline" size={19} color={RED} /></TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

function DailyTasksAdmin() {
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

  const resetForm = () => { setEditingId(null); setLabel(""); setDescription(""); setReward("100"); setColor("#22C55E"); setIcon("checkbox"); };
  const startEdit = (t: DailyTask) => { setEditingId(t.id); setLabel(t.label); setDescription(t.description); setReward(String(t.reward)); setColor(t.color); setIcon(t.icon); };

  const submit = () => {
    if (!label.trim()) return;
    const payload = { label: label.trim(), description: description.trim(), reward: Number(reward) || 0, color, icon };
    if (editingId !== null) {
      updateM.mutate({ id: editingId, data: payload }, { onSuccess: resetForm });
    } else {
      createM.mutate({ data: { ...payload, active: true, sortOrder: 99 } }, { onSuccess: resetForm });
    }
  };

  const confirmDelete = (t: DailyTask) => {
    Alert.alert("حذف", `حذف "${t.label}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteM.mutate({ id: t.id }) },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 40 }} showsVerticalScrollIndicator={false}>
      <SectionCard title={editingId !== null ? "تعديل مهمة" : "مهمة يومية جديدة"} action={editingId !== null ? "إلغاء" : undefined} onAction={resetForm}>
        <Field label="العنوان" value={label} onChange={setLabel} />
        <Field label="الوصف" value={description} onChange={setDescription} />
        <Field label="المكافأة (كوينز)" value={reward} onChange={setReward} keyboard="numeric" />
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker value={icon} onChange={setIcon} color={color} />
        <TouchableOpacity style={S.submitBtn} onPress={submit} disabled={createM.isPending || updateM.isPending} activeOpacity={0.85}>
          {createM.isPending || updateM.isPending ? <ActivityIndicator color="#fff" /> : (
            <Text style={S.submitBtnText}>{editingId !== null ? "حفظ التعديل" : "إضافة مهمة"}</Text>
          )}
        </TouchableOpacity>
      </SectionCard>

      <Text style={S.listHeader}>المهام الحالية</Text>
      {isLoading ? <ActivityIndicator color={PURPLE} style={{ marginTop: 20 }} /> : ((data ?? []) as DailyTask[]).map((t) => (
        <View key={t.id} style={[S.listRow, editingId === t.id && S.listRowSelected]}>
          <View style={[S.listIcon, { backgroundColor: t.color }]}>
            <Ionicons name={(t.icon as never) || "checkbox"} size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.listName}>{t.label}</Text>
            <Text style={S.listMeta}>{t.reward} كوينز{t.description ? ` · ${t.description}` : ""}</Text>
          </View>
          <Switch value={t.active} onValueChange={(v) => updateM.mutate({ id: t.id, data: { active: v } })} trackColor={{ true: PURPLE }} thumbColor="#fff" />
          <TouchableOpacity onPress={() => startEdit(t)} style={S.rowBtn}><Ionicons name="create-outline" size={19} color={PURPLE} /></TouchableOpacity>
          <TouchableOpacity onPress={() => confirmDelete(t)} style={S.rowBtn}><Ionicons name="trash-outline" size={19} color={RED} /></TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

function TiersAdmin() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(getListVipTiersQueryOptions());
  const updateM = useUpdateVipTier({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListVipTiersQueryKey() }) } });
  const tiers = ((data ?? []) as VipTier[]).slice().sort((a, b) => a.type !== b.type ? (a.type === "vip" ? -1 : 1) : a.level - b.level);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 40 }} showsVerticalScrollIndicator={false}>
      <View style={S.infoBox}>
        <Ionicons name="information-circle" size={16} color={PURPLE} />
        <Text style={S.infoText}>فعّل أو عطّل المستويات وعدّل النقاط المطلوبة</Text>
      </View>
      {isLoading ? <ActivityIndicator color={PURPLE} style={{ marginTop: 20 }} /> : tiers.map((t: VipTier) => <TierRow key={t.id} tier={t} updateM={updateM} />)}
    </ScrollView>
  );
}

function TierRow({ tier, updateM }: { tier: VipTier; updateM: ReturnType<typeof useUpdateVipTier> }) {
  const [points, setPoints] = useState(String(tier.pointsRequired));
  const isSvip = tier.type === "svip";
  return (
    <View style={S.listRow}>
      <View style={[S.listIcon, { backgroundColor: tier.color }]}>
        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>{tier.level}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={S.listName}>{isSvip ? "SVIP" : "VIP"} {tier.level}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TextInput
            value={points}
            onChangeText={setPoints}
            keyboardType="numeric"
            style={S.inlineInput}
            onBlur={() => updateM.mutate({ id: tier.id, data: { pointsRequired: Number(points) || 0 } })}
          />
          <Text style={S.listMeta}>{tier.features.length} ميزة</Text>
        </View>
      </View>
      <Switch value={tier.active} onValueChange={(v) => updateM.mutate({ id: tier.id, data: { active: v } })} trackColor={{ true: isSvip ? GOLD : PURPLE }} thumbColor="#fff" />
    </View>
  );
}

function FeaturesAdmin() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(getListVipFeaturesQueryOptions());
  const invalidate = () => qc.invalidateQueries({ queryKey: getListVipFeaturesQueryKey() });
  const createM = useCreateVipFeature({ mutation: { onSuccess: invalidate } });
  const deleteM = useDeleteVipFeature({ mutation: { onSuccess: invalidate } });

  const [featureKey, setFeatureKey] = useState("");
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("star");

  const add = () => {
    if (!featureKey.trim() || !label.trim()) return;
    createM.mutate({ data: { key: featureKey.trim(), label: label.trim(), description: "", icon: icon.trim() || "star", sortOrder: 99 } });
    setFeatureKey(""); setLabel("");
  };

  const confirmDelete = (f: VipFeature) => {
    Alert.alert("حذف", `حذف "${f.label}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteM.mutate({ id: f.id }) },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 40 }} showsVerticalScrollIndicator={false}>
      <SectionCard title="إضافة ميزة VIP">
        <Field label="المفتاح (key)" value={featureKey} onChange={setFeatureKey} placeholder="مثال: voice_effects" />
        <Field label="الاسم" value={label} onChange={setLabel} />
        <IconPicker value={icon} onChange={setIcon} color={PURPLE} />
        <TouchableOpacity style={S.submitBtn} onPress={add} disabled={createM.isPending} activeOpacity={0.85}>
          {createM.isPending ? <ActivityIndicator color="#fff" /> : <Text style={S.submitBtnText}>إضافة ميزة</Text>}
        </TouchableOpacity>
      </SectionCard>

      <Text style={S.listHeader}>المميزات الحالية</Text>
      {isLoading ? <ActivityIndicator color={PURPLE} style={{ marginTop: 20 }} /> : ((data ?? []) as VipFeature[]).map((f) => (
        <View key={f.id} style={S.listRow}>
          <View style={[S.listIcon, { backgroundColor: PURPLE }]}>
            <Ionicons name={(f.icon as never) || "star"} size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.listName}>{f.label}</Text>
            <Text style={S.listMeta}>{f.key}</Text>
          </View>
          <TouchableOpacity onPress={() => confirmDelete(f)} style={S.rowBtn}><Ionicons name="trash-outline" size={19} color={RED} /></TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

function NotificationsAdmin() {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<NotifTarget>("all");
  const [urgent, setUrgent] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<{ id: string; title: string; body: string; target: NotifTarget; time: string; }[]>([]);

  const TARGETS: { k: NotifTarget; l: string; icon: string; color: string }[] = [
    { k: "all", l: "الجميع", icon: "people", color: PURPLE },
    { k: "vip", l: "VIP فقط", icon: "diamond", color: GOLD },
    { k: "admins", l: "المشرفون", icon: "shield-checkmark", color: "#06B6D4" },
  ];

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert("تنبيه", "أدخل العنوان والنص.");
      return;
    }
    setSending(true);
    await new Promise((r) => setTimeout(r, 1000));
    const entry = { id: String(Date.now()), title: title.trim(), body: body.trim(), target, time: new Date().toLocaleString("ar") };
    setHistory((prev) => [entry, ...prev]);
    setTitle("");
    setBody("");
    setSending(false);
    Alert.alert("تم الإرسال", `تم إرسال الإشعار إلى: ${TARGETS.find(t => t.k === target)?.l}`);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 40 }} showsVerticalScrollIndicator={false}>
      <SectionCard title="إشعار جديد">
        <Field label="العنوان" value={title} onChange={setTitle} placeholder="عنوان الإشعار" />
        <View style={{ marginBottom: 12 }}>
          <Text style={S.fieldLabel}>النص</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="نص الإشعار..."
            placeholderTextColor={MUTED}
            multiline
            numberOfLines={3}
            style={[S.inputDark, { minHeight: 80, textAlignVertical: "top" }]}
          />
        </View>

        <Text style={S.fieldLabel}>الجمهور المستهدف</Text>
        <View style={S.chipRow}>
          {TARGETS.map((t) => (
            <TouchableOpacity
              key={t.k}
              onPress={() => setTarget(t.k)}
              style={[S.targetChip, target === t.k && { backgroundColor: t.color + "22", borderColor: t.color }]}
              activeOpacity={0.8}
            >
              <Ionicons name={t.icon as never} size={15} color={target === t.k ? t.color : MUTED} />
              <Text style={[S.chipText, target === t.k && { color: t.color }]}>{t.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[S.switchRow, { marginBottom: 16 }]}>
          <View>
            <Text style={S.fieldLabel}>إشعار عاجل</Text>
            <Text style={[S.listMeta, { marginTop: 2 }]}>يظهر فوراً بصوت</Text>
          </View>
          <Switch value={urgent} onValueChange={setUrgent} trackColor={{ true: RED }} thumbColor="#fff" />
        </View>

        <TouchableOpacity style={[S.submitBtn, sending && { opacity: 0.7 }]} onPress={send} disabled={sending} activeOpacity={0.85}>
          {sending ? <ActivityIndicator color="#fff" /> : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={S.submitBtnText}>إرسال الإشعار</Text>
            </View>
          )}
        </TouchableOpacity>
      </SectionCard>

      {history.length > 0 && (
        <>
          <Text style={S.listHeader}>سجل الإشعارات</Text>
          {history.map((h) => {
            const tgt = TARGETS.find((t) => t.k === h.target);
            return (
              <View key={h.id} style={S.listRow}>
                <View style={[S.listIcon, { backgroundColor: tgt?.color ?? PURPLE }]}>
                  <Ionicons name={(tgt?.icon ?? "notifications") as never} size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.listName}>{h.title}</Text>
                  <Text style={S.listMeta} numberOfLines={1}>{h.body}</Text>
                  <Text style={[S.listMeta, { marginTop: 2 }]}>{tgt?.l} · {h.time}</Text>
                </View>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

function AdminsAdmin() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(getListAdminsQueryOptions());
  const { data: audit, isLoading: auditLoading } = useQuery(getListAdminAuditQueryOptions());
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListAdminsQueryKey() });
    qc.invalidateQueries({ queryKey: getListAdminAuditQueryKey() });
  };
  const createM = useCreateAdmin({ mutation: { onSuccess: invalidate } });
  const deleteM = useDeleteAdmin({ mutation: { onSuccess: invalidate } });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("admin");

  const add = () => {
    const e = email.trim().toLowerCase();
    if (!e.includes("@") || e.length < 3) { Alert.alert("خطأ", "أدخل بريداً إلكترونياً صالحاً"); return; }
    createM.mutate({ data: { email: e } }, { onSuccess: () => setEmail(""), onError: (err: unknown) => Alert.alert("تعذّر الإضافة", (err as Error)?.message ?? "حدث خطأ") });
  };

  const confirmDelete = (a: Admin) => {
    Alert.alert("إزالة مشرف", `إزالة صلاحية "${a.email}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "إزالة", style: "destructive", onPress: () => deleteM.mutate({ id: a.id }, { onError: (err: unknown) => Alert.alert("تعذّرت الإزالة", (err as Error)?.message ?? "حدث خطأ") }) },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 40 }} showsVerticalScrollIndicator={false}>
      <SectionCard title="إضافة مشرف">
        <View style={S.infoBox}>
          <Ionicons name="information-circle" size={15} color={PURPLE} />
          <Text style={S.infoText}>أدخل البريد الإلكتروني لمنح صلاحيات الإشراف.</Text>
        </View>
        <Field label="البريد الإلكتروني" value={email} onChange={setEmail} placeholder="admin@example.com" />

        <Text style={S.fieldLabel}>مستوى الصلاحية</Text>
        <View style={S.chipRow}>
          {ADMIN_ROLES.map((r) => (
            <TouchableOpacity
              key={r.k}
              onPress={() => setRole(r.k)}
              style={[S.roleChip, role === r.k && { backgroundColor: r.color + "22", borderColor: r.color }]}
              activeOpacity={0.8}
            >
              <Ionicons name={r.icon as never} size={14} color={role === r.k ? r.color : MUTED} />
              <Text style={[S.chipText, role === r.k && { color: r.color }]}>{r.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[S.roleDescBox, { marginBottom: 12 }]}>
          {role === "owner" && <Text style={S.roleDesc}>👑 وصول كامل لجميع الإعدادات والبيانات.</Text>}
          {role === "admin" && <Text style={S.roleDesc}>🛡️ إدارة المتجر والباقات والمهام والمستخدمين.</Text>}
          {role === "moderator" && <Text style={S.roleDesc}>👁️ مراقبة المحتوى والغرف وتقارير المستخدمين.</Text>}
          {role === "editor" && <Text style={S.roleDesc}>✏️ إضافة وتعديل المحتوى فقط دون الحذف.</Text>}
        </View>

        <TouchableOpacity style={S.submitBtn} onPress={add} disabled={createM.isPending} activeOpacity={0.85}>
          {createM.isPending ? <ActivityIndicator color="#fff" /> : <Text style={S.submitBtnText}>إضافة مشرف</Text>}
        </TouchableOpacity>
      </SectionCard>

      <Text style={S.listHeader}>المشرفون الحاليون</Text>
      {isLoading ? <ActivityIndicator color={PURPLE} style={{ marginTop: 20 }} /> : ((data ?? []) as Admin[]).map((a) => {
        const displayRole = a.removable ? ADMIN_ROLES.find(r => r.k === "admin") : ADMIN_ROLES.find(r => r.k === "owner");
        return (
          <View key={`${a.source}-${a.id}`} style={S.listRow}>
            <View style={[S.listIcon, { backgroundColor: displayRole?.color ?? PURPLE }]}>
              <Ionicons name={(displayRole?.icon ?? "shield-checkmark") as never} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.listName}>{a.email}</Text>
              <Text style={S.listMeta}>{displayRole?.l ?? "مشرف"}{a.addedBy ? ` · أضافه ${a.addedBy}` : ""}</Text>
            </View>
            {a.removable ? (
              <TouchableOpacity onPress={() => confirmDelete(a)} style={S.rowBtn}><Ionicons name="trash-outline" size={19} color={RED} /></TouchableOpacity>
            ) : (
              <Ionicons name="lock-closed" size={16} color={MUTED} />
            )}
          </View>
        );
      })}

      <Text style={[S.listHeader, { marginTop: 8 }]}>سجل التغييرات</Text>
      {auditLoading ? <ActivityIndicator color={PURPLE} style={{ marginTop: 12 }} /> : ((audit ?? []) as AdminAuditEvent[]).length === 0 ? (
        <Text style={[S.listMeta, { textAlign: "center", paddingVertical: 20 }]}>لا يوجد سجل بعد.</Text>
      ) : ((audit ?? []) as AdminAuditEvent[]).map((ev) => {
        const granted = ev.action === "grant";
        return (
          <View key={ev.id} style={S.listRow}>
            <View style={[S.listIcon, { backgroundColor: granted ? PURPLE : RED }]}>
              <Ionicons name={granted ? "add-circle" : "remove-circle"} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.listName}>{granted ? "منح إشراف" : "إزالة إشراف"}: {ev.targetEmail}</Text>
              <Text style={S.listMeta}>{ev.actorEmail ? `بواسطة ${ev.actorEmail} · ` : ""}{formatAuditTime(ev.createdAt)}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function formatAuditTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try { return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(d); }
  catch { return d.toLocaleString(); }
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { color: TEXT, fontSize: 18, fontWeight: "800" },
  iconBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  tabBar: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: BORDER },
  tabBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: "center" },
  tabItem: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  tabItemOn: { backgroundColor: PURPLE, borderColor: PURPLE },
  tabLabel: { color: MUTED, fontSize: 13, fontWeight: "700" },
  tabLabelOn: { color: "#fff" },
  sectionCard: { margin: 14, borderRadius: 18, backgroundColor: CARD, padding: 16, borderWidth: 1, borderColor: BORDER },
  sectionCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionCardTitle: { color: TEXT, fontSize: 16, fontWeight: "800" },
  sectionCardAction: { color: MUTED, fontSize: 13, fontWeight: "700" },
  fieldLabel: { color: MUTED, fontSize: 12, marginBottom: 6, fontWeight: "600", textAlign: "right" },
  inputDark: {
    backgroundColor: CARD2, borderWidth: 1, borderColor: BORDER, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: TEXT, textAlign: "right",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: {
    flexGrow: 1, flexBasis: "30%", borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, paddingVertical: 9, alignItems: "center", backgroundColor: CARD2,
  },
  chipOn: { backgroundColor: PURPLE, borderColor: PURPLE },
  chipText: { color: MUTED, fontSize: 13, fontWeight: "700" },
  chipTextOn: { color: "#fff" },
  targetChip: {
    flexDirection: "row", alignItems: "center", gap: 6, flex: 1,
    borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingVertical: 10,
    paddingHorizontal: 12, backgroundColor: CARD2, justifyContent: "center",
  },
  roleChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingVertical: 9,
    paddingHorizontal: 14, backgroundColor: CARD2,
  },
  roleDescBox: { backgroundColor: CARD2, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: BORDER },
  roleDesc: { color: TEXT, fontSize: 13, lineHeight: 20, textAlign: "right" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  submitBtn: {
    backgroundColor: PURPLE, borderRadius: 14, paddingVertical: 14,
    alignItems: "center", marginTop: 4,
  },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  listHeader: { color: MUTED, fontSize: 12, fontWeight: "700", marginHorizontal: 16, marginBottom: 8, marginTop: 4 },
  listRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 14, borderRadius: 14, padding: 12, marginBottom: 8,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  listRowSelected: { borderColor: PURPLE, borderWidth: 1.5 },
  listIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  listName: { color: TEXT, fontSize: 14, fontWeight: "700", textAlign: "right" },
  listMeta: { color: MUTED, fontSize: 11, marginTop: 2, textAlign: "right" },
  rowBtn: { padding: 6 },
  inlineInput: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, color: TEXT,
    minWidth: 100, backgroundColor: CARD2, textAlign: "right",
  },
  infoBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: CARD2, borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: BORDER },
  infoText: { color: MUTED, fontSize: 12, flex: 1, textAlign: "right" },
  pickerSection: { marginBottom: 14 },
  pickerLabel: { color: MUTED, fontSize: 12, marginBottom: 8, fontWeight: "600", textAlign: "right" },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorSwatch: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  colorSwatchSelected: { borderWidth: 3, borderColor: "#fff" },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconCell: {
    width: "22%", aspectRatio: 1, alignItems: "center", justifyContent: "center",
    gap: 4, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD2,
  },
  iconCellLabel: { color: MUTED, fontSize: 9, fontWeight: "600" },
  mediaBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: CARD2, borderWidth: 1, borderColor: BORDER, borderRadius: 12,
    paddingVertical: 14, borderStyle: "dashed",
  },
  mediaBtnText: { color: PURPLE, fontSize: 14, fontWeight: "700" },
  mediaPreview: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, backgroundColor: CARD2, borderRadius: 10, padding: 8 },
  mediaImg: { width: 48, height: 48, borderRadius: 8 },
  mediaUrl: { flex: 1, color: MUTED, fontSize: 11 },
  mediaClear: { padding: 4 },
  mediaOrLabel: { color: MUTED, fontSize: 11, textAlign: "center", marginVertical: 10 },
});
