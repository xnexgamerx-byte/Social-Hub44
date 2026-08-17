import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListMyRoomsQueryKey,
  getListRoomsQueryKey,
  getGetRoomQueryKey,
  getGetRoomQueryOptions,
  useCreateRoom,
  useUpdateRoom,
  type RoomInputCategory,
} from "@workspace/api-client-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const CATEGORIES: { key: RoomInputCategory; label: string; icon: string }[] = [
  { key: "chat", label: "دردشة", icon: "chatbubbles" },
  { key: "gaming", label: "ألعاب", icon: "game-controller" },
  { key: "music", label: "طرب", icon: "musical-notes" },
  { key: "family", label: "عائلة", icon: "people" },
];

export default function RoomCreateScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ? Number(id) : null;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useApp();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<RoomInputCategory>("chat");
  const [saving, setSaving] = useState(false);

  const roomQ = useQuery({
    ...getGetRoomQueryOptions(editId ?? 0),
    enabled: editId != null,
  });
  const createM = useCreateRoom();
  const updateM = useUpdateRoom();

  // Prefill once when editing: the query resolves after the first render, so
  // hydrate via a ref-guarded effect instead of useState initializers.
  const hydrated = useRef(false);
  useEffect(() => {
    if (editId == null || hydrated.current || !roomQ.data) return;
    hydrated.current = true;
    setName(roomQ.data.name);
    setDescription(roomQ.data.description);
    const cat = roomQ.data.category as RoomInputCategory;
    if (CATEGORIES.some((c) => c.key === cat)) setCategory(cat);
  }, [editId, roomQ.data]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isEdit = editId != null;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("تنبيه", "اكتب اسم الغرفة أولاً");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateM.mutateAsync({
          id: editId,
          data: { name: trimmed, description: description.trim(), category },
        });
        qc.invalidateQueries({ queryKey: getGetRoomQueryKey(editId) });
      } else {
        await createM.mutateAsync({
          data: {
            name: trimmed,
            description: description.trim(),
            category,
            ownerName: user.name,
            ownerAvatar: user.avatar,
          },
        });
      }
      qc.invalidateQueries({ queryKey: getListRoomsQueryKey() });
      qc.invalidateQueries({ queryKey: getListMyRoomsQueryKey() });
      router.back();
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string } } })?.response?.data;
      Alert.alert("خطأ", data?.error ?? "تعذّر حفظ الغرفة");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {isEdit ? "تعديل الغرفة" : "إنشاء غرفة جديدة"}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {isEdit && roomQ.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>اسم الغرفة</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="مثلاً: سهرة الأصدقاء"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              maxLength={60}
              textAlign="right"
            />

            <Text style={[styles.label, { color: colors.foreground }]}>الوصف</Text>
            <TextInput
              style={[styles.input, styles.multiline, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="عن ماذا تتحدث غرفتك؟"
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              maxLength={200}
              multiline
              textAlign="right"
            />

            <Text style={[styles.label, { color: colors.foreground }]}>التصنيف</Text>
            <View style={styles.categories}>
              {CATEGORIES.map((c) => {
                const selected = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setCategory(c.key)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={c.icon as keyof typeof Ionicons.glyphMap}
                      size={16}
                      color={selected ? "#fff" : colors.mutedForeground}
                    />
                    <Text style={[styles.categoryLabel, { color: selected ? "#fff" : colors.foreground }]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
              onPress={save}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name={isEdit ? "save" : "add-circle"} size={18} color="#fff" />
                  <Text style={styles.saveText}>{isEdit ? "حفظ التعديلات" : "إنشاء الغرفة"}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontSize: 16, fontWeight: "700" as const, textAlign: "center" as const },
  content: { padding: 20, gap: 8 },
  label: { fontSize: 14, fontWeight: "700" as const, marginTop: 12, marginBottom: 4 },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  multiline: { minHeight: 90, textAlignVertical: "top" as const },
  categories: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  categoryLabel: { fontSize: 13, fontWeight: "600" as const },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 24,
  },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "700" as const },
});
