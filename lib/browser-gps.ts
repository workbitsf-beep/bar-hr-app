import { calculateDistance } from "./gps";
import { isNativeApp } from "./native-app";

type PositionWatch = { stop: () => void };

/**
 * Inside the installed app the position comes from the device's own location
 * service, asked explicitly for satellite-grade accuracy. A web view answers
 * instead with a battery-saving estimate built from cell towers and Wi-Fi,
 * which is what left clock-in readings tens of metres out.
 *
 * Only the source changes. Accuracy thresholds, repeated samples and the rest
 * of the logic downstream are untouched, and a browser keeps the old path.
 */
function startPositionWatch(
  onPosition: (position: GeolocationPosition) => void,
  onWatchError: (error: GeolocationPositionError) => void,
  options: PositionOptions
): PositionWatch {
  if (!isNativeApp()) {
    const id = navigator.geolocation.watchPosition(onPosition, onWatchError, options);
    return { stop: () => navigator.geolocation.clearWatch(id) };
  }

  let stopped = false;
  let release: (() => void) | null = null;

  const useBrowserSource = () => {
    const id = navigator.geolocation.watchPosition(onPosition, onWatchError, options);
    release = () => navigator.geolocation.clearWatch(id);
  };

  void (async () => {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");

      const id = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: options.timeout,
          maximumAge: options.maximumAge,
        },
        (position, error) => {
          if (stopped) {
            return;
          }

          if (error || !position) {
            onWatchError({
              code: 2,
              message: error ? String(error) : "Posizione non disponibile",
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError);
            return;
          }

          onPosition(position as unknown as GeolocationPosition);
        }
      );

      release = () => void Geolocation.clearWatch({ id });

      if (stopped) {
        release();
      }
    } catch {
      // The plugin is unreachable for some reason; a coarse position beats none.
      if (!stopped) {
        useBrowserSource();
      }
    }
  })();

  return {
    stop: () => {
      stopped = true;
      release?.();
      release = null;
    },
  };
}

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
  maximumAgeMs?: number;
  stopAfterFirstSample?: boolean;
};

const MIN_SAMPLE_COUNT = 2;
const TARGET_SAMPLE_COUNT = 5;
const IDEAL_ACCURACY_METERS = 35;
const LOW_ACCURACY_WARNING_METERS = 80;
const MAX_ACCEPTABLE_ACCURACY_METERS = 250;
const GEOLOCATION_TIMEOUT_MS = 15000;
const GEOLOCATION_BATCH_WAIT_MS = 22000;
const DEFAULT_GEOLOCATION_MAXIMUM_AGE_MS = 30000;
const LARGE_JUMP_METERS = 750;

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: GEOLOCATION_TIMEOUT_MS,
  maximumAge: DEFAULT_GEOLOCATION_MAXIMUM_AGE_MS,
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinel>;
  };
};

