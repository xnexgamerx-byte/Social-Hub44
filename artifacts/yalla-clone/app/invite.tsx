import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetMyReferralQueryKey,
  getGetMyReferralQueryOptions,
  getGetWalletQueryKey,
  useClaimReferral,
} from "@workspace/api-client-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function InviteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const referralQ = useQuery(getGetMyReferralQueryOptions());
  const claimM = useClaimReferral();

  const [code, setCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [copied, setCopied] = useState(false);

  const data = referralQ.data;

  const copyCode = async () => {
    if (!data?.code) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const shareCode = async () => {
    if (!data?.code) return;
    await Share.share({
      message: `انضم إليّ في نبضة! استخدم رمز الدعوة ${data.code} واحصل على ${data.referredReward} كوينز مجاناً 🎁`,
    });
  };

  const claim = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setClaiming(true);
    try {
      await claimM.mutateAsync({ data: { code: trimmed } });
      qc.invalidateQueries({ queryKey: getGetMyReferralQueryKey() });
      if (user.id) qc.invalidateQueries({ queryKey: getGetWalletQueryKey(user.id) });
      setCode("");
      Alert.alert("تم!", `حصلت على ${data?.referredReward ?? 0} كوينز 🎉`);
    } catch (err) {
      const body = (err as { response?: { data?: { error?: string } } })?.response?.data;
      Alert.alert("تعذّر", body?.error ?? "رمز الدعوة غير صحيح");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>ادعُ أصدقاءك</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["#7C5CFC", "#4C1D95"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Ionicons name="gift" size={34} color="#FFD75E" />
          <Text style={styles.heroTitle}>اربحوا سوا</Text>
          <Text style={styles.heroSub}>
            كل صديق ينضم برمزك: تربح {data?.referrerReward ?? 0} كوينز، ويربح هو{" "}
            {data?.referredReward ?? 0}
          </Text>
        </LinearGradient>

        {/* My code */}
        <Text style={[styles.label, { color: colors.foreground }]}>رمز الدعوة الخاص بك</Text>
        {referralQ.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <TouchableOpacity
              style={[styles.codeBox, { backgroundColor: colors.card, borderColor: colors.primary }]}
              onPress={copyCode}
              activeOpacity={0.8}
            >
              <Text style={[styles.codeText, { color: colors.primary }]}>{data?.code || "—"}</Text>
              <Ionicons
                name={copied ? "checkmark-circle" : "copy-outline"}
                size={21}
                color={copied ? "#22C55E" : colors.mutedForeground}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.primary }]}
              onPress={shareCode}
              activeOpacity={0.85}
            >
              <Ionicons name="share-social" size={18} color="#fff" />
              <Text style={styles.shareText}>شارك الرمز</Text>
            </TouchableOpacity>

            <View style={[styles.statRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="people" size={18} color={colors.primary} />
              <Text style={[styles.statText, { color: colors.foreground }]}>
                انضم برمزك {data?.invitedCount ?? 0}{" "}
                {(data?.invitedCount ?? 0) === 1 ? "صديق" : "أصدقاء"}
              </Text>
            </View>
          </>
        )}

        {/* Claim someone else's */}
        <Text style={[styles.label, { color: colors.foreground, marginTop: 10 }]}>
          عندك رمز من صديق؟
        </Text>
        {data?.hasClaimed ? (
          <View style={[styles.doneBox, { backgroundColor: "#22C55E1A", borderColor: "#22C55E55" }]}>
            <Ionicons name="checkmark-circle" size={19} color="#22C55E" />
            <Text style={[styles.doneText, { color: colors.foreground }]}>
              استخدمت رمز دعوة من قبل
            </Text>
          </View>
        ) : (
          <View style={styles.claimRow}>
            <View
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <TextInput
                style={[styles.inputText, { color: colors.foreground }]}
                placeholder="رمز الصديق"
                placeholderTextColor={colors.mutedForeground}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={12}
                onSubmitEditing={claim}
                returnKeyType="go"
                textAlign="center"
              />
            </View>
            <TouchableOpacity
              style={[
                styles.claimBtn,
                { backgroundColor: code.trim() && !claiming ? "#22C55E" : colors.muted },
              ]}
              onPress={claim}
              disabled={!code.trim() || claiming}
            >
              {claiming ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons
                  name="checkmark"
                  size={21}
                  color={code.trim() ? "#fff" : colors.mutedForeground}
                />
              )}
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          يمكن استخدام رمز دعوة واحد فقط لكل حساب، ولا يمكنك استخدام رمزك الخاص.
        </Text>
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
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 16, fontWeight: "700" as const, textAlign: "center" as const },
  hero: { borderRadius: 20, padding: 22, alignItems: "center", gap: 8 },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "800" as const },
  heroSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    textAlign: "center" as const,
    lineHeight: 20,
  },
  label: { fontSize: 14, fontWeight: "800" as const },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed" as const,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  codeText: { fontSize: 26, fontWeight: "800" as const, letterSpacing: 4 },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
  },
  shareText: { color: "#fff", fontSize: 15, fontWeight: "700" as const },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statText: { fontSize: 14, fontWeight: "600" as const },
  claimRow: { flexDirection: "row", gap: 10 },
  input: { flex: 1, borderRadius: 14, borderWidth: 1, height: 50, justifyContent: "center" },
  inputText: { fontSize: 17, fontWeight: "700" as const, letterSpacing: 2 },
  claimBtn: { width: 50, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  doneBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  doneText: { fontSize: 14, fontWeight: "600" as const },
  hint: { fontSize: 12, textAlign: "center" as const, lineHeight: 18, marginTop: 4 },
});
