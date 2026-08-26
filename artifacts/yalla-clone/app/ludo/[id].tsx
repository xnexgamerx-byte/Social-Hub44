import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
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
import { EntranceOverlay } from "@/components/EntranceOverlay";
import { GiftOverlay } from "@/components/GiftOverlay";
import { GiftPicker, type GiftItem } from "@/components/GiftPicker";
import { DieFace, LudoBoard, LUDO_HEX, LUDO_LABEL } from "@/components/LudoBoard";
import { useApp } from "@/context/AppContext";
import { useLudoSession, type LudoMode, type LudoPlayer } from "@/hooks/useLudoSession";
import { useRoomChat, type ChatMessage } from "@/hooks/useRoomChat";
import { useRoomGifts } from "@/hooks/useRoomGifts";
import { useRoomVoice } from "@/hooks/useRoomVoice";
import type { LudoColor } from "@/lib/ludoBoard";

const GOLD = "#F5C242";
const PANEL = "rgba(255,255,255,0.10)";
const PANEL_LINE = "rgba(255,255,255,0.18)";

/**
 * Seats sit at the board corner matching their colour's yard, the way a
 * physical table reads: you look at a corner and know whose it is.
 */
const CORNER_STYLE: Record<LudoColor, "topLeft" | "topRight" | "bottomLeft" | "bottomRight"> = {
  red: "topLeft",
  green: "topRight",
  yellow: "bottomRight",
  blue: "bottomLeft",
};

function SeatChip({
  player,
  isTurn,
  isMe,
  micMuted,
  onMic,
}: {
  player: LudoPlayer;
  isTurn: boolean;
  isMe: boolean;
  micMuted: boolean;
  onMic: boolean;
}) {
  const hex = LUDO_HEX[player.color];
  return (
    <View style={[styles.seatChip, isTurn && { borderColor: GOLD, backgroundColor: "rgba(245,194,66,0.18)" }]}>
      <View style={[styles.seatAvatar, { borderColor: hex }]}>
        <UserAvatar uri={player.userAvatar} name={player.userName} size={28} />
        {onMic && (
          <View style={[styles.micDot, { backgroundColor: micMuted ? GOLD : "#34D399" }]}>
            <Ionicons name={micMuted ? "mic-off" : "mic"} size={7} color="#1B0B3B" />
          </View>
        )}
      </View>
      <View style={styles.seatText}>
        <Text style={styles.seatName} numberOfLines={1}>
          {isMe ? "أنت" : player.userName || "لاعب"}
        </Text>
        <View style={styles.seatMeta}>
          <View style={[styles.seatDot, { backgroundColor: hex }]} />
          <Text style={styles.seatCount}>{player.finished}/4</Text>
        </View>
      </View>
    </View>
  );
}

