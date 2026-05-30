import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VideoCard, VideoCardFull } from "@/components/VideoCard";
import { VIDEOS } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

const MODES = ["grid", "feed"] as const;
const { width: W, height: H } = Dimensions.get("window");

export default function VideosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"grid" | "feed">("grid");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (mode === "feed") {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <View style={[styles.feedHeader, { top: topPad }]}>
          <TouchableOpacity onPress={() => setMode("grid")} style={styles.backBtn}>
            <Feather name="grid" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.feedTitle}>فيديوهات</Text>
          <View style={{ width: 40 }} />
        </View>
        <FlatList
          data={VIDEOS}
          keyExtractor={(v) => v.id}
          pagingEnabled
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <VideoCardFull video={item} />}
          getItemLayout={(_, index) => ({ length: H, offset: H * index, index })}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>فيديوهات</Text>
        <TouchableOpacity onPress={() => setMode("feed")} style={[styles.feedBtn, { borderColor: colors.border }]}>
          <Feather name="play-circle" size={18} color={colors.primary} />
          <Text style={[styles.feedBtnText, { color: colors.primary }]}>وضع التصفح</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={VIDEOS}
        keyExtractor={(v) => v.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <VideoCard video={item} />}
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
    paddingBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: "800" as const,
  },
  feedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  feedBtnText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  row: {
    gap: 12,
  },
  feedHeader: {
    position: "absolute",
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    left: 0,
    right: 0,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
  },
  feedTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700" as const,
  },
});
