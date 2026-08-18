import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// expo-image over RN's Image: it caches, streams progressively and keeps
// memory bounded — this feed scrolls remote photos.
import { Image } from "expo-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListPostsQueryKey,
  getListPostsQueryOptions,
  useDeletePost,
  useOpenConversation,
  useTogglePostLike,
  type Post,
} from "@workspace/api-client-react";
import { UserAvatar } from "@/components/UserAvatar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "أمس" : `منذ ${days} يوم`;
}

function PostImage({ uri, wide }: { uri: string; wide: boolean }) {
  const colors = useColors();
  const [error, setError] = useState(false);
  const style = wide ? styles.postImageSingle : styles.postImageGridItem;
  if (error) {
    return (
      <View
        style={[
          style,
          { backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
        ]}
      >
        <Ionicons name="image-outline" size={36} color={colors.mutedForeground} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="cover"
      transition={180}
      cachePolicy="memory-disk"
      onError={() => setError(true)}
    />
  );
}

interface PostCardProps {
  post: Post;
  isMine: boolean;
  onLike: (post: Post) => void;
  onChat: (post: Post) => void;
  onDelete: (post: Post) => void;
}

function PostCard({ post, isMine, onLike, onChat, onDelete }: PostCardProps) {
  const colors = useColors();

  return (
    <View style={[styles.postCard, { backgroundColor: colors.card }]}>
      <View style={styles.postHeader}>
        <View style={styles.postUser}>
          <UserAvatar uri={post.authorAvatar} name={post.authorName || "مستخدم"} size={42} />
          <View style={styles.postUserInfo}>
            <Text style={[styles.postUserName, { color: colors.foreground }]} numberOfLines={1}>
              {post.authorName || "مستخدم"}
            </Text>
            <View style={styles.postBadges}>
              <View style={styles.lvBadge}>
                <Text style={styles.lvText}>Lv.{post.authorLevel}</Text>
              </View>
              <Text style={[styles.postMeta, { color: colors.mutedForeground }]}>
                {relativeTime(post.createdAt)}
              </Text>
            </View>
          </View>
        </View>
        {isMine ? (
          <TouchableOpacity
            style={[styles.chatBtn, { backgroundColor: "#EF444422" }]}
            onPress={() => onDelete(post)}
          >
            <Ionicons name="trash-outline" size={17} color="#EF4444" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.chatBtn, { backgroundColor: colors.primary }]}
            onPress={() => onChat(post)}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        )}
      </View>

      {!!post.text && (
        <Text style={[styles.postText, { color: colors.foreground }]}>{post.text}</Text>
      )}

      {post.images.length === 1 ? (
        <PostImage uri={post.images[0]} wide />
      ) : post.images.length > 1 ? (
        <View style={styles.postImageGrid}>
          {post.images.map((img, i) => (
            <PostImage key={`${img}-${i}`} uri={img} wide={false} />
          ))}
        </View>
      ) : null}

      {!!post.tag && (
        <View style={[styles.postTag, { backgroundColor: colors.secondary }]}>
          <Text style={styles.hashTag}>#</Text>
          <Text style={[styles.postTagText, { color: colors.mutedForeground }]}>{post.tag}</Text>
        </View>
      )}

      <View style={styles.postFooter}>
        <TouchableOpacity style={styles.actionItem} onPress={() => onLike(post)} activeOpacity={0.8}>
          <Ionicons
            name={post.likedByMe ? "heart" : "heart-outline"}
            size={19}
            color={post.likedByMe ? "#EC4899" : colors.mutedForeground}
          />
          <Text
            style={[
              styles.actionCount,
              { color: post.likedByMe ? "#EC4899" : colors.mutedForeground },
            ]}
          >
            {post.likeCount}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MomentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user: me } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const postsQ = useQuery(getListPostsQueryOptions());
  const likeM = useTogglePostLike();
  const deleteM = useDeletePost();
  const openConversationM = useOpenConversation();

  const refresh = () => qc.invalidateQueries({ queryKey: getListPostsQueryKey() });

  const handleLike = async (post: Post) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await likeM.mutateAsync({ id: post.id });
      refresh();
    } catch {
      Alert.alert("خطأ", "تعذّر تسجيل الإعجاب");
    }
  };

  const handleChat = async (post: Post) => {
    if (post.userId === me.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const conv = await openConversationM.mutateAsync({
        data: {
          otherUserId: post.userId,
          otherName: post.authorName,
          otherAvatar: post.authorAvatar,
        },
      });
      router.push(
        `/dm/${conv.id}?otherUserId=${encodeURIComponent(conv.otherUserId)}&otherName=${encodeURIComponent(conv.otherName || post.authorName)}&otherAvatar=${encodeURIComponent(conv.otherAvatar || post.authorAvatar)}`,
      );
    } catch {
      Alert.alert("خطأ", "تعذّر فتح المحادثة");
    }
  };

  const handleDelete = (post: Post) => {
    Alert.alert("حذف المنشور", "هل تريد حذف هذا المنشور؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteM.mutateAsync({ id: post.id });
            refresh();
          } catch {
            Alert.alert("خطأ", "تعذّر حذف المنشور");
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>اللحظات</Text>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/post-create")}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newBtnText}>نشر</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={postsQ.data ?? []}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{
          paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 90,
          paddingHorizontal: 12,
          gap: 12,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={postsQ.isFetching && !postsQ.isLoading}
            onRefresh={() => postsQ.refetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          postsQ.isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="images-outline" size={38} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                ما كو لحظات بعد{"\n"}كن أول من ينشر!
              </Text>
              <TouchableOpacity
                style={[styles.newBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/post-create")}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.newBtnText}>نشر لحظة</Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            isMine={item.userId === me.id}
            onLike={handleLike}
            onChat={handleChat}
            onDelete={handleDelete}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  title: { fontSize: 22, fontWeight: "800" as const },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  newBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" as const },
  postCard: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  postUser: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  postUserInfo: { gap: 3, flex: 1 },
  postUserName: { fontSize: 15, fontWeight: "700" as const },
  postBadges: { flexDirection: "row", alignItems: "center", gap: 6 },
  lvBadge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: "rgba(139,92,246,0.22)",
  },
  lvText: { fontSize: 11, fontWeight: "700" as const, color: "#C4B5FD" },
  postMeta: { fontSize: 11 },
  chatBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  postText: { fontSize: 15, lineHeight: 22 },
  postImageSingle: {
    width: "100%",
    height: 220,
    borderRadius: 12,
  },
  postImageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  postImageGridItem: {
    width: "48%",
    height: 130,
    borderRadius: 10,
  },
  postTag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 2,
  },
  hashTag: { color: "#7C5CFC", fontSize: 12, fontWeight: "700" as const },
  postTagText: { fontSize: 12 },
  postFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  actionItem: { flexDirection: "row", alignItems: "center", gap: 5, padding: 4 },
  actionCount: { fontSize: 13, fontWeight: "600" as const },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingVertical: 60,
  },
  emptyText: { fontSize: 15, textAlign: "center" as const, lineHeight: 24 },
});
