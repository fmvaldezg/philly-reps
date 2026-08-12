/** @type {import('expo/config').ExpoConfig} */
export default {
  name: "Philly Reps",
  slug: "philly-reps",
  version: "0.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  scheme: "philly-reps",
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/favicon.png",
  },
  // maplibre-react-native has native modules — it needs a prebuilt dev
  // client (expo prebuild), it won't run in plain Expo Go.
  plugins: ["expo-router", "@maplibre/maplibre-react-native"],
  experiments: {
    tsconfigPaths: true,
  },
  // Expo Router: routes live in src/app per AGENTS.md, not the default ./app.
  extra: {
    router: {
      root: "src/app",
    },
  },
};
