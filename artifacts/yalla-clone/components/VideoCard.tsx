import { Feather, Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ImageStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

function Thumbnail({ uri, style }: { uri: string; style: StyleProp<ImageStyle> }) {
  const colors = useColors();
  const [error, setError] = useState(false);
  if (error || !uri) {
    return (
      <View style={[style, { backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }]}>
        <Ionicons name="image-outline" size={32} color={colors.mutedForeground} />
      </View>
    );
  }
  return <Image source={{ uri }} style={style} resizeMode="cover" onError={() => setError(true)} />;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

export interface Video {
  id: string;
  title: string;
  author: string;
  authorAvatar: string;
  thumbnail: string;
  likes: number;
  comments: number;
  views: string;
  duration: string;
}

export function VideoCard({ video }: { video: Video }) {
  const colors = useColors();
  const { likedVideos, toggleLikeVideo } = useApp();
  const liked = likedVideos.has(video.id);

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleLikeVideo(video.id);
  };

  return (
    <View style={[styles.card, { width: CARD_WIDTH }]}>
      <View style={styles.thumbnailContainer}>
        <Thumbnail
          uri={video.thumbnail}
          style={[styles.thumbnail, { backgroundColor: colors.muted }]}
        />
        <View style={styles.duration}>
          <Text style={styles.durationText}>{video.duration}</Text>
        </View>
        <View style={styles.views}>
          <Ionicons name="eye" size={11} color="#fff" />
          <Text style={styles.viewsText}>{video.views}</Text>
        </View>
      </View>
      <View style={[styles.info, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {video.title}
        </Text>
        <View style={styles.bottom}>
          <Text style={[styles.author, { color: colors.mutedForeground }]} numberOfLines={1}>
            {video.author}
          </Text>
          <TouchableOpacity onPress={handleLike} style={styles.likeBtn} activeOpacity={0.8}>
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={16}
              color={liked ? "#EF4444" : colors.mutedForeground}
            />
            <Text style={[styles.likeCount, { color: liked ? "#EF4444" : colors.mutedForeground }]}>
              {liked ? video.likes + 1 : video.likes}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export function VideoCardFull({ video }: { video: Video }) {
  const colors = useColors();
  const { height: SCREEN_HEIGHT, width } = Dimensions.get("window");
  const { likedVideos, toggleLikeVideo } = useApp();
  const liked = likedVideos.has(video.id);

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleLikeVideo(video.id);
  };

  return (
    <View style={{ width, height: SCREEN_HEIGHT, backgroundColor: "#000" }}>
      <Thumbnail uri={video.thumbnail} style={StyleSheet.absoluteFill} />
      <View style={styles.fullOverlay}>
        <View style={styles.fullActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.8}>
            <Ionicons name={liked ? "heart" : "heart-outline"} size={28} color={liked ? "#EF4444" : "#fff"} />
            <Text style={styles.actionText}>{liked ? video.likes + 1 : video.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
            <Feather name="message-circle" size={26} color="#fff" />
            <Text style={styles.actionText}>{video.comments}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
            <Feather name="share-2" size={24} color="#fff" />
            <Text style={styles.actionText}>مشاركة</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.fullInfo}>
          <Text style={styles.fullAuthor}>{video.author}</Text>
          <Text style={styles.fullTitle} numberOfLines={2}>{video.title}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  thumbnailContainer: {
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: CARD_WIDTH * 1.3,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  duration: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  durationText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600" as const,
  },
  views: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  viewsText: {
    color: "#fff",
    fontSize: 10,
  },
  info: {
    padding: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: "600" as const,
    marginBottom: 6,
    lineHeight: 18,
  },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  author: {
    fontSize: 12,
    flex: 1,
  },
  likeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  likeCount: {
    fontSize: 12,
  },
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingBottom: 100,
  },
  fullActions: {
    position: "absolute",
    right: 16,
    bottom: 120,
    gap: 20,
    alignItems: "center",
  },
  actionBtn: {
    alignItems: "center",
    gap: 4,
  },
  actionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  fullInfo: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  fullAuthor: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700" as const,
    marginBottom: 4,
  },
  fullTitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
  },
});
