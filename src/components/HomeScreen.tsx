/**
 * Home screen — the address-in, representatives-out flow.
 *
 * States: idle → geocoding → confirm-match → resolving → results | error.
 * The map (SPEC step 5) is secondary to the results list — it renders
 * alongside the cards in the results phase, not as a separate tab
 * (docs/SPEC.md "Decisions made" #4), and highlights whichever district
 * card is focused (SPEC.md user flow #6).
 */

import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AddressInput } from "./AddressInput";
import { ConfirmMatch } from "./ConfirmMatch";
import { ErrorState } from "./ErrorState";
import { Map } from "./Map";
import { ResultsList } from "./ResultsList";
import { colors, geometry } from "../styles/tokens";
import { defaultFetch } from "../lib/net/fetch";
import { isDistrictId, tabGroups } from "../lib/districts/registry";
import {
  geocodeAddress,
  resolveAndLookup,
  type LookupError,
} from "../lib/reps/lookup";
import { asLngLat } from "../lib/geo/types";
import type { DistrictId, TabGroup } from "../lib/districts/types";
import type { GeocodeMatch } from "../lib/geo/geocode";
import type { LookupResult, Office, Official } from "../lib/reps/types";

type State =
  | { phase: "idle" }
  | { phase: "geocoding" }
  | { phase: "confirm"; matches: readonly GeocodeMatch[] }
  | { phase: "resolving" }
  | { phase: "results"; result: LookupResult }
  | { phase: "error"; error: LookupError };

const TAB_GROUPS = tabGroups();

/** An official belongs to a tab if it's the tab's level and either the
 * tab's specific layer, or no layer at all (statewide/citywide offices). */
function belongsToGroup(official: Official, group: TabGroup): boolean {
  const { level, layerId } = official.office;
  if (level !== group.level) return false;
  return layerId === group.layerId || layerId == null;
}

/** The first tab that actually has officials, so a tab is always active. */
function defaultActiveGroup(result: LookupResult): TabGroup {
  for (const group of TAB_GROUPS) {
    if (result.officials.some((o) => belongsToGroup(o, group))) return group;
  }
  return TAB_GROUPS[0] as TabGroup;
}

/** Focus target: which layer to draw, and which of its districts to highlight. */
interface Focus {
  layerId: DistrictId;
  districtNumber: string | null;
}

/** The tab's layer, highlighting the first district-based office in it (if
 * any) so the map isn't just an empty wash. */
function defaultFocusForGroup(
  officials: readonly Official[],
  group: TabGroup,
): Focus {
  const match = officials.find(
    (o) => o.office.layerId === group.layerId && o.office.districtNumber,
  );
  return {
    layerId: group.layerId,
    districtNumber: match?.office.districtNumber ?? null,
  };
}

export function HomeScreen() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [activeKey, setActiveKey] = useState<string>(
    (TAB_GROUPS[0] as TabGroup).key,
  );
  const [focus, setFocus] = useState<Focus | null>(null);

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
    const group = defaultActiveGroup(result);
    setActiveKey(group.key);
    setFocus(defaultFocusForGroup(result.officials, group));
  }

  function handleSelectGroup(group: TabGroup) {
    setActiveKey(group.key);
    if (state.phase === "results") {
      setFocus(defaultFocusForGroup(state.result.officials, group));
    }
  }

  function handleFocusOffice(office: Office) {
    if (office.layerId && isDistrictId(office.layerId)) {
      setFocus({
        layerId: office.layerId,
        districtNumber: office.districtNumber,
      });
    }
  }

  function reset() {
    setState({ phase: "idle" });
    setFocus(null);
  }

  const point = useMemo(() => {
    if (state.phase !== "results") return null;
    const [lng, lat] = state.result.coords;
    return asLngLat(lng, lat);
  }, [state]);

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

      {state.phase === "results" && point ? (
        <>
          <Pressable style={styles.newSearchButton} onPress={reset}>
            <Text style={styles.newSearchButtonText}>New search</Text>
          </Pressable>
          <View style={styles.mapContainer}>
            <Map
              point={point}
              focusedLayerId={focus?.layerId ?? null}
              focusedDistrictNumber={focus?.districtNumber ?? null}
            />
          </View>
          <ResultsList
            result={state.result}
            groups={TAB_GROUPS}
            activeKey={activeKey}
            onSelectGroup={handleSelectGroup}
            focusedLayerId={focus?.layerId ?? null}
            focusedDistrictNumber={focus?.districtNumber ?? null}
            onFocusOffice={handleFocusOffice}
          />
        </>
      ) : null}

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
  newSearchButton: {
    height: 40,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: geometry.rSm,
  },
  newSearchButtonText: {
    color: colors.surface,
    fontWeight: "600",
    fontSize: 14,
  },
  mapContainer: {
    height: 320,
    borderRadius: geometry.r,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  status: {
    fontSize: 14,
    color: colors.muted,
    padding: 16,
  },
});
