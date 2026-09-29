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
  // What the web view paints before the page has drawn anything, and behind
  // it while the system bars are being measured. It was lilac, so a cold
  // start showed a lilac screen and then a pale band under the opening. It is
  // the opening's own dark now, so the handover cannot be seen.
  // Reaches phones only through a new native build, not through a deploy.
  backgroundColor: "#140a2c",
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
    /**
     * Holds the launch screen up until the page says it is ready.
     *
     * The shell loads the live site, so between the system letting go and
     * the first paint there is a stretch with nothing drawn - a blank screen
     * the app could do nothing about, because its own code had not arrived
     * yet. The splash now covers exactly that gap and is dismissed by the
     * page itself, the moment the opening is on screen.
     *
     * launchAutoHide stays on as a backstop: if the page never loads - no
     * network, the error page - the splash clears by itself after eight
     * seconds instead of hanging there for good.
     */
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 8000,
      backgroundColor: "#140a2c",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: false,
    },
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