function createPreciseGeolocationError() {
  return new Error("Unable to acquire a reliable GPS fix");
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
      // Ignore wake lock release issues from unsupported browsers.
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

function scoreSample(sample: GeolocationSample, samples: GeolocationSample[]) {
  const distances = samples
    .filter((candidate) => candidate !== sample)
    .map((candidate) =>
      calculateDistance(
        sample.latitude,
        sample.longitude,
        candidate.latitude,
        candidate.longitude
      )
    )
    .sort((left, right) => left - right);

  const nearestDistances = distances.slice(0, 2);
  const clusterPenalty =
    nearestDistances.length === 0
      ? 0
      : nearestDistances.reduce((sum, value) => sum + value, 0) / nearestDistances.length;

  return sample.accuracy + clusterPenalty * 0.35;
}

function chooseBestSample(samples: GeolocationSample[], previousSample?: GeolocationSample | null) {
  const acceptableSamples = samples.filter(
    (sample) =>
      Number.isFinite(sample.accuracy) &&
      sample.accuracy > 0 &&
      sample.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS
  );
  const candidates = acceptableSamples.length > 0 ? acceptableSamples : samples;

  if (candidates.length === 0) {
    return null;
  }

  const ranked = [...candidates].sort((left, right) => {
    const scoreDelta = scoreSample(left, candidates) - scoreSample(right, candidates);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return left.accuracy - right.accuracy;
  });

  const bestCandidate = ranked[0];

  if (!previousSample || ranked.length === 1) {
    return bestCandidate;
  }

  const jumpDistance = calculateDistance(
    previousSample.latitude,
    previousSample.longitude,
    bestCandidate.latitude,
    bestCandidate.longitude
  );

  if (jumpDistance <= LARGE_JUMP_METERS || bestCandidate.accuracy <= previousSample.accuracy * 0.7) {
    return bestCandidate;
  }

  const stableCandidate = ranked.find((candidate) => {
    const candidateJump = calculateDistance(
      previousSample.latitude,
      previousSample.longitude,
      candidate.latitude,
      candidate.longitude
    );

    return candidateJump <= LARGE_JUMP_METERS;
  });

  return stableCandidate ?? bestCandidate;
}

function shouldEmitBatch(samples: GeolocationSample[]) {
  if (samples.length < MIN_SAMPLE_COUNT) {
    return false;
  }

  const bestAccuracy = Math.min(...samples.map((sample) => sample.accuracy));
  return bestAccuracy <= IDEAL_ACCURACY_METERS || samples.length >= TARGET_SAMPLE_COUNT;
}

function createBatchCollector({
  onSample,
  onLowAccuracy,
  previousSampleRef,
}: {
  onSample: (sample: GeolocationSample) => void;
  onLowAccuracy?: (accuracy: number) => void;
  previousSampleRef: { current: GeolocationSample | null };
}) {
  let samples: GeolocationSample[] = [];
  let emittedCount = 0;

  function emitBestAvailable() {
    const bestSample = chooseBestSample(samples, previousSampleRef.current);

    if (!bestSample) {
      samples = [];
      return;
    }

    emittedCount += samples.length;
    const emittedSample: GeolocationSample = {
      ...bestSample,
      sampleCount: emittedCount,
    };

    previousSampleRef.current = emittedSample;
    onSample(emittedSample);
    samples = [];
  }

  return {
    add(sample: GeolocationSample) {
      samples.push(sample);

      if (sample.accuracy > LOW_ACCURACY_WARNING_METERS) {
        onLowAccuracy?.(sample.accuracy);
      }

      if (!shouldEmitBatch(samples)) {
        return;
      }

      emitBestAvailable();
    },
    flush() {
      if (samples.length === 0) {
        return;
      }

      emitBestAvailable();
    },
  };
}

export function startPreciseGeolocationWatch({
  onSample,
  onError,
  onLowAccuracy,
  maximumAgeMs,
  stopAfterFirstSample = false,
}: GeolocationWatchCallbacks) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError?.(new Error("Geolocation unavailable"));
    return () => undefined;
  }

  let active = true;
  let watch: PositionWatch | null = null;
  let batchTimer: number | null = null;
  let sampleCount = 0;
  const wakeLock = createScreenWakeLockController();
  const previousSampleRef: { current: GeolocationSample | null } = {
    current: null,
  };

  const clearBatchTimer = () => {
    if (batchTimer !== null) {
      window.clearTimeout(batchTimer);
      batchTimer = null;
    }
  };

  const stop = () => {
    active = false;
    clearBatchTimer();

    if (watch) {
      watch.stop();
      watch = null;
    }

    void wakeLock.stop();
  };

  const startWatch = () => {
    if (!active) {
      return;
    }

    clearBatchTimer();

    if (watch) {
      watch.stop();
      watch = null;
    }

    const collector = createBatchCollector({
      onSample(sample) {
        onSample(sample);

        if (stopAfterFirstSample) {
          window.setTimeout(stop, 0);
        }
      },
      onLowAccuracy,
      previousSampleRef,
    });

    const scheduleBatchFlush = () => {
      clearBatchTimer();

      batchTimer = window.setTimeout(() => {
        if (!active) {
          return;
        }

        collector.flush();
        scheduleBatchFlush();
      }, GEOLOCATION_BATCH_WAIT_MS);
    };

    watch = startPositionWatch(
      (position) => {
        if (!active) {
          return;
        }

        sampleCount += 1;
        collector.add(toSample(position, sampleCount));
      },
      (error) => {
        if (!active) {
          return;
        }

        if (error.code !== error.TIMEOUT) {
          onError?.(error);
        }
      },
      {
        ...GEOLOCATION_OPTIONS,
        maximumAge: maximumAgeMs ?? GEOLOCATION_OPTIONS.maximumAge,
      }
    );

    scheduleBatchFlush();
  };

  void wakeLock.start();
  startWatch();

  return stop;
}

export function getBestAccuracyPosition(options?: {
  maxWaitMs?: number;
  onLowAccuracy?: (accuracy: number) => void;
}): Promise<GeolocationSample> {
  const maxWaitMs = Math.max(GEOLOCATION_BATCH_WAIT_MS, options?.maxWaitMs ?? 25000);

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

export {
  GEOLOCATION_OPTIONS,
  GEOLOCATION_TIMEOUT_MS,
  DEFAULT_GEOLOCATION_MAXIMUM_AGE_MS,
  LOW_ACCURACY_WARNING_METERS,
  MAX_ACCEPTABLE_ACCURACY_METERS,
};
