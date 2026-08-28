import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface SearchBarProps {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** Fires when the user submits, for callers that search on demand. */
  onSubmit?: () => void;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  onSubmit,
  autoFocus,
}: SearchBarProps) {
  const colors = useColors();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Ionicons name="search" size={17} color={colors.mutedForeground} />
      <TextInput
        style={[styles.input, { color: colors.foreground }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        textAlign="right"
      />
      {value.length > 0 ? (
        <TouchableOpacity onPress={() => onChange("")} hitSlop={10} accessibilityLabel="مسح">
          <Ionicons name="close-circle" size={17} color={colors.mutedForeground} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  input: { flex: 1, fontSize: 14.5, padding: 0 },
});
