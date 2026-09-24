import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The app is server rendered, so the native shell points at the live site
 * rather than bundling a copy. Anything we deploy reaches installed apps
 * immediately, without going through a store release.
 *
 * appId becomes the Android package name and the iOS bundle id. It cannot be
 * changed once the app is published, so it stays as it is from here on.
 */
// errorPath is read by the native runtime but missing from Capacitor's
// published types, so it is declared here rather than silenced with a cast.
const config: CapacitorConfig & { errorPath?: string } = {
  appId: "it.workbit.app",
  appName: "Workbit",
  webDir: "capacitor-web",
  backgroundColor: "#f7f3ff",
  // Shown instead of the system's grey network error when the site cannot be
  // reached. Capacitor loads it by itself on a failed main-frame load.
  errorPath: "index.html",
  server: {
    url: "https://app.workbit.it",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // A web view has no passkey support of its own, so the plugin stands in for
    // it and forwards to the phone's own credential manager. The domain named
    // here has to be the one the passkeys were registered against, and the same
    // one that serves .well-known/assetlinks.json.
    CapacitorPasskey: {
      origin: "https://app.workbit.it",
      domains: ["app.workbit.it"],
      autoShim: true,
    },
  },
};

export default config;
