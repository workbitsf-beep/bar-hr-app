import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The app is server rendered, so the native shell points at the live site
 * rather than bundling a copy. Anything we deploy reaches installed apps
 * immediately, without going through a store release.
 *
 * appId becomes the Android package name and the iOS bundle id. It cannot be
 * changed once the app is published, so it stays as it is from here on.
 */
const config: CapacitorConfig = {
  appId: "it.workbit.app",
  appName: "Workbit",
  webDir: "capacitor-web",
  backgroundColor: "#f7f3ff",
  server: {
    url: "https://app.workbit.it",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
