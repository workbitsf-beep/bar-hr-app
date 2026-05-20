export type GeolocationSample = {
  latitude: number;
  longitude: number;
  accuracy: number;
  sampleCount: number;
};

type GeolocationWatchCallbacks = {
  onSample: (sample: GeolocationSample) => void;
  onError?: (error: GeolocationPositionError | Error) => void;
  onLowAccuracy?: (accuracy: number) => void;
};

const MAX_ACCEPTED_ACCURACY_METERS = 15;
const GEOLOCATION_TIMEOUT_MS = 5000;

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: GEOLOCATION_TIMEOUT_MS,
  maximumAge: 0,
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinel>;
  };
};

function createPreciseGeolocationError() {
  return new Error("Unable to acquire a precise GPS fix");
}

function createScreenWakeLockController() {
  let sentinel: WakeLockSentinel | null = null;
  let released = false;

  async function acquire() {
    if (released || typeof document === "undefined") {
      return;
    }

    const wakeLockApi = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLockApi || sentinel) {
      return;
    }

    try {
      sentinel = await wakeLockApi.request("screen");
      sentinel.addEventListener("release", () => {
        sentinel = null;
      });
    } catch {
      sentinel = null;
    }
  }

  async function release() {
    released = true;

    if (!sentinel) {
      return;
    }

    try {
      await sentinel.release();
    } catch {
      // Ignore release errors from unsupported browsers or transient OS state.
    } finally {
      sentinel = null;
    }
  }

  async function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      await acquire();
      return;
    }

    await release();
    released = false;
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  return {
    async start() {
      await acquire();
    },
    async stop() {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }

      await release();
    },
  };
}

function toSample(position: GeolocationPosition, sampleCount: number): GeolocationSample {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    sampleCount,
  };
}

export function startPreciseGeolocationWatch({
  onSample,
  onError,
  onLowAccuracy,
}: GeolocationWatchCallbacks) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError?.(new Error("Geolocation unavailable"));
    return () => undefined;
  }

  let active = true;
  let watchId: number | null = null;
  let sampleCount = 0;
  let restartTimer: number | null = null;
  const wakeLock = createScreenWakeLockController();

  const clearRestartTimer = () => {
    if (restartTimer !== null) {
      window.clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const scheduleRestart = (restart: () => void) => {
    clearRestartTimer();
    restartTimer = window.setTimeout(() => {
      if (!active) {
        return;
      }

      restart();
    }, GEOLOCATION_TIMEOUT_MS);
  };

  const startWatch = () => {
    if (!active) {
      return;
    }

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!active) {
          return;
        }

        sampleCount += 1;
        const sample = toSample(position, sampleCount);

        if (sample.accuracy > MAX_ACCEPTED_ACCURACY_METERS) {
          onLowAccuracy?.(sample.accuracy);
          scheduleRestart(startWatch);
          return;
        }

        onSample(sample);
        scheduleRestart(startWatch);
      },
      (error) => {
        if (!active) {
          return;
        }

        if (error.code === error.TIMEOUT) {
          scheduleRestart(startWatch);
          return;
        }

        onError?.(error);
        scheduleRestart(startWatch);
      },
      GEOLOCATION_OPTIONS
    );

    scheduleRestart(startWatch);
  };

  void wakeLock.start();
  startWatch();

  // Keeps GPS tracking live with high-accuracy settings and restarts quickly
  // if the browser stops delivering a fresh precise fix.
  return () => {
    active = false;
    clearRestartTimer();

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }

    void wakeLock.stop();
  };
}

export function getBestAccuracyPosition(options?: {
  maxWaitMs?: number;
  onLowAccuracy?: (accuracy: number) => void;
}): Promise<GeolocationSample> {
  const maxWaitMs = Math.max(GEOLOCATION_TIMEOUT_MS, options?.maxWaitMs ?? 20000);

  return new Promise((resolve, reject) => {
    let settled = false;
    let stopWatch: () => void = () => undefined;

    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      stopWatch();
      reject(createPreciseGeolocationError());
    }, maxWaitMs);

    const settle = (handler: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      stopWatch();
      handler();
    };

    // One-shot acquisition built on top of watchPosition so we never consume
    // browser-cached coordinates and we can reject weak GPS fixes in real time.
    stopWatch = startPreciseGeolocationWatch({
      onSample(sample) {
        settle(() => resolve(sample));
      },
      onError(error) {
        settle(() => reject(error));
      },
      onLowAccuracy(accuracy) {
        options?.onLowAccuracy?.(accuracy);
      },
    });
  });
}

export { GEOLOCATION_OPTIONS, GEOLOCATION_TIMEOUT_MS, MAX_ACCEPTED_ACCURACY_METERS };
