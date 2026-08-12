/**
 * Expo Router entry. The index route renders the home screen.
 * Web-only for now; native routing comes when the map lands (step 5).
 */

import { HomeScreen } from "../components/HomeScreen";

export default function Index() {
  return <HomeScreen />;
}
