/**
 * Results tabs — one per TabGroup (src/lib/districts/registry.ts). Usually
 * one tab per level (Federal / City); a level with more than one district
 * layer (State: Senate + House) gets one tab per layer instead, so each tab
 * always maps to exactly one map layer. Color-coded by level, but color is
 * never the only signal — every tab also carries its text label.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, levelColor } from "../styles/tokens";
import type { TabGroup } from "../lib/districts/types";

interface LevelTabsProps {
  groups: readonly TabGroup[];
  counts: Readonly<Record<string, number>>;
  activeKey: string;
  onSelect: (group: TabGroup) => void;
}

export function LevelTabs({
  groups,
  counts,
  activeKey,
  onSelect,
}: LevelTabsProps) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {groups.map((group) => {
        const count = counts[group.key] ?? 0;
        if (count === 0) return null;
        const isActive = group.key === activeKey;
        const color = levelColor(group.level);

        return (
          <Pressable
            key={group.key}
            onPress={() => onSelect(group)}
            style={[styles.tab, isActive ? { borderBottomColor: color } : null]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[styles.label, isActive ? { color: colors.text } : null]}
            >
              {group.label}
            </Text>
            <View style={[styles.badge, { backgroundColor: color }]}>
              <Text style={styles.badgeText}>{count}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.muted,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.surface,
  },
});
