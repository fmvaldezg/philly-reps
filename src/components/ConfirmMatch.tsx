/**
 * "Did you mean?" confirmation step. SPEC.md user flow #2: show the match
 * back to the user and let them correct it before results.
 *
 * If there are multiple matches, list them all. If one, show it with a
 * confirm button. The user picks one; the caller proceeds to resolution.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, geometry } from "../styles/tokens";
import type { GeocodeMatch } from "../lib/geo/geocode";

interface ConfirmMatchProps {
  matches: readonly GeocodeMatch[];
  onConfirm: (match: GeocodeMatch) => void;
  onBack: () => void;
}

export function ConfirmMatch({
  matches,
  onConfirm,
  onBack,
}: ConfirmMatchProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Confirm your address</Text>
      <Text style={styles.hint}>
        {matches.length === 1
          ? "Is this the right address?"
          : "We found multiple matches. Which one is yours?"}
      </Text>

      {matches.map((m, i) => (
        <Pressable
          key={`${m.matchedAddress}-${i}`}
          style={styles.matchRow}
          onPress={() => onConfirm(m)}
        >
          <Text style={styles.matchAddress}>{m.matchedAddress}</Text>
          <Text style={styles.matchCoords}>
            {m.coords[0].toFixed(4)}, {m.coords[1].toFixed(4)}
          </Text>
        </Pressable>
      ))}

      <Pressable style={styles.backLink} onPress={onBack}>
        <Text style={styles.backText}>← Try a different address</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  hint: {
    fontSize: 14,
    color: colors.muted,
  },
  matchRow: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: geometry.r,
    backgroundColor: colors.surface,
    gap: 4,
  },
  matchAddress: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "500",
  },
  matchCoords: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: "monospace",
  },
  backLink: {
    paddingVertical: 8,
  },
  backText: {
    color: colors.accentInk,
    fontSize: 14,
  },
});
