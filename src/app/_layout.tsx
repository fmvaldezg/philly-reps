/**
 * Root layout for Expo Router. Injects the CSS custom properties from the
 * design tokens so the web build can use `var(--accent)` etc.
 */

import { colors, cssCustomProperties } from "../styles/tokens";
import { Stack } from "expo-router";
import Head from "expo-router/head";

export default function RootLayout() {
  return (
    <>
      <Head>
        {/* iOS Safari's "Add to Home Screen" ignores the regular favicon
            and only looks for apple-touch-icon — without this it
            screenshots the page instead. */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>
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
