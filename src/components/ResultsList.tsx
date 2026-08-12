/**
 * Results list — groups officials by level (Federal → State → City).
 * SPEC.md user flow #5: "grouped by level (Federal → State → City), each
 * card = office, name, party, district number, contact methods, verified date".
 *
 * Iterates the district registry for layer labels — does not hardcode layer
 * names. When no rep data is available yet (step 7), shows a placeholder
 * per resolved district explaining the office exists but has no contact data.
 */

import { StyleSheet, Text, View } from "react-native";

import { colors, geometry, levelColor } from "../styles/tokens";
import { OfficialCard } from "./OfficialCard";
import type { DistrictLevel } from "../lib/districts/types";
import type { LookupResult } from "../lib/reps/types";
import type { Official } from "../lib/reps/types";

interface ResultsListProps {
  result: LookupResult;
}

const LEVEL_ORDER: DistrictLevel[] = ["federal", "state", "city"];
const LEVEL_LABELS: Record<DistrictLevel, string> = {
  federal: "Federal",
  state: "State",
  city: "City",
};

export function ResultsList({ result }: ResultsListProps) {
  const byLevel = groupByLevel(result.officials);

  return (
    <View style={styles.wrap}>
      <View style={styles.matchedWrap}>
        <Text style={styles.matchedLabel}>Showing representatives for</Text>
        <Text style={styles.matchedAddress}>{result.matchedAddress}</Text>
      </View>

      {LEVEL_ORDER.map((level) => {
        const officials = byLevel[level] ?? [];
        if (officials.length === 0) return null;
        return (
          <View key={level} style={styles.section}>
            <View
              style={[
                styles.sectionHeader,
                { borderLeftColor: levelColor(level) },
              ]}
            >
              <Text style={styles.sectionTitle}>{LEVEL_LABELS[level]}</Text>
              <Text style={styles.sectionCount}>{officials.length}</Text>
            </View>
            {officials.map((o) => (
              <OfficialCard key={o.office.id} official={o} />
            ))}
          </View>
        );
      })}

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

function groupByLevel(
  officials: readonly Official[],
): Record<DistrictLevel, Official[]> {
  const out: Record<DistrictLevel, Official[]> = {
    federal: [],
    state: [],
    city: [],
  };
  for (const o of officials) out[o.office.level].push(o);
  return out;
}

const styles = StyleSheet.create({
  wrap: {
    gap: 24,
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    borderLeftWidth: 4,
    paddingLeft: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  sectionCount: {
    fontSize: 14,
    color: colors.muted,
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
