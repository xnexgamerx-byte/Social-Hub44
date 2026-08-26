import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface QueryErrorProps {
  /** What failed, in the user's terms. */
  message?: string;
  onRetry?: () => void;
}

/**
 * Shown when a query fails. Without this a failed fetch renders the same empty
 * state as "there is nothing here", so the user is told a lie and has no way
 * to retry.
 */
export function QueryError({
  message = "تعذّر تحميل البيانات. تحقق من اتصالك بالإنترنت.",
  onRetry,
}: QueryErrorProps) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      <Ionicons name="cloud-offline-outline" size={38} color={colors.mutedForeground} />
      <Text style={[styles.text, { color: colors.mutedForeground }]}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.secondary }]}
          onPress={onRetry}
        >
          <Text style={[styles.btnText, { color: colors.primary }]}>إعادة المحاولة</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: 44, gap: 12 },
  text: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center" as const,
    maxWidth: 280,
  },
  btn: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 9 },
  btnText: { fontSize: 13, fontWeight: "700" as const },
});
