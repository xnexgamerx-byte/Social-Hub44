import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const CARD_RADIUS = 14;

interface SettingsGroupProps {
  /** Small grey label above the card. */
  title?: string;
  children: React.ReactNode;
}

/**
 * A titled card holding a run of rows, separated by inset hairlines so the
 * group reads as one surface. Use for rows that need no explanation.
 */
export function SettingsGroup({ title, children }: SettingsGroupProps) {
  const colors = useColors();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {title ? (
        <Text style={[styles.groupTitle, { color: colors.mutedForeground }]}>{title}</Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 ? (
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            ) : null}
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Column wrapper for standalone rows, keeping the spacing consistent. */
export function SettingsStack({ title, children }: SettingsGroupProps) {
  const colors = useColors();
  return (
    <View style={styles.group}>
      {title ? (
        <Text style={[styles.groupTitle, { color: colors.mutedForeground }]}>{title}</Text>
      ) : null}
      <View style={styles.stack}>{children}</View>
    </View>
  );
}

interface SettingsRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Explanatory line. Sits under the label, or under the card when standalone. */
  hint?: string;
  /** Right-aligned current value, for rows that open a picker. */
  value?: string;
  onPress?: () => void;
  /** Present makes the row a switch; `onSwitchChange` is then required. */
  switchValue?: boolean;
  onSwitchChange?: (next: boolean) => void;
  /**
   * Greys the row out and blocks interaction. `disabledReason` replaces the
   * hint — a switch the user cannot move must say why, otherwise it reads as
   * a bug rather than a decision.
   */
  disabled?: boolean;
  disabledReason?: string;
  destructive?: boolean;
  /** Marks the row as the chosen option in a group of choices. */
  selected?: boolean;
  /**
   * Renders the row as its own card with the hint below it, matching how the
   * reference app lays out settings that each need a sentence of explanation.
   */
  standalone?: boolean;
}

export function SettingsRow({
  icon,
  label,
  hint,
  value,
  onPress,
  switchValue,
  onSwitchChange,
  disabled = false,
  disabledReason,
  destructive = false,
  selected,
  standalone = false,
}: SettingsRowProps) {
  const colors = useColors();
  const isSwitch = switchValue !== undefined;
  const labelColor = destructive
    ? colors.destructive
    : disabled
      ? colors.mutedForeground
      : colors.foreground;
  const subtitle = disabled ? (disabledReason ?? hint) : hint;

  const body = (
    <View style={styles.row}>
      {icon ? (
        <Ionicons
          name={icon}
          size={20}
          color={
            destructive
              ? colors.destructive
              : disabled
                ? colors.mutedForeground
                : colors.primary
          }
        />
      ) : null}

      <View style={styles.labelCol}>
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        {/* Standalone rows carry their explanation below the card instead. */}
        {subtitle && !standalone ? (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>

      {isSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          disabled={disabled}
          trackColor={{ false: colors.muted, true: colors.primary }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={colors.muted}
        />
      ) : (
        <View style={styles.tail}>
          {value ? (
            <Text style={[styles.value, { color: colors.mutedForeground }]} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          {selected !== undefined ? (
            <Ionicons
              name="checkmark"
              size={20}
              color={selected ? colors.primary : "transparent"}
            />
          ) : null}
          {onPress && selected === undefined ? (
            // chevron-back points right-to-left, which is "forward" in Arabic.
            <Ionicons name="chevron-back" size={17} color={colors.mutedForeground} />
          ) : null}
        </View>
      )}
    </View>
  );

  // A switch handles its own interaction; wrapping it in a touchable too would
  // give the row two conflicting tap targets.
  const interactive = onPress && !isSwitch && !disabled;
  const pressable = interactive ? (
    <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
      {body}
    </TouchableOpacity>
  ) : (
    body
  );

  if (!standalone) return pressable;

  return (
    <View style={styles.standaloneWrap}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>{pressable}</View>
      {subtitle ? (
        <Text style={[styles.hintBelow, { color: colors.mutedForeground }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 9 },
  groupTitle: {
    fontSize: 12.5,
    fontWeight: "600" as const,
    paddingHorizontal: 6,
    textAlign: "right" as const,
  },
  stack: { gap: 14 },
  card: { borderRadius: CARD_RADIUS, overflow: "hidden" },
  // Inset from the trailing edge so the hairline starts under the label,
  // the way grouped lists are conventionally drawn.
  divider: { height: StyleSheet.hairlineWidth, marginStart: 16 },
  standaloneWrap: { gap: 7 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    minHeight: 54,
    paddingVertical: 13,
  },
  labelCol: { flex: 1, gap: 3, alignItems: "flex-end" },
  label: { fontSize: 15, fontWeight: "500" as const, textAlign: "right" as const },
  hint: { fontSize: 12, lineHeight: 17, textAlign: "right" as const },
  hintBelow: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "right" as const,
    paddingHorizontal: 6,
  },
  tail: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "45%" },
  value: { fontSize: 14, flexShrink: 1, textAlign: "left" as const },
});
