import { Feather, Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { POSTS, type Post } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

const TABS = ["موصى به", "متابَعون"];

const HOT_TOPICS = [
  "لحظات الحياة",
  "محظوظ للدردشة",
  "الطعام اليوم",
  "موسيقى",
  "سفر",
];

function PostCard({ post }: { post: Post }) {
  const colors = useColors();
  const [liked, setLiked] = useState(false);

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLiked((p) => !p);
  };

  return (
    <View style={[styles.postCard, { backgroundColor: colors.card }]}>
      <View style={styles.postHeader}>
        <View style={styles.postUser}>
          <View style={styles.postAvatarContainer}>
            <Image source={{ uri: post.avatar }} style={styles.postAvatar} />
            {post.isOnline && <View style={styles.postOnlineDot} />}
          </View>
          <View style={styles.postUserInfo}>
            <View style={styles.postNameRow}>
              <Text style={[styles.postUserName, { color: colors.foreground }]}>{post.user}</Text>
            </View>
            <View style={styles.postBadges}>
              <View style={styles.lvBadge}>
                <Text style={styles.lvText}>Lv.{post.level}</Text>
              </View>
              {post.isVip && (
                <View style={styles.vipBadge}>
                  <Text style={styles.vipText}>VIP</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <TouchableOpacity style={[styles.chatBtn, { backgroundColor: colors.primary }]}>
          <Ionicons name="chatbubble-ellipses" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      {post.images.length === 1 ? (
        <Image
          source={{ uri: post.images[0] }}
          style={styles.postImageSingle}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.postImageGrid}>
          {post.images.map((img, i) => (
            <Image key={i} source={{ uri: img }} style={styles.postImageHalf} resizeMode="cover" />
          ))}
        </View>
      )}

      <View style={[styles.postTag, { backgroundColor: colors.secondary }]}>
        <Text style={styles.hashTag}>#</Text>
        <Text style={[styles.postTagText, { color: colors.mutedForeground }]}>{post.tag}</Text>
      </View>

      <View style={styles.postFooter}>
        <Text style={[styles.postMeta, { color: colors.mutedForeground }]}>
          {post.time} · {post.distance}
        </Text>
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionItem} activeOpacity={0.8}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={handleLike} activeOpacity={0.8}>
            <Ionicons name={liked ? "thumbs-up" : "thumbs-up-outline"} size={18} color={liked ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{liked ? post.likes + 1 : post.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} activeOpacity={0.8}>
            <Feather name="edit-2" size={16} color={colors.mutedForeground} />
            <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{post.comments}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function MovementScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View style={styles.tabs}>
          {TABS.map((t, i) => (
            <TouchableOpacity key={t} onPress={() => setActiveTab(i)} style={styles.tabBtn} activeOpacity={0.8}>
              <View style={styles.tabLabelRow}>
                <Text style={[styles.tabLabel, { color: i === activeTab ? colors.foreground : colors.mutedForeground, fontWeight: i === activeTab ? "700" : "400" }]}>
                  {t}
                </Text>
                {i === 1 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>12</Text>
                  </View>
                )}
              </View>
              {i === activeTab && <View style={[styles.tabUnder, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.secondary }]}>
          <Ionicons name="camera-outline" size={19} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={POSTS}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{
          paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 90,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={[styles.hotTopics, { backgroundColor: colors.card }]}>
            <Text style={[styles.hotTitle, { color: colors.foreground }]}>المواضيع الساخنة</Text>
            {HOT_TOPICS.slice(0, 3).map((topic) => (
              <TouchableOpacity key={topic} style={styles.topicRow} activeOpacity={0.7}>
                <View style={styles.topicLeft}>
                  <Text style={[styles.topicHash, { color: colors.primary }]}>#</Text>
                  <Text style={[styles.topicText, { color: colors.foreground }]}>{topic}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  tabs: { flexDirection: "row", gap: 24 },
  tabBtn: { alignItems: "center", paddingBottom: 8 },
  tabLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  tabLabel: { fontSize: 17 },
  tabUnder: { height: 3, width: "100%", borderRadius: 2, marginTop: 4 },
  badge: {
    backgroundColor: "#FF6B9D",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" as const },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  hotTopics: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    gap: 2,
  },
  hotTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    marginBottom: 8,
  },
  topicRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  topicLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  topicHash: { fontSize: 14, fontWeight: "700" as const },
  topicText: { fontSize: 14 },
  postCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    paddingTop: 14,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  postUser: { flexDirection: "row", alignItems: "center", gap: 10 },
  postAvatarContainer: { position: "relative" },
  postAvatar: { width: 46, height: 46, borderRadius: 23 },
  postOnlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#fff",
  },
  postUserInfo: { gap: 4 },
  postNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  postUserName: { fontSize: 15, fontWeight: "700" as const },
  postBadges: { flexDirection: "row", gap: 5 },
  lvBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(139,92,246,0.22)",
  },
  lvText: { fontSize: 10, fontWeight: "700" as const, color: "#C4B5FD" },
  vipBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(245,158,11,0.18)",
  },
  vipText: { fontSize: 10, fontWeight: "700" as const, color: "#FCD34D" },
  chatBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  postImageSingle: {
    width: "100%",
    height: 200,
  },
  postImageGrid: {
    flexDirection: "row",
    height: 160,
    gap: 2,
  },
  postImageHalf: { flex: 1 },
  postTag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start" as const,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 2,
  },
  hashTag: { color: "#7C5CFC", fontSize: 12, fontWeight: "700" as const },
  postTagText: { fontSize: 12 },
  postFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  postMeta: { fontSize: 12 },
  postActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  actionItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionCount: { fontSize: 13 },
});
