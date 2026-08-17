import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getGetRoomQueryOptions, useOpenConversation } from "@workspace/api-client-react";
import { UserAvatar } from "@/components/UserAvatar";
import { LiveBadge } from "@/components/LiveBadge";
import { EntranceOverlay } from "@/components/EntranceOverlay";
import { GiftOverlay } from "@/components/GiftOverlay";
import { GiftPicker, type GiftItem } from "@/components/GiftPicker";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useRoomChat, type ChatMessage } from "@/hooks/useRoomChat";
import { useRoomGifts } from "@/hooks/useRoomGifts";
import { useRoomVoice } from "@/hooks/useRoomVoice";

const AMBER = "#F59E0B";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function RoomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, refreshWallet } = useApp();
  const roomQ = useQuery({ ...getGetRoomQueryOptions(Number(id)), enabled: !!id });
  const room = roomQ.data;
  const openConversationM = useOpenConversation();

  const { messages, presence, connected, sendMessage: emitMessage } = useRoomChat(id, {
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
  });
  const { seats, onMic, muted, stageFull, takeMic, leaveMic, setMuted } = useRoomVoice(id, {
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
  });
  const { gift, entrance, sendGift, clearGift, clearEntrance } = useRoomGifts(
    id,
    useCallback(() => refreshWallet(), [refreshWallet]),
    useCallback((message: string) => Alert.alert("الهدية", message), []),
  );
  const [text, setText] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);
  const flatRef = useRef<FlatList>(null);

  const handleSendGift = useCallback(
    (item: GiftItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      sendGift({
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        itemId: item.id,
      });
      setGiftOpen(false);
    },
    [sendGift, user],
  );

  const onMicPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!onMic) takeMic();
    else setMuted(!muted);
  }, [onMic, muted, takeMic, setMuted]);

  const onMicLongPress = useCallback(() => {
    if (!onMic) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    leaveMic();
  }, [onMic, leaveMic]);

  // Tap another member's avatar to open a private conversation with them.
  const openDm = useCallback(
    async (other: { userId: string; userName: string; userAvatar?: string }) => {
      if (!other.userId || other.userId === user.id) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        const conv = await openConversationM.mutateAsync({
          data: {
            otherUserId: other.userId,
            otherName: other.userName,
            otherAvatar: other.userAvatar ?? "",
          },
        });
        router.push(
          `/dm/${conv.id}?otherUserId=${encodeURIComponent(conv.otherUserId)}&otherName=${encodeURIComponent(conv.otherName || other.userName)}&otherAvatar=${encodeURIComponent(conv.otherAvatar || other.userAvatar || "")}`,
        );
      } catch {
        Alert.alert("خطأ", "تعذّر فتح المحادثة");
      }
    },
    [user.id, openConversationM],
  );

  // Inverted list expects newest-first; chat stores chronological order.
  const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const sendMessage = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    emitMessage({
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      text: trimmed,
    });
    setText("");
  }, [text, user, emitMessage]);

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
        <View style={styles.headerCenter}>
          <Text style={[styles.roomName, { color: colors.foreground }]} numberOfLines={1}>
            {room?.name ?? "..."}
          </Text>
          <View style={styles.headerSub}>
            {presence > 0 && <LiveBadge small />}
            <View style={[styles.onlineDot, { backgroundColor: connected ? "#22C55E" : colors.mutedForeground }]} />
            <Text style={[styles.listenerCount, { color: colors.mutedForeground }]}>
              {presence > 0 ? `${presence} متصل الآن` : "كن أول الحاضرين"}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.muted }]}>
          <Feather name="share-2" size={18} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Speakers stage — live seats over our WebSocket */}
      <View style={[styles.stage, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {seats.length === 0 ? (
          <View style={styles.stageEmpty}>
            <Ionicons name="mic-outline" size={22} color={colors.mutedForeground} />
            <Text style={[styles.stageEmptyText, { color: colors.mutedForeground }]}>
              المنصة فارغة — اضغط المايك وكن أول المتحدثين
            </Text>
          </View>
        ) : (
          <View style={styles.speakersGrid}>
            {seats.map((sp) => {
              const isMe = sp.userId === user.id;
              return (
                <View key={sp.userId} style={styles.speakerItem}>
                  <View style={[
                    styles.speakerRing,
                    { borderColor: sp.muted ? "transparent" : colors.primary },
                  ]}>
                    <UserAvatar uri={sp.userAvatar} size={52} />
                  </View>
                  <View style={[
                    styles.micBadge,
                    { backgroundColor: sp.muted ? AMBER : colors.primary, borderColor: colors.card },
                  ]}>
                    <Ionicons name={sp.muted ? "mic-off" : "mic"} size={9} color="#fff" />
                  </View>
                  <Text style={[styles.speakerName, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {isMe ? "أنت" : sp.userName}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
        {stageFull && (
          <Text style={[styles.stageFullText, { color: AMBER }]}>المنصة ممتلئة</Text>
        )}
      </View>

      {/* Chat messages - inverted FlatList */}
      <FlatList
        ref={flatRef}
        data={orderedMessages}
        keyExtractor={(m: ChatMessage) => String(m.id)}
        inverted
        style={styles.chatList}
        contentContainerStyle={styles.chatContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {connected ? "كن أول من يكتب رسالة 👋" : "جارٍ الاتصال..."}
            </Text>
          </View>
        }
        renderItem={({ item }: { item: ChatMessage }) => (
          <View style={styles.msgRow}>
            <TouchableOpacity
              onPress={() => openDm(item)}
              disabled={!item.userId || item.userId === user.id}
              activeOpacity={0.7}
            >
              <UserAvatar uri={item.userAvatar} name={item.userName} size={32} />
            </TouchableOpacity>
            <View style={styles.msgBody}>
              <View style={styles.msgMeta}>
                <Text style={[styles.msgUser, { color: colors.primary }]}>{item.userName}</Text>
                <Text style={[styles.msgTime, { color: colors.mutedForeground }]}>{formatTime(item.createdAt)}</Text>
              </View>
              <View style={[styles.msgBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.msgText, { color: colors.foreground }]}>{item.text}</Text>
              </View>
            </View>
          </View>
        )}
      />

      {/* Bottom controls */}
      <View style={[styles.controls, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: botPad + 8 }]}>
        <TouchableOpacity
          style={[styles.micBtn, {
            backgroundColor: !onMic ? colors.muted : muted ? AMBER : colors.primary,
          }]}
          onPress={onMicPress}
          onLongPress={onMicLongPress}
          delayLongPress={400}
        >
          <Ionicons
            name={!onMic || muted ? "mic-off" : "mic"}
            size={20}
            color={!onMic ? colors.mutedForeground : "#fff"}
          />
        </TouchableOpacity>

        <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="رسالة..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            textAlign="right"
          />
        </View>

        {text.trim() ? (
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary }]}
            onPress={sendMessage}
          >
            <Ionicons name="send" size={18} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.giftBtn]} onPress={() => setGiftOpen(true)}>
            <Ionicons name="gift" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.leaveBtn, { backgroundColor: "#EF444422" }]} onPress={() => router.back()}>
          <Text style={styles.leaveText}>خروج</Text>
        </TouchableOpacity>
      </View>

      {entrance && <EntranceOverlay event={entrance} onDone={clearEntrance} />}
      {gift && <GiftOverlay event={gift} onDone={clearGift} />}

      <GiftPicker
        visible={giftOpen}
        coins={user.coins}
        onClose={() => setGiftOpen(false)}
        onSend={handleSendGift}
      />
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
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1 },
  headerSub: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  roomName: { fontSize: 16, fontWeight: "700" as const },
  listenerCount: { fontSize: 12 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  emptyChat: { paddingVertical: 40, alignItems: "center", transform: [{ scaleY: -1 }] },
  emptyText: { fontSize: 14 },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stage: {
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
  },
  speakersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  speakerItem: {
    alignItems: "center",
    gap: 4,
    width: 70,
    position: "relative",
  },
  speakerRing: {
    borderRadius: 32,
    borderWidth: 2,
    padding: 2,
  },
  micBadge: {
    position: "absolute",
    top: 0,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  speakerName: { fontSize: 11, textAlign: "center" as const },
  stageEmpty: { alignItems: "center", justifyContent: "center", paddingVertical: 14, gap: 6 },
  stageEmptyText: { fontSize: 13, textAlign: "center" as const },
  stageFullText: { fontSize: 12, textAlign: "center" as const, marginTop: 8, fontWeight: "600" as const },
  chatList: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  msgRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  msgBody: { flex: 1, gap: 3 },
  msgMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  msgUser: { fontSize: 12, fontWeight: "700" as const },
  msgTime: { fontSize: 10 },
  msgBubble: {
    borderRadius: 14,
    borderTopLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    alignSelf: "flex-start" as const,
    maxWidth: "90%",
  },
  msgText: { fontSize: 14, lineHeight: 20 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
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
  giftBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
  },
  leaveBtn: {
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "700" as const,
  },
});
