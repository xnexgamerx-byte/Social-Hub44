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
import { UserAvatar } from "@/components/UserAvatar";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { getSocket } from "@/lib/socket";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
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

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
        </TouchableOpacity>
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
      </View>

      {/* Messages - inverted FlatList */}
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
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {historyQ.isLoading ? "جارٍ التحميل..." : "ابدأ المحادثة 👋"}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.fromUserId === user.id;
          return (
            <View style={[styles.msgRow, mine ? styles.mineRow : styles.theirsRow]}>
              <View
                style={[
                  styles.bubble,
                  mine
                    ? { backgroundColor: colors.primary, borderTopRightRadius: 4 }
                    : {
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderTopLeftRadius: 4,
                      },
                ]}
              >
                <Text style={[styles.msgText, { color: mine ? "#fff" : colors.foreground }]}>
                  {item.text}
                </Text>
                <Text
                  style={[
                    styles.msgTime,
                    { color: mine ? "rgba(255,255,255,0.7)" : colors.mutedForeground },
                  ]}
                >
                  {formatTime(item.createdAt)}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Composer */}
      <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: botPad + 8 }]}>
        <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="رسالة..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            returnKeyType="send"
            textAlign="right"
          />
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.muted }]}
          onPress={send}
          disabled={!text.trim()}
        >
          <Ionicons
            name="send"
            size={18}
            color={text.trim() ? "#fff" : colors.mutedForeground}
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1 },
  name: { fontSize: 16, fontWeight: "700" as const },
  followCount: { fontSize: 11, marginTop: 2 },
  followBtn: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  followText: { fontSize: 12, fontWeight: "700" as const },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  empty: { paddingVertical: 40, alignItems: "center", transform: [{ scaleY: -1 }] },
  emptyText: { fontSize: 14 },
  msgRow: { flexDirection: "row" },
  mineRow: { justifyContent: "flex-end" },
  theirsRow: { justifyContent: "flex-start" },
  bubble: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: "80%",
    gap: 2,
  },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTime: { fontSize: 10, alignSelf: "flex-end" },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 40,
    justifyContent: "center",
  },
  input: { fontSize: 14 },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
