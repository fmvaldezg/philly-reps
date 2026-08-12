/**
 * Error state for the lookup flow. Renders a plain explanation per error kind.
 * No jargon, no stack traces — the user needs to know what to do next.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, geometry } from "../styles/tokens";
import type { LookupError } from "../lib/reps/lookup";

interface ErrorStateProps {
  error: LookupError;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const { title, body } = explain(error);

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <Pressable style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

function explain(error: LookupError): { title: string; body: string } {
  switch (error.kind) {
    case "no-match":
      return {
        title: "We couldn't find that address",
        body: "Check the spelling and make sure it's a Philadelphia address. You can omit the ZIP code, but the street number and name are required.",
      };
    case "out-of-bounds":
      return {
        title: "That address is outside Philadelphia",
        body: "This app covers only addresses inside the Philadelphia city limits. If you think this is wrong, try re-entering your address.",
      };
    case "network":
      return {
        title: "Network problem",
        body: "We couldn't reach the address lookup service. Check your connection and try again.",
      };
    case "http":
      return {
        title: "The lookup service had a problem",
        body: `The address service returned an error (status ${error.status}). Try again in a moment.`,
      };
    case "malformed":
      return {
        title: "Unexpected response",
        body: "The address service returned data we couldn't read. Try again, or try a different address.",
      };
  }
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  card: {
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: geometry.r,
    borderLeftWidth: 4,
    borderLeftColor: colors.warn,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  body: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  button: {
    height: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: geometry.rSm,
    alignSelf: "flex-start",
  },
  buttonText: {
    color: colors.surface,
    fontWeight: "600",
    fontSize: 16,
  },
});
