/**
 * Address input — single text field, autocomplete off, plus "use my
 * location". SPEC.md user flow #1: "One text field, autocomplete off, plus
 * 'use my location'".
 */

import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, geometry } from "../styles/tokens";

interface AddressInputProps {
  /** Called when the user submits an address. */
  onSubmit: (address: string) => void;
  /** Called when the user taps "Use my location" instead. */
  onUseLocation?: (() => void) | undefined;
  /** Disable while a geocode request is in flight. */
  busy?: boolean;
  /** Disable while a location request is in flight. */
  locating?: boolean;
}

export function AddressInput({
  onSubmit,
  onUseLocation,
  busy,
  locating,
}: AddressInputProps) {
  const [value, setValue] = useState("");
  const disabled = Boolean(busy || locating);

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
          if (value.trim().length > 0 && !disabled) onSubmit(value.trim());
        }}
        editable={!disabled}
      />
      <Pressable
        style={[styles.button, disabled && styles.buttonDisabled]}
        disabled={disabled || value.trim().length === 0}
        onPress={() => onSubmit(value.trim())}
      >
        <Text style={styles.buttonText}>Find my representatives</Text>
      </Pressable>

      {onUseLocation ? (
        <Pressable
          style={styles.locationLink}
          disabled={disabled}
          onPress={onUseLocation}
          accessibilityRole="button"
        >
          <Text style={styles.locationLinkText}>
            {locating ? "Finding your location…" : "Use my location instead"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  input: {
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
  locationLink: {
    paddingVertical: 8,
    alignSelf: "center",
  },
  locationLinkText: {
    color: colors.accentInk,
    fontSize: 14,
    fontWeight: "500",
  },
});
