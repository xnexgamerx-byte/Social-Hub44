import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetFollowStatsQueryKey,
  getGetFollowStatsQueryOptions,
  getGetProfileQueryOptions,
  useFollowUser,
  useOpenConversation,
  useUnfollowUser,
} from "@workspace/api-client-react";
import { QueryError } from "@/components/QueryError";
import { ScreenHeader } from "@/components/ScreenHeader";
import { UserActionsSheet } from "@/components/UserActionsSheet";
import { UserAvatar } from "@/components/UserAvatar";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { apiErrorMessage } from "@/lib/apiError";

function relativeSeen(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "متصل الآن";
  if (mins < 60) return `نشط قبل ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `نشط قبل ${hours} س`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "نشط أمس" : `نشط قبل ${days} يوم`;
}

function Stat({ value, label }: { value: number; label: string }) {
  const colors = useColors();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function UserProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user: me } = useApp();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const profileQ = useQuery({ ...getGetProfileQueryOptions(userId!), enabled: !!userId });
  const statsQ = useQuery({
    ...getGetFollowStatsQueryOptions(userId!),
    enabled: !!userId,
  });
  const followM = useFollowUser();
  const unfollowM = useUnfollowUser();
  const openConversationM = useOpenConversation();

  const profile = profileQ.data;
  const stats = statsQ.data;
  const isSelf = userId === me.id;

  const toggleFollow = async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      if (stats?.isFollowedByMe) {
        await unfollowM.mutateAsync({ targetUserId: userId });
      } else {
        await followM.mutateAsync({ data: { targetUserId: userId } });
      }
      qc.invalidateQueries({ queryKey: getGetFollowStatsQueryKey(userId) });
    } catch (err) {
      Alert.alert("خطأ", apiErrorMessage(err, "تعذّر تنفيذ الطلب"));
    } finally {
      setBusy(false);
    }
  };

  const openChat = async () => {
    if (!profile || !userId) return;
    try {
      const conv = await openConversationM.mutateAsync({
        data: {
          otherUserId: userId,
          otherName: profile.name,
          otherAvatar: profile.avatar,
        },
      });
      router.push(
        `/dm/${conv.id}?otherUserId=${encodeURIComponent(conv.otherUserId)}&otherName=${encodeURIComponent(conv.otherName || profile.name)}&otherAvatar=${encodeURIComponent(conv.otherAvatar || profile.avatar)}`,
      );
    } catch (err) {
      Alert.alert("خطأ", apiErrorMessage(err, "تعذّر فتح المحادثة"));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="الملف الشخصي"
        action={
          isSelf ? undefined : (
            <TouchableOpacity onPress={() => setSheetOpen(true)} accessibilityLabel="خيارات">
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.foreground} />
            </TouchableOpacity>
          )
        }
      />

      {profileQ.isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : profileQ.isError || !profile ? (
        <QueryError
          message="تعذّر تحميل هذا الملف."
          onRetry={() => void profileQ.refetch()}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110, gap: 18 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={[styles.avatarRing, { borderColor: colors.primary }]}>
              <UserAvatar
                uri={profile.avatar}
                name={profile.name}
                size={86}
                online={profile.isOnline}
              />
            </View>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                {profile.name || "مستخدم"}
              </Text>
              {profile.isOfficial ? (
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              ) : null}
              {profile.country ? <Text style={styles.flag}>{profile.country}</Text> : null}
            </View>
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.badgeText, { color: colors.secondaryForeground }]}>
                  Lv.{profile.level}
                </Text>
              </View>
              {profile.age > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                  <Ionicons
                    name={profile.gender === "female" ? "female" : "male"}
                    size={11}
                    color={colors.secondaryForeground}
                  />
                  <Text style={[styles.badgeText, { color: colors.secondaryForeground }]}>
                    {profile.age}
                  </Text>
                </View>
              ) : null}
              {profile.isHost ? (
                <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="mic" size={11} color={colors.secondaryForeground} />
                  <Text style={[styles.badgeText, { color: colors.secondaryForeground }]}>
                    مضيف
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.seen, { color: colors.mutedForeground }]}>
              {profile.isOnline ? "متصل الآن" : relativeSeen(profile.lastSeenAt)}
            </Text>
          </View>

          <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
            <Stat value={stats?.followers ?? 0} label="المتابعون" />
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <Stat value={stats?.following ?? 0} label="يتابع" />
          </View>

          {profile.bio ? (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.bio, { color: colors.foreground }]}>{profile.bio}</Text>
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>معلومة</Text>
            {profile.country ? <InfoRow label="الدولة" value={profile.country} /> : null}
            {profile.age > 0 ? <InfoRow label="العمر" value={String(profile.age)} /> : null}
            {profile.gender ? (
              <InfoRow label="الجنس" value={profile.gender === "female" ? "أنثى" : "ذكر"} />
            ) : null}
            <InfoRow label="المستوى" value={`Lv.${profile.level}`} />
          </View>
        </ScrollView>
      )}

      {/* Actions stay pinned so they never scroll out of reach. */}
      {profile && !isSelf ? (
        <View
          style={[
            styles.actions,
            {
              paddingBottom: insets.bottom + 14,
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.followBtn,
              {
                backgroundColor: stats?.isFollowedByMe ? colors.secondary : colors.primary,
              },
            ]}
            onPress={toggleFollow}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.followText,
                  {
                    color: stats?.isFollowedByMe
                      ? colors.secondaryForeground
                      : colors.primaryForeground,
                  },
                ]}
              >
                {stats?.isFollowedByMe ? "إلغاء المتابعة" : "متابعة"}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chatBtn, { backgroundColor: colors.secondary }]}
            onPress={openChat}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      ) : null}

      <UserActionsSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        targetUserId={userId ?? ""}
        targetName={profile?.name ?? "مستخدم"}
        onBlocked={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 50 },
  header: { alignItems: "center", gap: 8, paddingTop: 8 },
  avatarRing: { borderWidth: 2.5, borderRadius: 50, padding: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  name: { fontSize: 20, fontWeight: "800" as const, maxWidth: 220 },
  flag: { fontSize: 17 },
  badges: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11.5, fontWeight: "700" as const },
  seen: { fontSize: 12.5 },
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 14,
  },
  stat: { flex: 1, alignItems: "center", gap: 3 },
  statValue: { fontSize: 19, fontWeight: "800" as const },
  statLabel: { fontSize: 12 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28 },
  card: { borderRadius: 14, padding: 14, gap: 8 },
  cardTitle: { fontSize: 12.5, fontWeight: "700" as const, textAlign: "right" as const },
  bio: { fontSize: 14, lineHeight: 21, textAlign: "right" as const },
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  infoLabel: { fontSize: 13.5 },
  infoValue: { fontSize: 13.5, fontWeight: "600" as const },
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  followBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  followText: { fontSize: 15, fontWeight: "800" as const },
  chatBtn: { width: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
