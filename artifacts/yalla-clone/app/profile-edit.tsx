import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const FALLBACK_AVATAR = "https://i.pravatar.cc/150?img=3";
const MAX_BIO = 160;

export default function ProfileEditScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isLoaded } = useUser();

  const initialName = user?.fullName || user?.firstName || user?.username || "";
  const initialBio = (user?.unsafeMetadata?.bio as string | undefined) ?? "";

  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  // Locally-picked image kept as a base64 data URI: previewed immediately and
  // uploaded to Clerk only on save.
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The useState initializers can run before Clerk finishes loading the user
  // (fields would stay empty). Hydrate once when the user first arrives, without
  // clobbering edits already in progress.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current || !user) return;
    hydrated.current = true;
    setName(user.fullName || user.firstName || user.username || "");
    setBio((user.unsafeMetadata?.bio as string | undefined) ?? "");
  }, [user]);

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = (Platform.OS === "web" ? 24 : insets.bottom) + 24;
  const avatarUri = pendingImage || user?.imageUrl || FALLBACK_AVATAR;

  const pickImage = async () => {
    setError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("الصلاحيات", "نحتاج إذن الوصول إلى الصور لتغيير صورتك.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        setError("تعذّر قراءة الصورة المختارة.");
        return;
      }
      const mime = asset.mimeType || "image/jpeg";
      setPendingImage(`data:${mime};base64,${asset.base64}`);
    } catch {
      setError("تعذّر فتح معرض الصور.");
    }
  };

  const onSave = async () => {
    if (!user) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("الاسم مطلوب");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (pendingImage) {
        await user.setProfileImage({ file: pendingImage });
      }
      await user.update({
        firstName: trimmedName,
        lastName: "",
        unsafeMetadata: { ...(user.unsafeMetadata ?? {}), bio: bio.trim() },
      });
      router.back();
    } catch {
      setError("تعذّر حفظ التغييرات. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>تعديل الملف الشخصي</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity activeOpacity={0.85} onPress={pickImage}>
            <View style={[styles.avatarWrapper, { borderColor: colors.primary }]}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
            </View>
            <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickImage} hitSlop={8}>
            <Text style={[styles.changePhoto, { color: colors.primary }]}>تغيير الصورة</Text>
          </TouchableOpacity>
        </View>

        {/* Fields */}
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.foreground }]}>الاسم</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
            placeholder="اكتب اسمك"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            maxLength={50}
          />

          <View style={styles.bioLabelRow}>
            <Text style={[styles.counter, { color: colors.mutedForeground }]}>
              {bio.length}/{MAX_BIO}
            </Text>
            <Text style={[styles.label, { color: colors.foreground }]}>نبذة</Text>
          </View>
          <TextInput
            style={[
              styles.input,
              styles.bioInput,
              { backgroundColor: colors.input, color: colors.foreground },
            ]}
            placeholder="عرّف بنفسك في جملة قصيرة"
            placeholderTextColor={colors.mutedForeground}
            value={bio}
            onChangeText={setBio}
            maxLength={MAX_BIO}
            multiline
            textAlignVertical="top"
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: colors.primary },
              (saving || !name.trim()) && styles.btnDisabled,
              pressed && styles.btnPressed,
            ]}
            onPress={onSave}
            disabled={saving || !name.trim()}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>حفظ التغييرات</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "800" as const },
  avatarSection: { alignItems: "center", marginTop: 28, marginBottom: 12 },
  avatarWrapper: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    overflow: "hidden",
  },
  avatar: { width: "100%", height: "100%" },
  cameraBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
  changePhoto: { fontSize: 14, fontWeight: "700" as const, marginTop: 12 },
  form: { paddingHorizontal: 20, marginTop: 12 },
  label: {
    fontSize: 14,
    fontWeight: "700" as const,
    marginBottom: 8,
    textAlign: "right",
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 18,
    textAlign: "right",
  },
  bioLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counter: { fontSize: 12 },
  bioInput: { minHeight: 96, paddingTop: 14 },
  error: { color: "#EF4444", fontSize: 13, marginBottom: 12, textAlign: "right" },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 6,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" as const },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.85 },
});
