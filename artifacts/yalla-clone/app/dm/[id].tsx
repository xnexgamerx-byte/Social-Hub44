import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetFollowStatsQueryKey,
  getGetFollowStatsQueryOptions,
  getListConversationsQueryKey,
  getListDmMessagesQueryKey,
  getListDmMessagesQueryOptions,
  useFollowUser,
  useMarkConversationRead,
  useUnfollowUser,
  type DmMessage,
} from "@workspace/api-client-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QueryError } from "@/components/QueryError";
import { UserAvatar } from "@/components/UserAvatar";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { getSocket } from "@/lib/socket";
import { UserActionsSheet } from "@/components/UserActionsSheet";

/** Messages closer together than this belong to one visual run. */
const RUN_GAP_MS = 5 * 60_000;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return "اليوم";
  if (sameDay(d, yesterday)) return "أمس";
  return d.toLocaleDateString("ar", { day: "numeric", month: "long" });
}

export default function DmScreen() {
  const { id, otherUserId, otherName, otherAvatar } = useLocalSearchParams<{
    id: string;
    otherUserId?: string;
    otherName?: string;
    otherAvatar?: string;
  }>();
  const conversationId = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useApp();

  const [text, setText] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [liveMessages, setLiveMessages] = useState<DmMessage[]>([]);

  const historyQ = useQuery({
    ...getListDmMessagesQueryOptions(conversationId),
    enabled: Number.isFinite(conversationId),
  });
  const markReadM = useMarkConversationRead();

  const followStatsQ = useQuery({
    ...getGetFollowStatsQueryOptions(otherUserId ?? "__none__"),
    enabled: !!otherUserId,
  });
  const followM = useFollowUser();
  const unfollowM = useUnfollowUser();
  const isFollowing = followStatsQ.data?.isFollowedByMe ?? false;
  const followBusy = followM.isPending || unfollowM.isPending;

  const toggleFollow = useCallback(async () => {
    if (!otherUserId || followBusy) return;
    try {
      if (isFollowing) await unfollowM.mutateAsync({ targetUserId: otherUserId });
      else await followM.mutateAsync({ data: { targetUserId: otherUserId } });
      qc.invalidateQueries({ queryKey: getGetFollowStatsQueryKey(otherUserId) });
    } catch {
      Alert.alert("المتابعة", "تعذّر تحديث المتابعة");
    }
  }, [otherUserId, isFollowing, followBusy, followM, unfollowM, qc]);

  const markRead = useCallback(() => {
    if (!Number.isFinite(conversationId)) return;
    markReadM.mutate(
      { id: conversationId },
      {
        onSuccess: () =>
          qc.invalidateQueries({ queryKey: getListConversationsQueryKey() }),
      },
    );
    // markReadM is a stable mutation object from React Query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, qc]);

  // Opening the conversation clears its unread badge.
  useEffect(() => {
    markRead();
  }, [markRead]);

  // Live messages for this conversation arrive over the personal channel.
  useEffect(() => {
    const socket = getSocket();
    const onNew = ({ message }: { message: DmMessage }) => {
      if (message.conversationId !== conversationId) return;
      setLiveMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      );
      // Reading while the thread is open keeps the inbox badge at zero.
      if (message.fromUserId !== user.id) markRead();
    };
    const onError = ({ message }: { message: string }) => {
      Alert.alert("الرسائل", message);
    };
    socket.on("dm:new", onNew);
    socket.on("dm:error", onError);
    return () => {
      socket.off("dm:new", onNew);
      socket.off("dm:error", onError);
      // Refresh history for the next open so live messages are not re-added.
      qc.invalidateQueries({ queryKey: getListDmMessagesQueryKey(conversationId) });
    };
  }, [conversationId, user.id, markRead, qc]);

  const messages = useMemo(() => {
    const base = historyQ.data ?? [];
    const seen = new Set(base.map((m) => m.id));
    const merged = [...base, ...liveMessages.filter((m) => !seen.has(m.id))];
    return merged.reverse(); // inverted list expects newest-first
  }, [historyQ.data, liveMessages]);

  const send = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || !otherUserId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    getSocket().emit("dm:send", {
      toUserId: otherUserId,
      toName: otherName ?? "",
      toAvatar: otherAvatar ?? "",
      text: trimmed,
      userName: user.name,
      userAvatar: user.avatar,
    });
    setText("");
  }, [text, otherUserId, otherName, otherAvatar, user.name, user.avatar]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const canSend = text.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 10, borderBottomColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
        >
          <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerId}
          activeOpacity={0.7}
          disabled={!otherUserId}
          onPress={() =>
            otherUserId &&
            router.push({ pathname: "/user/[userId]", params: { userId: otherUserId } })
          }
        >
          <UserAvatar uri={otherAvatar || ""} name={otherName || "مستخدم"} size={38} />
          <View style={styles.headerCenter}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {otherName || "مستخدم"}
            </Text>
            {followStatsQ.data && (
              <Text style={[styles.followCount, { color: colors.mutedForeground }]}>
                {followStatsQ.data.followers} متابع
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {otherUserId ? (
          <TouchableOpacity
            style={[
              styles.followBtn,
              isFollowing
                ? { backgroundColor: colors.muted }
                : { backgroundColor: colors.primary },
              followBusy && { opacity: 0.6 },
            ]}
            onPress={toggleFollow}
            disabled={followBusy}
          >
            {!isFollowing && <Ionicons name="add" size={13} color="#fff" />}
            <Text
              style={[
                styles.followText,
                { color: isFollowing ? colors.mutedForeground : "#fff" },
              ]}
            >
              {isFollowing ? "أتابعه" : "متابعة"}
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => setActionsOpen(true)}
          hitSlop={8}
          accessibilityLabel="خيارات"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <UserActionsSheet
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        targetUserId={otherUserId ?? ""}
        targetName={otherName ?? ""}
        onBlocked={() => router.back()}
      />

      {/* Messages — inverted, so data[i + 1] is the older neighbour. */}
      <FlatList
        data={messages}
        keyExtractor={(m) => String(m.id)}
        inverted
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            {historyQ.isError ? (
              <QueryError
                message="تعذّر تحميل الرسائل."
                onRetry={() => void historyQ.refetch()}
              />
            ) : (
              <>
                <View style={[styles.emptyArt, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="hand-left" size={26} color={colors.primary} />
                </View>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {historyQ.isLoading ? "جارٍ التحميل..." : "قل مرحباً وابدأ المحادثة"}
                </Text>
              </>
            )}
          </View>
        }
        renderItem={({ item, index }) => {
          const mine = item.fromUserId === user.id;
          const older = messages[index + 1];
          const newer = messages[index - 1];
          const at = new Date(item.createdAt).getTime();

          const startsRun =
            !older ||
            older.fromUserId !== item.fromUserId ||
            at - new Date(older.createdAt).getTime() > RUN_GAP_MS;
          const endsRun =
            !newer ||
            newer.fromUserId !== item.fromUserId ||
            new Date(newer.createdAt).getTime() - at > RUN_GAP_MS;

          // The day divider belongs above the oldest message of that day.
          const showDay =
            !older || !sameDay(new Date(older.createdAt), new Date(item.createdAt));

          return (
            <View>
              {showDay && (
                <View style={styles.dayWrap}>
                  <View style={[styles.dayPill, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.dayText, { color: colors.mutedForeground }]}>
                      {dayLabel(item.createdAt)}
                    </Text>
                  </View>
                </View>
              )}

              <View
                style={[
                  styles.msgRow,
                  mine ? styles.mineRow : styles.theirsRow,
                  { marginTop: startsRun ? 10 : 2 },
                ]}
              >
                {/* The avatar marks where a run ends, so a burst of messages
                    is not a column of repeated faces. */}
                {!mine && (
                  <View style={styles.avatarSlot}>
                    {endsRun && (
                      <UserAvatar
                        uri={otherAvatar || ""}
                        name={otherName || "مستخدم"}
                        size={26}
                      />
                    )}
                  </View>
                )}

                <View style={styles.bubbleCol}>
                  <View
                    style={[
                      styles.bubble,
                      mine
                        ? {
                            backgroundColor: colors.primary,
                            borderTopRightRadius: startsRun ? 18 : 6,
                            borderBottomRightRadius: endsRun ? 5 : 6,
                          }
                        : {
                            backgroundColor: colors.card,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderTopLeftRadius: startsRun ? 18 : 6,
                            borderBottomLeftRadius: endsRun ? 5 : 6,
                          },
                    ]}
                  >
                    <Text
                      style={[styles.msgText, { color: mine ? "#fff" : colors.foreground }]}
                    >
                      {item.text}
                    </Text>
                  </View>

                  {/* One timestamp per run instead of one per bubble. */}
                  {endsRun && (
                    <Text
                      style={[
                        styles.msgTime,
                        { color: colors.mutedForeground },
                        mine ? { textAlign: "right" } : { textAlign: "left" },
                      ]}
                    >
                      {formatTime(item.createdAt)}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Composer */}
      <View
        style={[
          styles.composer,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingBottom: botPad + 8,
          },
        ]}
      >
        <View
          style={[
            styles.inputWrapper,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="اكتب رسالة..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            returnKeyType="send"
            textAlign="right"
            multiline
          />
        </View>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: canSend ? colors.primary : colors.muted },
          ]}
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="إرسال"
        >
          <Ionicons
            name="send"
            size={18}
            color={canSend ? "#fff" : colors.mutedForeground}
            style={{ transform: [{ scaleX: -1 }] }}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: {
    width: 32,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerId: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerCenter: { flex: 1, alignItems: "flex-end" },
  name: { fontSize: 15.5, fontWeight: "700" as const, textAlign: "right" as const },
  followCount: { fontSize: 11, marginTop: 2 },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  followText: { fontSize: 12, fontWeight: "700" as const },
  moreBtn: { width: 30, height: 32, alignItems: "center", justifyContent: "center" },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 14, paddingVertical: 12 },

  dayWrap: { alignItems: "center", marginVertical: 12 },
  dayPill: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  dayText: { fontSize: 11, fontWeight: "700" as const },

  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 7 },
  mineRow: { justifyContent: "flex-end" },
  theirsRow: { justifyContent: "flex-start" },
  avatarSlot: { width: 26, height: 26, justifyContent: "flex-end" },
  bubbleCol: { maxWidth: "78%", gap: 3 },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  msgText: { fontSize: 14.5, lineHeight: 21, textAlign: "right" as const },
  msgTime: { fontSize: 10, paddingHorizontal: 4 },

  empty: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 12,
    transform: [{ scaleY: -1 }],
  },
  emptyArt: {
    width: 58,
    height: 58,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 14 },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 42,
    maxHeight: 120,
    justifyContent: "center",
    paddingVertical: 6,
  },
  input: { fontSize: 14.5, lineHeight: 20, maxHeight: 104 },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
