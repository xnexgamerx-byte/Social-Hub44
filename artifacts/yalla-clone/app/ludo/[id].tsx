import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
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
import { EntranceOverlay } from "@/components/EntranceOverlay";
import { GiftOverlay } from "@/components/GiftOverlay";
import { GiftPicker, type GiftItem } from "@/components/GiftPicker";
import { DieFace, LudoBoard, LUDO_HEX, LUDO_LABEL } from "@/components/LudoBoard";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useLudoSession, type LudoMode, type LudoPlayer } from "@/hooks/useLudoSession";
import { useRoomChat, type ChatMessage } from "@/hooks/useRoomChat";
import { useRoomGifts } from "@/hooks/useRoomGifts";
import { useRoomVoice } from "@/hooks/useRoomVoice";

const AMBER = "#F5B400";

/** Seat card shown around the board. */
function SeatCard({
  player,
  isTurn,
  isMe,
  onMic,
  muted,
  compact,
}: {
  player: LudoPlayer;
  isTurn: boolean;
  isMe: boolean;
  onMic: boolean;
  muted: boolean;
  compact: boolean;
}) {
  const colors = useColors();
  const hex = LUDO_HEX[player.color];
  return (
    <View
      style={[
        styles.seat,
        {
          backgroundColor: colors.card,
          borderColor: isTurn ? hex : colors.border,
          borderWidth: isTurn ? 2 : 1,
          flex: compact ? 1 : 0,
        },
      ]}
    >
      <View style={styles.seatAvatarWrap}>
        <View style={[styles.seatRing, { borderColor: hex }]}>
          <UserAvatar uri={player.userAvatar} name={player.userName} size={30} />
        </View>
        {onMic && (
          <View style={[styles.micDot, { backgroundColor: muted ? AMBER : "#22C55E" }]}>
            <Ionicons name={muted ? "mic-off" : "mic"} size={8} color="#fff" />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.seatName, { color: colors.foreground }]} numberOfLines={1}>
          {isMe ? "أنت" : player.userName || "لاعب"}
        </Text>
        <View style={styles.seatMetaRow}>
          <View style={[styles.seatChip, { backgroundColor: hex + "22" }]}>
            <Text style={[styles.seatChipText, { color: hex }]}>{player.finished}/4</Text>
          </View>
          {isTurn && (
            <Text style={[styles.seatTurn, { color: hex }]}>دوره</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function LudoScreen() {
  const { id, mode: modeParam } = useLocalSearchParams<{ id: string; mode?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, refreshWallet } = useApp();

  const mode: LudoMode = modeParam === "2" ? 2 : 4;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const me = useMemo(
    () => ({ userId: user.id, userName: user.name, userAvatar: user.avatar }),
    [user.id, user.name, user.avatar],
  );

  const { state, lastDice, error, connected, start, roll, move, clearError } =
    useLudoSession(id, me, mode);

  // The table doubles as a room, so the proven chat / gift / mic stack works
  // here unchanged — keyed to a room id derived from the game.
  const socialRoomId = id ? `ludo:${id}` : undefined;
  const { messages, sendMessage: emitMessage } = useRoomChat(socialRoomId, me);
  const { seats, onMic, muted, stageFull, takeMic, leaveMic, setMuted } = useRoomVoice(
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

  // Flatten every seated player's tokens for the board, tagging the ones the
  // current player may legally move right now.
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
    const w = Dimensions.get("window").width - 24;
    const h = Dimensions.get("window").height;
    return Math.min(w, h * 0.42);
  }, []);

  const micSeatFor = useCallback(
    (userId: string) => seats.find((s) => s.userId === userId),
    [seats],
  );

  const handleRoll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    roll();
  };

  const handleTokenPress = (color: string, index: number) => {
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

  const statusText = (() => {
    if (!connected) return "جارٍ الاتصال...";
    if (state?.phase === "lobby") {
      return `${players.length}/${state.maxPlayers} لاعبين — بانتظار البدء`;
    }
    if (state?.phase === "playing") {
      if (canMove) return "اختر قطعة لتحريكها";
      return isMyTurn ? "دورك — ارمِ النرد" : `دور ${state.turn ? LUDO_LABEL[state.turn] : ""}`;
    }
    if (state?.phase === "ended") {
      return state.winner ? `🏆 فاز ${LUDO_LABEL[state.winner]}` : "انتهت اللعبة";
    }
    return "";
  })();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
    >
      {/* Header */}
      <LinearGradient
        colors={["#2A0E6B", "#4C1D95"]}
        style={[styles.header, { paddingTop: topPad + 10 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>لودو</Text>
            {/* The table id is the invite code friends type on the games screen. */}
            <View style={styles.codePill}>
              <Ionicons name="key" size={10} color="#FFD75E" />
              <Text style={styles.codeText}>{id}</Text>
            </View>
          </View>
          <Text style={styles.headerSub}>
            {(state?.maxPlayers ?? mode) === 2 ? "مواجهة ثنائية" : "طاولة رباعية"} ·{" "}
            {players.length}/{state?.maxPlayers ?? mode}
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <View style={[styles.dot, { backgroundColor: connected ? "#4ADE80" : "#9CA3AF" }]} />
          <Text style={styles.headerBadgeText}>{statusText}</Text>
        </View>
      </LinearGradient>

      {error && (
        <View style={styles.errorBar}>
          <Ionicons name="alert-circle" size={15} color="#fff" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {stageFull && (
        <View style={[styles.errorBar, { backgroundColor: AMBER }]}>
          <Text style={styles.errorText}>المنصة ممتلئة</Text>
        </View>
      )}

      {/* Seats */}
      <View style={styles.seatsRow}>
        {players.map((p) => {
          const seat = micSeatFor(p.userId);
          return (
            <SeatCard
              key={p.userId}
              player={p}
              isTurn={state?.turn === p.color}
              isMe={p.userId === user.id}
              onMic={!!seat}
              muted={seat?.muted ?? false}
              compact={players.length > 2}
            />
          );
        })}
        {players.length === 0 && (
          <Text style={[styles.waiting, { color: colors.mutedForeground }]}>
            جارٍ الانضمام للطاولة...
          </Text>
        )}
      </View>

      {/* Board */}
      <View style={styles.boardWrap}>
        <LudoBoard
          size={boardSize}
          tokens={boardTokens}
          seated={seatedColors}
          onTokenPress={handleTokenPress}
        />
      </View>

      {/* Dice + primary action */}
      <View style={styles.controlRow}>
        <DieFace value={state?.dice ?? null} size={46} />
        {state?.phase === "lobby" ? (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: players.length >= 2 ? AMBER : colors.muted },
            ]}
            onPress={start}
            disabled={players.length < 2}
            activeOpacity={0.85}
          >
            <Ionicons
              name="play"
              size={18}
              color={players.length >= 2 ? "#fff" : colors.mutedForeground}
            />
            <Text
              style={[
                styles.actionText,
                { color: players.length >= 2 ? "#fff" : colors.mutedForeground },
              ]}
            >
              {players.length >= 2 ? "ابدأ اللعبة" : "بانتظار لاعب آخر"}
            </Text>
          </TouchableOpacity>
        ) : state?.phase === "ended" ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Ionicons name="trophy" size={18} color="#fff" />
            <Text style={styles.actionText}>العودة للألعاب</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: canRoll ? AMBER : colors.muted }]}
            onPress={handleRoll}
            disabled={!canRoll}
            activeOpacity={0.85}
          >
            <Ionicons
              name="dice"
              size={20}
              color={canRoll ? "#fff" : colors.mutedForeground}
            />
            <Text
              style={[styles.actionText, { color: canRoll ? "#fff" : colors.mutedForeground }]}
            >
              {canMove ? "اختر قطعة" : isMyTurn ? "ارمِ النرد" : "بانتظار دورك"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {lastDice && state?.phase === "playing" && (
        <Text style={[styles.diceLog, { color: colors.mutedForeground }]}>
          {LUDO_LABEL[lastDice.color]} رمى {lastDice.dice}
          {lastDice.forfeit ? " — ثلاث ستات! فقد الدور" : ""}
        </Text>
      )}

      {/* Chat */}
      <View style={[styles.chatWrap, { borderTopColor: colors.border }]}>
        <FlatList
          data={orderedMessages}
          keyExtractor={(m: ChatMessage) => String(m.id)}
          inverted
          style={styles.chatList}
          contentContainerStyle={styles.chatContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={[styles.chatEmpty, { color: colors.mutedForeground }]}>
              شجّع خصمك أو ارسله هدية 🎁
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.msgRow}>
              <Text style={[styles.msgUser, { color: colors.primary }]}>{item.userName}: </Text>
              <Text style={[styles.msgText, { color: colors.foreground }]}>{item.text}</Text>
            </View>
          )}
        />
      </View>

      {/* Composer */}
      <View
        style={[
          styles.composer,
          { borderTopColor: colors.border, paddingBottom: botPad + 8 },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.roundBtn,
            { backgroundColor: !onMic ? colors.muted : muted ? AMBER : "#22C55E" },
          ]}
          onPress={onMicPress}
          onLongPress={() => onMic && leaveMic()}
          delayLongPress={400}
        >
          <Ionicons
            name={!onMic || muted ? "mic-off" : "mic"}
            size={18}
            color={!onMic ? colors.mutedForeground : "#fff"}
          />
        </TouchableOpacity>

        <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

        {text.trim() ? (
          <TouchableOpacity
            style={[styles.roundBtn, { backgroundColor: colors.primary }]}
            onPress={send}
          >
            <Ionicons name="send" size={17} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.roundBtn, { backgroundColor: AMBER }]}
            onPress={() => setGiftOpen(true)}
          >
            <Ionicons name="gift" size={18} color="#fff" />
          </TouchableOpacity>
        )}
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
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 10,
  },
  iconBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "800" as const },
  codePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  codeText: {
    color: "#FFD75E",
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 1,
  },
  headerSub: { color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 2 },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 170,
  },
  headerBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" as const, flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#EF4444",
    paddingVertical: 7,
  },
  errorText: { color: "#fff", fontSize: 12, fontWeight: "700" as const },
  seatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  seat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 140,
  },
  seatAvatarWrap: { position: "relative" },
  seatRing: { borderWidth: 2, borderRadius: 20, padding: 2 },
  micDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  seatName: { fontSize: 13, fontWeight: "700" as const },
  seatMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  seatChip: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  seatChipText: { fontSize: 10, fontWeight: "800" as const },
  seatTurn: { fontSize: 10, fontWeight: "800" as const },
  waiting: { fontSize: 13, textAlign: "center" as const, flex: 1, paddingVertical: 12 },
  boardWrap: { alignItems: "center", paddingVertical: 4 },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 24,
    paddingVertical: 13,
  },
  actionText: { color: "#fff", fontSize: 15, fontWeight: "800" as const },
  diceLog: { fontSize: 11, textAlign: "center" as const, paddingTop: 6 },
  chatWrap: { flex: 1, borderTopWidth: 1, marginTop: 8, minHeight: 60 },
  chatList: { flex: 1 },
  chatContent: { paddingHorizontal: 14, paddingVertical: 8, gap: 4 },
  chatEmpty: {
    fontSize: 12,
    textAlign: "center" as const,
    paddingVertical: 14,
    transform: [{ scaleY: -1 }],
  },
  msgRow: { flexDirection: "row", flexWrap: "wrap" },
  msgUser: { fontSize: 12, fontWeight: "800" as const },
  msgText: { fontSize: 12, flexShrink: 1 },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  roundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flex: 1,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 38,
    justifyContent: "center",
  },
  input: { fontSize: 13 },
});
