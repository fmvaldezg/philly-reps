/**
 * Address input — single text field, autocomplete off.
 * SPEC.md user flow #1: "One text field, autocomplete off".
 */

import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, geometry } from "../styles/tokens";

interface AddressInputProps {
  /** Called when the user submits an address. */
  onSubmit: (address: string) => void;
  /** Disable while a request is in flight. */
  busy?: boolean;
}

export function AddressInput({ onSubmit, busy }: AddressInputProps) {
  const [value, setValue] = useState("");

  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        placeholder="Enter your Philadelphia address"
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={setValue}
        autoComplete="off"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => {
          if (value.trim().length > 0 && !busy) onSubmit(value.trim());
        }}
        editable={!busy}
      />
      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        disabled={busy || value.trim().length === 0}
        onPress={() => onSubmit(value.trim())}
      >
        <Text style={styles.buttonText}>Find my representatives</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch",
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: geometry.rSm,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
  },
  button: {
    height: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: geometry.rSm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.surface,
    fontWeight: "600",
    fontSize: 16,
  },
});
