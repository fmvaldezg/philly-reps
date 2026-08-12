/**
 * Home screen — the address-in, representatives-out flow.
 *
 * States: idle → geocoding → confirm-match → resolving → results | error.
 * No map yet (step 5). Web only for now.
 */

import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AddressInput } from "./AddressInput";
import { ConfirmMatch } from "./ConfirmMatch";
import { ErrorState } from "./ErrorState";
import { ResultsList } from "./ResultsList";
import { colors } from "../styles/tokens";
import { defaultFetch } from "../lib/net/fetch";
import {
  geocodeAddress,
  resolveAndLookup,
  type LookupError,
} from "../lib/reps/lookup";
import type { GeocodeMatch } from "../lib/geo/geocode";
import type { LookupResult } from "../lib/reps/types";

type State =
  | { phase: "idle" }
  | { phase: "geocoding" }
  | { phase: "confirm"; matches: readonly GeocodeMatch[] }
  | { phase: "resolving" }
  | { phase: "results"; result: LookupResult }
  | { phase: "error"; error: LookupError };

export function HomeScreen() {
  const [state, setState] = useState<State>({ phase: "idle" });

  async function handleSearch(address: string) {
    setState({ phase: "geocoding" });
    const r = await geocodeAddress(address, defaultFetch);
    if (!r.ok) {
      setState({ phase: "error", error: r.error });
      return;
    }
    if (r.value.matches.length === 0) {
      setState({ phase: "error", error: { kind: "no-match" } });
      return;
    }
    setState({ phase: "confirm", matches: r.value.matches });
  }

  async function handleConfirm(match: GeocodeMatch) {
    setState({ phase: "resolving" });
    const result = await resolveAndLookup(match);
    setState({ phase: "results", result });
  }

  function reset() {
    setState({ phase: "idle" });
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Philly Reps</Text>
        <Text style={styles.subtitle}>
          Find your elected representatives at every level of government.
        </Text>
      </View>

      {state.phase === "idle" || state.phase === "geocoding" ? (
        <AddressInput
          onSubmit={handleSearch}
          busy={state.phase === "geocoding"}
        />
      ) : null}

      {state.phase === "confirm" ? (
        <ConfirmMatch
          matches={state.matches}
          onConfirm={handleConfirm}
          onBack={reset}
        />
      ) : null}

      {state.phase === "resolving" ? (
        <Text style={styles.status}>Resolving districts…</Text>
      ) : null}

      {state.phase === "results" ? <ResultsList result={state.result} /> : null}

      {state.phase === "error" ? (
        <ErrorState error={state.error} onRetry={reset} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    maxWidth: 640,
    width: "100%",
    marginHorizontal: "auto",
    padding: 16,
    gap: 24,
    paddingBottom: 48,
  },
  header: {
    paddingTop: 16,
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: colors.muted,
  },
  status: {
    fontSize: 14,
    color: colors.muted,
    padding: 16,
  },
});
