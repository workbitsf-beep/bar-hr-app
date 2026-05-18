export type GeolocationSample = {
  latitude: number;
  longitude: number;
  accuracy: number;
  sampleCount: number;
};

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

function readSinglePosition(): Promise<GeolocationSample> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          sampleCount: 1,
        });
      },
      (error) => {
        reject(error);
      },
      GEOLOCATION_OPTIONS
    );
  });
}

export async function getBestAccuracyPosition(options?: {
  minSamples?: number;
  maxSamples?: number;
  earlyStopAccuracy?: number;
}): Promise<GeolocationSample> {
  const minSamples = Math.max(3, options?.minSamples ?? 3);
  const maxSamples = Math.max(minSamples, options?.maxSamples ?? 5);
  const earlyStopAccuracy = Math.max(1, options?.earlyStopAccuracy ?? 20);

  let bestSample: GeolocationSample | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxSamples; attempt += 1) {
    try {
      const sample = await readSinglePosition();
      const nextSample = {
        ...sample,
        sampleCount: attempt,
      };

      if (!bestSample || nextSample.accuracy < bestSample.accuracy) {
        bestSample = nextSample;
      }

      if (attempt >= minSamples && bestSample.accuracy <= earlyStopAccuracy) {
        return bestSample;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (bestSample) {
    return bestSample;
  }

  throw lastError ?? new Error("Unable to read geolocation");
}
