/**
 * Root layout for Expo Router. Injects the CSS custom properties from the
 * design tokens so the web build can use `var(--accent)` etc.
 */

import { colors, cssCustomProperties } from "../styles/tokens";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssCustomProperties() }} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </>
  );
}
