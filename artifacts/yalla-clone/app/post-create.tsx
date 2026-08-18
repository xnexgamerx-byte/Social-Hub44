import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { getListPostsQueryKey, useCreatePost } from "@workspace/api-client-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const SUGGESTED_TAGS = ["لحظات الحياة", "الطعام اليوم", "موسيقى", "سفر", "دردشة"];
const MAX_IMAGES = 4;

export default function PostCreateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [text, setText] = useState("");
  const [tag, setTag] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const createM = useCreatePost();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const pickImage = async () => {
    if (images.length >= MAX_IMAGES) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("الصور", "نحتاج إذن الوصول إلى صورك لإضافة صورة للمنشور.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const asset = result.assets[0];
    // Stored as a data URI: the API takes image strings and there is no upload
    // service yet, so keep the quality low to stay well inside the row limit.
    setImages((prev) => [...prev, `data:image/jpeg;base64,${asset.base64}`]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const publish = async () => {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) {
      Alert.alert("تنبيه", "اكتب شيئاً أو أضف صورة");
      return;
    }
    setSaving(true);
    try {
      await createM.mutateAsync({ data: { text: trimmed, images, tag: tag.trim() } });
      qc.invalidateQueries({ queryKey: getListPostsQueryKey() });
      router.back();
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string } } })?.response?.data;
      Alert.alert("خطأ", data?.error ?? "تعذّر نشر اللحظة");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>لحظة جديدة</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
          ]}
          placeholder="شنو يدور ببالك؟"
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={setText}
          maxLength={500}
          multiline
          textAlign="right"
        />

        {images.length > 0 && (
          <View style={styles.imageRow}>
            {images.map((uri, i) => (
              <View key={i} style={styles.imageWrap}>
                <Image source={{ uri }} style={styles.image} resizeMode="cover" />
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(i)}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.addImageBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={pickImage}
          disabled={images.length >= MAX_IMAGES}
        >
          <Ionicons
            name="image-outline"
            size={20}
            color={images.length >= MAX_IMAGES ? colors.mutedForeground : colors.primary}
          />
          <Text style={[styles.addImageText, { color: colors.foreground }]}>
            {images.length >= MAX_IMAGES
              ? `الحد الأقصى ${MAX_IMAGES} صور`
              : `إضافة صورة (${images.length}/${MAX_IMAGES})`}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.label, { color: colors.foreground }]}>الوسم</Text>
        <View style={styles.tags}>
          {SUGGESTED_TAGS.map((t) => {
            const selected = tag === t;
            return (
              <TouchableOpacity
                key={t}
                style={[
                  styles.tagChip,
                  {
                    backgroundColor: selected ? colors.primary : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setTag(selected ? "" : t)}
              >
                <Text style={[styles.tagText, { color: selected ? "#fff" : colors.foreground }]}>
                  {t}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.publishBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
          onPress={publish}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={17} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
              <Text style={styles.publishText}>نشر</Text>
            </>
          )}
        </TouchableOpacity>
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
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 16, fontWeight: "700" as const, textAlign: "center" as const },
  content: { padding: 20, gap: 12 },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: "top" as const,
  },
  imageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  imageWrap: { position: "relative" },
  image: { width: 84, height: 84, borderRadius: 10 },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  addImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed" as const,
    paddingVertical: 14,
  },
  addImageText: { fontSize: 14, fontWeight: "600" as const },
  label: { fontSize: 14, fontWeight: "700" as const, marginTop: 8 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagText: { fontSize: 13, fontWeight: "600" as const },
  publishBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 20,
  },
  publishText: { color: "#fff", fontSize: 15, fontWeight: "700" as const },
});
