/**
 * Results list — one tab per TabGroup (SPEC.md user flow #5), each
 * color-coded via LevelTabs. The active tab's cards render below it.
 * `focusedLayerId`/`focusedDistrictNumber`/`onFocusOffice` thread through to
 * each card so tapping one highlights its district on the map (SPEC.md user
 * flow #6); switching tabs does the same via `onSelectGroup` (HomeScreen
 * picks a default office for the newly active tab).
 *
 * An official belongs to a tab if it's that tab's level and either that
 * tab's specific layer (district-based offices) or no layer at all
 * (statewide/citywide offices, which have no single district to disambiguate
 * on — they show on every tab for their level).
 */

import { StyleSheet, Text, View } from "react-native";

import { colors, geometry } from "../styles/tokens";
import { LevelTabs } from "./LevelTabs";
import { OfficialCard } from "./OfficialCard";
import type { TabGroup } from "../lib/districts/types";
import type { LookupResult, Office, Official } from "../lib/reps/types";

interface ResultsListProps {
  result: LookupResult;
  groups: readonly TabGroup[];
  activeKey: string;
  onSelectGroup: (group: TabGroup) => void;
  focusedLayerId?: string | null | undefined;
  focusedDistrictNumber?: string | null | undefined;
  onFocusOffice?: ((office: Office) => void) | undefined;
}

export function ResultsList({
  result,
  groups,
  activeKey,
  onSelectGroup,
  focusedLayerId,
  focusedDistrictNumber,
  onFocusOffice,
}: ResultsListProps) {
  const counts: Record<string, number> = {};
  for (const group of groups) {
    counts[group.key] = result.officials.filter((o) =>
      belongsToGroup(o, group),
    ).length;
  }
  const activeGroup = groups.find((g) => g.key === activeKey);
  const activeOfficials = activeGroup
    ? result.officials.filter((o) => belongsToGroup(o, activeGroup))
    : [];

  return (
    <View style={styles.wrap}>
      <View style={styles.matchedWrap}>
        <Text style={styles.matchedLabel}>Showing representatives for</Text>
        <Text style={styles.matchedAddress}>{result.matchedAddress}</Text>
      </View>

      {result.officials.length > 0 ? (
        <LevelTabs
          groups={groups}
          counts={counts}
          activeKey={activeKey}
          onSelect={onSelectGroup}
        />
      ) : null}

      <View style={styles.section}>
        {activeOfficials.map((o) => (
          <OfficialCard
            key={o.office.id}
            official={o}
            focused={
              o.office.layerId != null &&
              o.office.layerId === focusedLayerId &&
              o.office.districtNumber === focusedDistrictNumber
            }
            onFocus={onFocusOffice}
          />
        ))}
      </View>

      {result.officials.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            District boundaries resolved, but representative contact data is not
            available yet. This will be added in a later step.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function belongsToGroup(official: Official, group: TabGroup): boolean {
  const { level, layerId } = official.office;
  if (level !== group.level) return false;
  return layerId === group.layerId || layerId == null;
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  matchedWrap: {
    gap: 4,
  },
  matchedLabel: {
    fontSize: 12,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  matchedAddress: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "500",
  },
  section: {
    gap: 12,
  },
  empty: {
    padding: 16,
    backgroundColor: colors.surfaceAlt,
    borderRadius: geometry.r,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
});
