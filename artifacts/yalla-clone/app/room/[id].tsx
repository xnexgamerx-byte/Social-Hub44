import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
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
import { UserAvatar } from "@/components/UserAvatar";
import { LiveBadge } from "@/components/LiveBadge";
import { ROOMS } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useRoomChat, type ChatMessage } from "@/hooks/useRoomChat";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const MOCK_SPEAKERS = [
  { id: "s1", name: "سارة", avatar: "https://i.pravatar.cc/150?img=5", speaking: true },
  { id: "s2", name: "محمد", avatar: "https://i.pravatar.cc/150?img=12", speaking: false },
  { id: "s3", name: "فارس", avatar: "https://i.pravatar.cc/150?img=21", speaking: false },
  { id: "s4", name: "نور", avatar: "https://i.pravatar.cc/150?img=40", speaking: true },
  { id: "s5", name: "ريم", avatar: "https://i.pravatar.cc/150?img=44", speaking: false },
  { id: "s6", name: "عمر", avatar: "https://i.pravatar.cc/150?img=50", speaking: false },
];

export default function RoomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const room = ROOMS.find((r) => r.id === id) ?? ROOMS[0];

  const { messages, presence, connected, sendMessage: emitMessage } = useRoomChat(id);
  const [text, setText] = useState("");
  const [micOn, setMicOn] = useState(false);
  const flatRef = useRef<FlatList>(null);

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
            {room.name}
          </Text>
          <View style={styles.headerSub}>
            {room.isLive && <LiveBadge small />}
            <View style={[styles.onlineDot, { backgroundColor: connected ? "#22C55E" : colors.mutedForeground }]} />
            <Text style={[styles.listenerCount, { color: colors.mutedForeground }]}>
              {presence > 0 ? `${presence} متصل الآن` : `${room.listenerCount} مستمع`}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.muted }]}>
          <Feather name="share-2" size={18} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Speakers stage */}
      <View style={[styles.stage, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.speakersGrid}>
          {MOCK_SPEAKERS.map((sp) => (
            <View key={sp.id} style={styles.speakerItem}>
              <View style={[
                styles.speakerRing,
                { borderColor: sp.speaking ? colors.primary : "transparent" }
              ]}>
                <UserAvatar uri={sp.avatar} size={52} />
              </View>
              {sp.speaking && (
                <View style={[styles.speakingDot, { backgroundColor: colors.primary }]} />
              )}
              <Text style={[styles.speakerName, { color: colors.mutedForeground }]} numberOfLines={1}>
                {sp.name}
              </Text>
            </View>
          ))}
        </View>
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
            <UserAvatar uri={item.userAvatar} size={32} />
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
          style={[styles.micBtn, { backgroundColor: micOn ? colors.primary : colors.muted }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setMicOn((p) => !p); }}
        >
          <Ionicons name={micOn ? "mic" : "mic-off"} size={20} color={micOn ? "#fff" : colors.mutedForeground} />
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

        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.muted }]}
          onPress={sendMessage}
          disabled={!text.trim()}
        >
          <Ionicons name="send" size={18} color={text.trim() ? "#fff" : colors.mutedForeground} style={{ transform: [{ scaleX: -1 }] }} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.leaveBtn, { backgroundColor: "#EF444422" }]} onPress={() => router.back()}>
          <Text style={styles.leaveText}>خروج</Text>
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
  speakingDot: {
    position: "absolute",
    top: 2,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  speakerName: { fontSize: 11, textAlign: "center" as const },
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