export default function LudoScreen() {
  const {
    id,
    mode: modeParam,
    teams: teamsParam,
  } = useLocalSearchParams<{ id: string; mode?: string; teams?: string }>();
  const insets = useSafeAreaInsets();
  const { user, refreshWallet } = useApp();

  const mode: LudoMode = modeParam === "2" ? 2 : 4;
  const teams = teamsParam === "1";
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const botPad = Platform.OS === "web" ? 20 : insets.bottom;

  const me = useMemo(
    () => ({ userId: user.id, userName: user.name, userAvatar: user.avatar }),
    [user.id, user.name, user.avatar],
  );

  const { state, lastDice, error, connected, start, roll, move, clearError } =
    useLudoSession(id, me, mode, teams);

  // The table doubles as a room, so the room chat / gift / mic stack works here
  // unchanged — no parallel systems.
  const socialRoomId = id ? `ludo:${id}` : undefined;
  const { messages, sendMessage: emitMessage } = useRoomChat(socialRoomId, me);
  const { seats, onMic, muted, stageFull, voiceError, takeMic, leaveMic, setMuted } = useRoomVoice(
    socialRoomId,
    me,
  );
  const { gift, entrance, sendGift, clearGift, clearEntrance } = useRoomGifts(
    socialRoomId,
    useCallback(() => refreshWallet(), [refreshWallet]),
    useCallback((message: string) => Alert.alert("الهدية", message), []),
  );

  const [text, setText] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (error) {
      const t = setTimeout(clearError, 2500);
      return () => clearTimeout(t);
    }
  }, [error, clearError]);

  const players = state?.players ?? [];
  const seatedColors = useMemo(() => players.map((p) => p.color), [players]);
  const myColor = players.find((p) => p.userId === user.id)?.color ?? null;
  const isMyTurn = !!myColor && state?.turn === myColor;
  const canRoll = state?.phase === "playing" && isMyTurn && !state.awaitingMove && state.dice == null;
  const canMove = state?.phase === "playing" && isMyTurn && state.awaitingMove;

  const boardTokens = useMemo(
    () =>
      players.flatMap((p) =>
        p.tokens.map((pos, index) => ({
          color: p.color,
          index,
          pos,
          movable: !!canMove && p.color === myColor && !!state?.movable.includes(index),
        })),
      ),
    [players, canMove, myColor, state?.movable],
  );

  const boardSize = useMemo(() => {
    const { width, height } = Dimensions.get("window");
    return Math.min(width - 20, height * 0.46);
  }, []);

  const micSeat = useCallback(
    (userId: string) => seats.find((s) => s.userId === userId),
    [seats],
  );

  const handleRoll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    roll();
  };

  const handleTokenPress = (color: LudoColor, index: number) => {
    if (!canMove || color !== myColor) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    move(index);
  };

  const onMicPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!onMic) takeMic();
    else setMuted(!muted);
  };

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    emitMessage({ ...me, text: trimmed });
    setText("");
  };

  const handleSendGift = (item: GiftItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendGift({ ...me, itemId: item.id });
    setGiftOpen(false);
  };

  const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const banner = (() => {
    if (!connected) return "جارٍ الاتصال...";
    if (state?.phase === "lobby") return `بانتظار اللاعبين ${players.length}/${state.maxPlayers}`;
    if (state?.phase === "playing") {
      if (canMove) return "اختر قطعة لتحريكها";
      return isMyTurn ? "دورك — ارمِ النرد" : `دور ${state.turn ? LUDO_LABEL[state.turn] : ""}`;
    }
    if (state?.phase === "ended") {
      return state.winner ? `فاز ${LUDO_LABEL[state.winner]} 🏆` : "انتهت اللعبة";
    }
    return "";
  })();

  const cornerFor = (p: LudoPlayer) => styles[CORNER_STYLE[p.color]];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#1B0B3B", "#2D1160", "#1B0B3B"]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {state?.teams ?? teams
                  ? "فرق"
                  : (state?.maxPlayers ?? mode) === 2
                    ? "ثنائي"
                    : "كلاسيك"}
              </Text>
            </View>
            <View style={styles.tag}>
              <Ionicons name="key" size={10} color={GOLD} />
              <Text style={[styles.tagText, { color: GOLD }]}>{id}</Text>
            </View>
          </View>
          <View style={[styles.statusDot, { backgroundColor: connected ? "#34D399" : "#9CA3AF" }]} />
        </View>

        {/* Turn banner */}
        <View style={styles.bannerWrap}>
          <LinearGradient
            colors={["rgba(124,92,252,0.35)", "rgba(124,92,252,0.12)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.banner}
          >
            <DieFace value={state?.dice ?? null} size={30} />
            <Text style={styles.bannerText} numberOfLines={1}>
              {banner}
            </Text>
          </LinearGradient>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
        {stageFull && <Text style={styles.errorText}>المنصة ممتلئة</Text>}
      {voiceError ? <Text style={styles.errorText}>{voiceError}</Text> : null}

        {/* Board with seats pinned to matching corners */}
        <View style={styles.stage}>
          <View style={{ width: boardSize, height: boardSize }}>
            <LudoBoard
              size={boardSize}
              tokens={boardTokens}
              seated={seatedColors}
              onTokenPress={handleTokenPress}
            />
          </View>
          {players.map((p) => {
            const seat = micSeat(p.userId);
            return (
              <View key={p.userId} style={[styles.corner, cornerFor(p)]}>
                <SeatChip
                  player={p}
                  isTurn={state?.turn === p.color}
                  isMe={p.userId === user.id}
                  onMic={!!seat}
                  micMuted={seat?.muted ?? false}
                />
              </View>
            );
          })}
        </View>

        {/* Primary action */}
        <View style={styles.actionWrap}>
          {state?.phase === "lobby" ? (
            <TouchableOpacity
              style={[styles.rollBtn, players.length < 2 && styles.rollBtnOff]}
              onPress={start}
              disabled={players.length < 2}
              activeOpacity={0.85}
            >
              <Ionicons name="play" size={19} color={players.length >= 2 ? "#2A1508" : "#9CA3AF"} />
              <Text style={[styles.rollText, players.length < 2 && { color: "#9CA3AF" }]}>
                {players.length >= 2 ? "ابدأ اللعبة" : "بانتظار لاعب آخر"}
              </Text>
            </TouchableOpacity>
          ) : state?.phase === "ended" ? (
            <TouchableOpacity style={styles.rollBtn} onPress={() => router.back()} activeOpacity={0.85}>
              <Ionicons name="trophy" size={19} color="#2A1508" />
              <Text style={styles.rollText}>العودة</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.rollBtn, !canRoll && styles.rollBtnOff]}
              onPress={handleRoll}
              disabled={!canRoll}
              activeOpacity={0.85}
            >
              <Ionicons name="dice" size={21} color={canRoll ? "#2A1508" : "#9CA3AF"} />
              <Text style={[styles.rollText, !canRoll && { color: "#9CA3AF" }]}>
                {canMove ? "اختر قطعة" : isMyTurn ? "ارمِ النرد" : "بانتظار دورك"}
              </Text>
            </TouchableOpacity>
          )}
          {lastDice && state?.phase === "playing" && (
            <Text style={styles.diceLog}>
              {LUDO_LABEL[lastDice.color]} رمى {lastDice.dice}
              {lastDice.forfeit ? " — ثلاث ستات! فقد الدور" : ""}
            </Text>
          )}
        </View>

        {/* Latest chat line, tap to open the full thread */}
        <TouchableOpacity
          style={styles.tickerWrap}
          activeOpacity={0.8}
          onPress={() => setChatOpen(true)}
        >
          <Ionicons name="chatbubble-ellipses" size={13} color="rgba(255,255,255,0.6)" />
          <Text style={styles.tickerText} numberOfLines={1}>
            {orderedMessages[0]
              ? `${orderedMessages[0].userName}: ${orderedMessages[0].text}`
              : "اضغط للدردشة مع اللاعبين"}
          </Text>
        </TouchableOpacity>

        {/* Bottom controls */}
        <View style={[styles.dock, { paddingBottom: botPad + 10 }]}>
          <TouchableOpacity
            style={[
              styles.dockBtn,
              { backgroundColor: !onMic ? PANEL : muted ? "rgba(245,194,66,0.85)" : "rgba(52,211,153,0.85)" },
            ]}
            onPress={onMicPress}
            onLongPress={() => onMic && leaveMic()}
            delayLongPress={400}
          >
            <Ionicons name={!onMic || muted ? "mic-off" : "mic"} size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: PANEL }]}
            onPress={() => setChatOpen(true)}
          >
            <Ionicons name="chatbubbles" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: "rgba(245,194,66,0.9)" }]}
            onPress={() => setGiftOpen(true)}
          >
            <Ionicons name="gift" size={20} color="#2A1508" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Chat sheet */}
      <Modal visible={chatOpen} animationType="slide" transparent onRequestClose={() => setChatOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={styles.flex} activeOpacity={1} onPress={() => setChatOpen(false)} />
          <KeyboardAvoidingView behavior="padding">
            <View style={[styles.sheet, { paddingBottom: botPad + 10 }]}>
              <View style={styles.sheetHandle} />
              <FlatList
                data={orderedMessages}
                keyExtractor={(m: ChatMessage) => String(m.id)}
                inverted
                style={styles.sheetList}
                contentContainerStyle={{ padding: 14, gap: 8 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <Text style={styles.sheetEmpty}>شجّع خصمك أو أرسله هدية 🎁</Text>
                }
                renderItem={({ item }) => (
                  <View style={styles.msgRow}>
                    <UserAvatar uri={item.userAvatar} name={item.userName} size={24} />
                    <View style={styles.msgBubble}>
                      <Text style={styles.msgUser}>{item.userName}</Text>
                      <Text style={styles.msgText}>{item.text}</Text>
                    </View>
                  </View>
                )}
              />
              <View style={styles.sheetComposer}>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="رسالة..."
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={text}
                    onChangeText={setText}
                    onSubmitEditing={send}
                    returnKeyType="send"
                    textAlign="right"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.dockBtn, { backgroundColor: text.trim() ? "#7C5CFC" : PANEL }]}
                  onPress={send}
                  disabled={!text.trim()}
                >
                  <Ionicons name="send" size={17} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {entrance && <EntranceOverlay event={entrance} onDone={clearEntrance} />}
      {gift && <GiftOverlay event={gift} onDone={clearGift} />}

      <GiftPicker
        visible={giftOpen}
        coins={user.coins}
        onClose={() => setGiftOpen(false)}
        onSend={handleSendGift}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1B0B3B" },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 10,
  },
  iconBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  tagRow: { flex: 1, flexDirection: "row", gap: 7 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: PANEL_LINE,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tagText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  bannerWrap: { paddingHorizontal: 14, paddingTop: 4 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PANEL_LINE,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerText: { color: "#fff", fontSize: 13, fontWeight: "700" as const, flex: 1 },
  errorText: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "700" as const,
    textAlign: "center" as const,
    paddingTop: 6,
  },
  stage: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    position: "relative",
  },
  corner: { position: "absolute" },
  topLeft: { top: 0, left: 6 },
  topRight: { top: 0, right: 6 },
  bottomLeft: { bottom: 0, left: 6 },
  bottomRight: { bottom: 0, right: 6 },
  seatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(20,8,48,0.82)",
    borderWidth: 1.5,
    borderColor: PANEL_LINE,
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 5,
    maxWidth: 132,
  },
  seatAvatar: { borderWidth: 2, borderRadius: 18, padding: 1, position: "relative" },
  micDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 13,
    height: 13,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  seatText: { flexShrink: 1 },
  seatName: { color: "#fff", fontSize: 11, fontWeight: "800" as const },
  seatMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  seatDot: { width: 6, height: 6, borderRadius: 3 },
  seatCount: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700" as const },
  actionWrap: { alignItems: "center", gap: 6, paddingHorizontal: 20 },
  rollBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: GOLD,
    borderRadius: 26,
    paddingVertical: 13,
    paddingHorizontal: 34,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  rollBtnOff: { backgroundColor: "rgba(255,255,255,0.12)" },
  rollText: { color: "#2A1508", fontSize: 15, fontWeight: "800" as const },
  diceLog: { color: "rgba(255,255,255,0.6)", fontSize: 11 },
  tickerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
    marginHorizontal: 14,
    backgroundColor: PANEL,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tickerText: { color: "rgba(255,255,255,0.75)", fontSize: 12, flex: 1 },
  dock: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    paddingTop: 12,
  },
  dockBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: PANEL_LINE,
  },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(10,4,26,0.6)" },
  sheet: {
    backgroundColor: "#241145",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: 420,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignSelf: "center",
    marginTop: 10,
  },
  sheetList: { maxHeight: 280 },
  sheetEmpty: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    textAlign: "center" as const,
    paddingVertical: 30,
    transform: [{ scaleY: -1 }],
  },
  msgRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  msgBubble: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    borderTopLeftRadius: 3,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexShrink: 1,
  },
  msgUser: { color: "#C4B5FD", fontSize: 11, fontWeight: "800" as const },
  msgText: { color: "#fff", fontSize: 13, marginTop: 1 },
  sheetComposer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: PANEL_LINE,
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  input: { color: "#fff", fontSize: 14 },
});
