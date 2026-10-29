"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  useRouter,
} from "next/navigation";
import {
  createPortal,
} from "react-dom";
import type { Role } from "@prisma/client";
import {
  ConfirmationToast,
} from "@/app/components/confirmation-toast";
import {
  SuccessPulse,
} from "@/app/components/workbit-animations";
import {
  DEFAULT_GEOLOCATION_MAXIMUM_AGE_MS,
  getBestAccuracyPosition,
  startPreciseGeolocationWatch,
} from "@/lib/browser-gps";
import type { GeolocationSample } from "@/lib/browser-gps";
import {
  calculateDistance,
} from "@/lib/gps";
import {
  isNativeApp,
} from "@/lib/native-app";
import {
  haptic,
} from "@/lib/native-extras";
import {
  queueStamp,
  saveClockContext,
} from "@/lib/offline-clock-queue";
import {
  Panel,
  PrimaryButton,
} from "../ui";
import {
  formatDurationFromMilliseconds,
} from "@/lib/time-format";
import {
  showAppToast,
} from "@/app/components/app-toast";
import {
  announceClockChanged,
  CLOCK_REQUEST_EVENT,
  requestClock,
  takeClockRequest,
} from "@/lib/native-widgets";
import {
  type ClockDirection,
  decideOutsideStamp,
} from "@/lib/clock-request";

type BarSettingsSummary = {
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsRadius: number | null;
  roundingEnabled: boolean;
  roundingMinutes: number | null;
  roundingMode: string | null;
} | null;

export type ClockActionStatus = "CAN_CLOCK_IN" | "CAN_CLOCK_OUT" | "DONE";

const CLOCK_LOCATION_CACHE_KEY = "workbit.clock.location";
const CLOCK_LOCATION_CACHE_MAX_AGE_MS = 2 * 60 * 1000;

type CachedClockLocation = GeolocationSample & {
  capturedAt: number;
  barLatitude: number;
  barLongitude: number;
  barRadius: number;
};

/** How far from the clock-in point - the nearest one, for a company with sites. */
function nearestDistance(
  latitude: number,
  longitude: number,
  settings: { gpsLatitude: number; gpsLongitude: number },
  points: Array<{ latitude: number; longitude: number }> | null
) {
  const candidates = points?.length ? points : [{ latitude: settings.gpsLatitude, longitude: settings.gpsLongitude }];
  return Math.min(...candidates.map((point) => calculateDistance(latitude, longitude, point.latitude, point.longitude)));
}

function hasConfiguredGps(settings: BarSettingsSummary): settings is NonNullable<BarSettingsSummary> & {
  gpsLatitude: number;
  gpsLongitude: number;
  gpsRadius: number;
} {
  return (
    settings !== null &&
    settings.gpsLatitude !== null &&
    settings.gpsLongitude !== null &&
    settings.gpsRadius !== null
  );
}

function readCachedClockLocation(settings: BarSettingsSummary): GeolocationSample | null {
  if (!hasConfiguredGps(settings) || typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(CLOCK_LOCATION_CACHE_KEY);

    if (!rawValue) {
      return null;
    }

    const cached = JSON.parse(rawValue) as Partial<CachedClockLocation>;
    const isSameGpsPoint =
      cached.barLatitude === settings.gpsLatitude &&
      cached.barLongitude === settings.gpsLongitude &&
      cached.barRadius === settings.gpsRadius;
    const isFresh =
      typeof cached.capturedAt === "number" &&
      Date.now() - cached.capturedAt <= CLOCK_LOCATION_CACHE_MAX_AGE_MS;
    const cachedLatitude = cached.latitude;
    const cachedLongitude = cached.longitude;
    const cachedAccuracy = cached.accuracy;
    const hasUsableCoordinates =
      typeof cachedLatitude === "number" &&
      typeof cachedLongitude === "number" &&
      typeof cachedAccuracy === "number" &&
      Number.isFinite(cachedLatitude) &&
      Number.isFinite(cachedLongitude) &&
      Number.isFinite(cachedAccuracy);

    if (!isSameGpsPoint || !isFresh || !hasUsableCoordinates) {
      return null;
    }

    return {
      latitude: cachedLatitude,
      longitude: cachedLongitude,
      accuracy: cachedAccuracy,
      sampleCount: typeof cached.sampleCount === "number" ? cached.sampleCount : 1,
    };
  } catch {
    return null;
  }
}

function writeCachedClockLocation(settings: BarSettingsSummary, sample: GeolocationSample) {
  if (!hasConfiguredGps(settings) || typeof window === "undefined") {
    return;
  }

  const cached: CachedClockLocation = {
    ...sample,
    capturedAt: Date.now(),
    barLatitude: settings.gpsLatitude,
    barLongitude: settings.gpsLongitude,
    barRadius: settings.gpsRadius,
  };

  try {
    window.localStorage.setItem(CLOCK_LOCATION_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Local storage can be unavailable in private or restricted browsing modes.
  }
}

/**
 * How much of a reading's own error we are willing to forgive.
 *
 * Capped, so a deliberately vague fix cannot be used to stamp from down the
 * road: past this, being far away is far away.
 */
const MAX_ACCURACY_ALLOWANCE_METERS = 50;

async function getGeolocationPermissionState(): Promise<PermissionState | "unsupported"> {
  if (typeof navigator === "undefined" || !("permissions" in navigator)) {
    return "unsupported";
  }

  try {
    const status = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });

    return status.state;
  } catch {
    return "unsupported";
  }
}

export function ClockActionsPanel({
  role,
  settings,
  compact = false,
  clockStatus = "CAN_CLOCK_IN",
  hasScheduledShiftToday = false,
  activeClockInAt = null,
  shiftLabel = null,
  shiftEndAt = null,
  clockPoints = null,
  personName = "",
  venueName = "",
}: {
  role: Role | string;
  /** For the app's offline page: who stamps, and where. */
  personName?: string;
  venueName?: string;
  settings: BarSettingsSummary;
  /** A company's site points: the nearest one counts instead of the venue's. */
  clockPoints?: Array<{ latitude: number; longitude: number }> | null;
  compact?: boolean;
  clockStatus?: ClockActionStatus;
  hasScheduledShiftToday?: boolean;
  /** When set, the bar counts up from here instead of naming the shift. */
  activeClockInAt?: string | null;
  shiftLabel?: string | null;
  /** The end of the shift being worked: an early exit from a notification asks first. */
  shiftEndAt?: string | null;
}) {
  const router = useRouter();
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [distance, setDistance] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [geoReady, setGeoReady] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [confirmationKey, setConfirmationKey] = useState(0);
  const [successPulse, setSuccessPulse] = useState<"in" | "out" | null>(null);
  const [successPulseKey, setSuccessPulseKey] = useState(0);
  const [temporaryWarning, setTemporaryWarning] = useState("");
  const [temporaryWarningKey, setTemporaryWarningKey] = useState(0);
  const [submitting, setSubmitting] = useState<"in" | "out" | null>(null);
  const [locating, setLocating] = useState(false);
  const [weakAccuracy, setWeakAccuracy] = useState<number | null>(null);
  const stopWatchRef = useRef<(() => void) | null>(null);

  // Ticks only while someone is actually clocked in, so the bar can say how
  // long they have been in rather than repeating the shift they are on.
  const [elapsedLabel, setElapsedLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!activeClockInAt) {
      setElapsedLabel(null);
      return;
    }

    const startedAt = new Date(activeClockInAt).getTime();
    // "dentro da 00:00" read as "in since midnight": the time of the entry and
    // how long ago say it without doubt.
    const since = new Date(startedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

    function tick() {
      const minutes = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
      const length =
        minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
      setElapsedLabel(`dentro dalle ${since} · ${length}`);
    }

    tick();
    const id = window.setInterval(tick, 30_000);

    return () => window.clearInterval(id);
  }, [activeClockInAt]);

  const gpsConfigured = hasConfiguredGps(settings);
  const canClock = role !== "OWNER";

  // What the app's offline page needs to offer a stamp when the site cannot
  // load: where the venue is, how near counts, and what the next stamp is.
  useEffect(() => {
    if (!canClock || !compact || !isNativeApp() || !hasConfiguredGps(settings)) return;
    void saveClockContext({
      firstName: personName,
      barName: venueName,
      points: clockPoints?.length
        ? clockPoints
        : [{ latitude: settings.gpsLatitude as number, longitude: settings.gpsLongitude as number }],
      radius: settings.gpsRadius as number,
      next: clockStatus === "CAN_CLOCK_OUT" ? "clock-out" : "clock-in",
      savedAt: Date.now(),
    });
  }, [canClock, compact, clockPoints, clockStatus, personName, settings, venueName]);

  // A reading carries an error of its own, often tens of metres indoors, so a
  // distance of exactly the radius means nothing: standing still, the point
  // drifts in and out and the button flickered with it. The reading's own
  // margin is allowed for, capped so a deliberately vague fix cannot be used
  // to stamp from down the road.
  const accuracyAllowance = Math.min(accuracy ?? 0, MAX_ACCURACY_ALLOWANCE_METERS);
  const insideRadius =
    gpsConfigured &&
    latitude !== "" &&
    longitude !== "" &&
    distance !== null &&
    distance <= (settings?.gpsRadius ?? 0) + accuracyAllowance;
  const canClockIn =
    insideRadius &&
    geoReady &&
    hasScheduledShiftToday &&
    clockStatus !== "CAN_CLOCK_OUT";
  const canClockOut = insideRadius && geoReady && clockStatus === "CAN_CLOCK_OUT";

  const locationSummary = useMemo(() => {
    if (!gpsConfigured) {
      return "Il punto del locale non è ancora impostato dal titolare.";
    }

    if (locating && !geoReady) {
      return "Posizione in aggiornamento...";
    }

    if (locationError) {
      return "Posizione non aggiornata.";
    }

    if (weakAccuracy !== null) {
      return "Posizione poco precisa. Avvicinati al punto impostato dal titolare e riprova.";
    }

    if (distance === null || accuracy === null) {
      return "Posizione non aggiornata.";
    }

    if (!insideRadius) {
      return "Avvicinati di più al punto impostato dal titolare.";
    }

    return "Posizione aggiornata.";
  }, [
    accuracy,
    distance,
    geoReady,
    gpsConfigured,
    insideRadius,
    locating,
    locationError,
    weakAccuracy,
  ]);

  const stopGeolocationWatch = useCallback(() => {
    stopWatchRef.current?.();
    stopWatchRef.current = null;
  }, []);

  const applyGeolocationSample = useCallback((sample: GeolocationSample, persist = true) => {
    if (!hasConfiguredGps(settings)) {
      return;
    }

    const nextDistance = nearestDistance(sample.latitude, sample.longitude, settings, clockPoints);

    setLatitude(String(sample.latitude));
    setLongitude(String(sample.longitude));
    setAccuracy(sample.accuracy);
    setDistance(nextDistance);
    setGeoReady(true);
    setWeakAccuracy(null);
    setLocationError("");
    setLocating(false);

    if (persist) {
      writeCachedClockLocation(settings, sample);
    }
  }, [settings, clockPoints]);

  const startGeolocationWatch = useCallback((manual = false) => {
    if (
      !canClock ||
      !hasConfiguredGps(settings) ||
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      return;
    }

    if (!manual && stopWatchRef.current) {
      return;
    }

    stopGeolocationWatch();
    setLocating(true);
    setLocationError("");
    setWeakAccuracy(null);

    if (manual) {
      setActionMessage("");
    }

    // Keep one browser watch open and publish the best point from each short
    // batch, avoiding repeated GPS restarts while the profile is open.
    stopWatchRef.current = startPreciseGeolocationWatch({
      onSample(sample) {
        applyGeolocationSample(sample);
      },
      onLowAccuracy(nextAccuracy) {
        setAccuracy(nextAccuracy);
        setWeakAccuracy(nextAccuracy);
        setLocationError("");
        setLocating(true);
      },
      onError() {
        setWeakAccuracy(null);
        setLocating(false);
        setLocationError(
          manual
            ? "Impossibile leggere la posizione attuale."
            : "Impossibile aggiornare automaticamente la posizione."
        );
      },
      maximumAgeMs: DEFAULT_GEOLOCATION_MAXIMUM_AGE_MS,
      stopAfterFirstSample: false,
    });
  }, [applyGeolocationSample, canClock, settings, stopGeolocationWatch]);

  useEffect(() => {
    if (!canClock || !gpsConfigured) {
      return;
    }

    let cancelled = false;
    const cachedSample = readCachedClockLocation(settings);

    if (cachedSample) {
      applyGeolocationSample(cachedSample, false);
    }

    async function startGrantedWatch() {
      const permissionState = await getGeolocationPermissionState();

      if (cancelled) {
        return;
      }

      if (permissionState === "denied") {
        setLocationError("Consenti la posizione dalle impostazioni del dispositivo.");
        return;
      }

      // Inside the installed app the browser permission registry does not
      // reflect what Android granted, so it answers "prompt" or nothing at all
      // even when the position is available. Waiting for "granted" there meant
      // the reading never started by itself and every stamp had to begin with
      // a manual refresh. Asking the device directly costs nothing: the
      // permission is already held, so no prompt appears.
      if (permissionState === "granted" || isNativeApp()) {
        startGeolocationWatch(false);
      }
    }

    void startGrantedWatch();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void startGrantedWatch();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopGeolocationWatch();
    };
  }, [
    applyGeolocationSample,
    canClock,
    gpsConfigured,
    settings,
    startGeolocationWatch,
    stopGeolocationWatch,
  ]);

  function showTemporaryWarning(message: string) {
    setTemporaryWarning(message);
    setTemporaryWarningKey((current) => current + 1);
  }

  async function getClockActionLocation() {
    if (!hasConfiguredGps(settings)) {
      setLocationError("Geolocalizzazione non disponibile.");
      return null;
    }

    const cachedSample = readCachedClockLocation(settings);

    if (cachedSample) {
      applyGeolocationSample(cachedSample, false);
      return cachedSample;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocalizzazione non disponibile.");
      return null;
    }

    setLocating(true);
    setLocationError("");
    setWeakAccuracy(null);
    setActionMessage("Rilevo la posizione...");

    try {
      const sample = await getBestAccuracyPosition({
        maxWaitMs: 25000,
        onLowAccuracy(nextAccuracy) {
          setAccuracy(nextAccuracy);
          setWeakAccuracy(nextAccuracy);
          setLocationError("");
        },
      });

      applyGeolocationSample(sample);
      return sample;
    } catch {
      setWeakAccuracy(null);
      setLocating(false);
      setLocationError("Impossibile leggere la posizione attuale.");
      setActionMessage("Impossibile leggere la posizione attuale.");
      return null;
    }
  }

  async function runClockAction(endpoint: "clock-in" | "clock-out") {
    if (endpoint === "clock-in" && !hasScheduledShiftToday) {
      setActionMessage("Non hai un turno programmato per oggi.");
      return;
    }

    setSubmitting(endpoint === "clock-in" ? "in" : "out");
    setActionMessage("");

    try {
      const sample = await getClockActionLocation();

      if (!sample || !hasConfiguredGps(settings)) {
        return;
      }

      const nextDistance = nearestDistance(sample.latitude, sample.longitude, settings, clockPoints);

      if (nextDistance > settings.gpsRadius) {
        void haptic("warning");
        setLocationError("");
        const message = "Non sei ancora nel tuo luogo di lavoro, avvicinati.";
        setActionMessage(message);
        showTemporaryWarning(message);
        return;
      }

      const stamp = {
        endpoint,
        latitude: sample.latitude,
        longitude: sample.longitude,
        accuracy: sample.accuracy ?? null,
        at: Date.now(),
      };
      let response: Response;
      try {
        if (isNativeApp() && typeof navigator !== "undefined" && navigator.onLine === false) {
          throw new Error("offline");
        }
        response = await fetch(`/api/timelogs/${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            latitude: sample.latitude,
            longitude: sample.longitude,
            accuracy: sample.accuracy,
          }),
        });
      } catch (networkError) {
        // No network inside the app: the stamp is kept on the phone, with
        // its time and position, and sent as soon as the network is back
        // (app/dashboard/offline-clock.tsx). In a browser it is just an error.
        if (!isNativeApp()) throw networkError;
        await queueStamp(stamp);
        void haptic("success");
        const what = endpoint === "clock-in" ? "Entrata" : "Uscita";
        setActionMessage(`${what} salvata senza rete: parte appena torna la connessione.`);
        setConfirmationMessage(`${what} salvata`);
        setConfirmationKey((current) => current + 1);
        return;
      }
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; duration?: number }
        | null;

      if (!response.ok || payload?.ok === false) {
        const message =
          payload?.message === "Outside allowed radius"
            ? "Non sei ancora nel tuo luogo di lavoro, avvicinati."
            : payload?.message || "Operazione non riuscita";
        setActionMessage(message);
        void haptic("warning");
        if (payload?.message === "Outside allowed radius") {
          showTemporaryWarning(message);
        }
        return;
      }

      void haptic("success");

      if (endpoint === "clock-out") {
        setSuccessPulse("out");
        setSuccessPulseKey((current) => current + 1);
        setActionMessage(
          typeof payload?.duration === "number"
            ? `Uscita registrata. Durata ${formatDurationFromMilliseconds(payload.duration)}.`
            : "Uscita registrata."
        );
        setConfirmationMessage("Per oggi hai finito");
        setConfirmationKey((current) => current + 1);
      } else {
        setSuccessPulse("in");
        setSuccessPulseKey((current) => current + 1);
        setActionMessage("Entrata registrata.");
        setConfirmationMessage("Buon lavoro");
        setConfirmationKey((current) => current + 1);
      }

      announceClockChanged();
      router.refresh();
    } catch {
      setActionMessage("Impossibile contattare il servizio timbrature.");
    } finally {
      setSubmitting(null);
    }
  }

  // A stamp asked for from outside the page - "Timbra" on the app icon,
  // "Entra" / "Esci" on a notification - starts by itself, once. Only an exit
  // well before the end of the shift asks first: a tap on the lock screen is
  // easy to make by mistake, and an early exit is the costly one.
  function stampFromOutside(direction: ClockDirection) {
    const decision = decideOutsideStamp({
      direction,
      isIn: clockStatus === "CAN_CLOCK_OUT",
      shiftEndAt,
      now: new Date(),
    });
    if (decision.kind === "refuse") {
      showAppToast(decision.message);
      return;
    }
    if (decision.kind === "confirm") {
      const at = decision.endsAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
      if (!window.confirm(`Il turno finisce alle ${at === "00:00" ? "24:00" : at}. Timbri l'uscita adesso?`)) return;
    }
    void runClockAction(decision.endpoint);
  }
  const stampFromOutsideRef = useRef(stampFromOutside);
  stampFromOutsideRef.current = stampFromOutside;

  useEffect(() => {
    if (!compact || !canClock) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("azione") === "timbra") {
      params.delete("azione");
      const rest = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
      requestClock();
    }
    const take = () => {
      const direction = takeClockRequest();
      if (direction) stampFromOutsideRef.current(direction);
    };
    take();
    window.addEventListener(CLOCK_REQUEST_EVENT, take);
    return () => window.removeEventListener(CLOCK_REQUEST_EVENT, take);
  }, [compact, canClock]);

  function captureGeolocation() {
    if (locating) {
      return;
    }

    if (!navigator.geolocation || !gpsConfigured) {
      setLocationError("Geolocalizzazione non disponibile.");
      return;
    }

    startGeolocationWatch(true);
  }

  if (!canClock) {
    return null;
  }

  if (compact) {
    const leaving = clockStatus === "CAN_CLOCK_OUT";
    const enabled = leaving ? canClockOut : canClockIn;
    const tone = !enabled ? "off" : leaving ? "out" : "in";
    const label = submitting
      ? "..."
      : leaving
        ? "Timbra uscita"
        : "Timbra entrata";
    const meta = leaving ? elapsedLabel : shiftLabel;

    return (
      <section className="wb-act" aria-label="Entrata e uscita">
        <button
          type="button"
          className={`wb-act-bar wb-act-bar--${tone}`}
          onClick={() => runClockAction(leaving ? "clock-out" : "clock-in")}
          disabled={submitting !== null || !enabled}
        >
          <SuccessPulse
            key={`${leaving ? "out" : "in"}-${successPulseKey}`}
            active={successPulse === (leaving ? "out" : "in")}
            tone={leaving ? "red" : "green"}
          />
          <i aria-hidden="true" />
          <span className="wb-act-text">
            <b>{label}</b>
            {meta ? <em>{meta}</em> : null}
          </span>
        </button>

        {/* The position only speaks up when it is in the way. */}
        {!enabled ? (
          <p className="wb-act-note">
            <span>{locationSummary}</span>
            <button type="button" onClick={captureGeolocation} disabled={locating}>
              {locating ? "..." : "Aggiorna"}
            </button>
          </p>
        ) : null}

        {/* The outcome passes through and goes: pinned under the bar it stayed
            there long after it stopped being news. */}
        {actionMessage && !confirmationMessage ? (
          <ConfirmationToast key={`esito-${actionMessage}`}>{actionMessage}</ConfirmationToast>
        ) : null}
        {confirmationMessage ? (
          <ConfirmationToast key={confirmationKey}>{confirmationMessage}</ConfirmationToast>
        ) : null}
        {temporaryWarning ? (
          <TemporaryWarningToast key={temporaryWarningKey}>{temporaryWarning}</TemporaryWarningToast>
        ) : null}
      </section>
    );
  }

  return (
    <Panel
      title={compact ? "Timbratura veloce" : "Entrata / uscita"}
      action={gpsConfigured ? "Pronta" : "Da impostare"}
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            background: "#ffffff",
            border: "1px solid rgba(60, 60, 67, 0.12)",
            borderRadius: 18,
            padding: "12px 14px",
            color: "#8E8E93",
            lineHeight: 1.45,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 180px", minWidth: 0 }}>{locationSummary}</div>
          <button
            type="button"
            onClick={captureGeolocation}
            disabled={locating || !gpsConfigured}
            aria-label="Aggiorna posizione"
            title={locating ? "Aggiornamento posizione..." : "Aggiorna posizione"}
            style={{
              width: 62,
              height: 62,
              minWidth: 62,
              padding: 0,
              borderRadius: 0,
              fontSize: locating ? 30 : 38,
              lineHeight: 1,
              flex: "0 0 auto",
              background: "transparent",
              border: "none",
              boxShadow: "none",
              color: "#3D2A99",
              cursor: locating || !gpsConfigured ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: locating || !gpsConfigured ? 0.5 : 1,
              WebkitAppearance: "none",
              appearance: "none",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "1em",
                height: "1em",
                lineHeight: 1,
              }}
            >
              {locating ? "…" : "🔄"}
            </span>
          </button>
          {settings?.roundingEnabled && settings.roundingMinutes ? (
            <div style={{ flex: "1 1 100%", fontSize: 13, color: "#64748b" }}>
              Arrotondamento ore attivo.
            </div>
          ) : null}
        </div>

        <div className="dashboard-clock-actions" style={{ display: "grid", gap: 12 }}>
        <div
          className="dashboard-clock-actions-row"
          style={{ display: "flex", gap: 10, alignItems: "stretch" }}
        >
          <PrimaryButton
            className="dashboard-clock-button"
            type="button"
            tone="green"
            onClick={() => runClockAction("clock-in")}
            disabled={submitting !== null || !canClockIn}
            aria-label={submitting === "in" ? "Registrazione entrata" : "Registra entrata"}
            title={submitting === "in" ? "Registrazione entrata" : "Registra entrata"}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 66,
              fontSize: 18,
              letterSpacing: "0.08em",
              color: "#ffffff",
              background: "linear-gradient(135deg, #16a34a 0%, #22c55e 58%, #4ade80 100%)",
              border: "1px solid rgba(34, 197, 94, 0.72)",
              boxShadow: "0 14px 28px rgba(22, 163, 74, 0.24)",
            }}
          >
            <SuccessPulse key={`in-${successPulseKey}`} active={successPulse === "in"} tone="green" />
            {submitting === "in" ? "..." : "ENTRA"}
          </PrimaryButton>
          <PrimaryButton
            className="dashboard-clock-button"
            type="button"
            tone="red"
            onClick={() => runClockAction("clock-out")}
            disabled={submitting !== null || !canClockOut}
            aria-label={submitting === "out" ? "Registrazione uscita" : "Registra uscita"}
            title={submitting === "out" ? "Registrazione uscita" : "Registra uscita"}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 66,
              fontSize: 18,
              letterSpacing: "0.08em",
              color: "#ffffff",
              background: "linear-gradient(135deg, #dc2626 0%, #ef4444 58%, #fb7185 100%)",
              border: "1px solid rgba(239, 68, 68, 0.72)",
              boxShadow: "0 14px 28px rgba(220, 38, 38, 0.24)",
            }}
          >
            <SuccessPulse key={`out-${successPulseKey}`} active={successPulse === "out"} tone="red" />
            {submitting === "out" ? "..." : "ESCI"}
          </PrimaryButton>
        </div>
        </div>

        {actionMessage ? (
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>{actionMessage}</p>
        ) : null}

        {confirmationMessage ? (
          <ConfirmationToast key={confirmationKey}>{confirmationMessage}</ConfirmationToast>
        ) : null}

        {temporaryWarning ? (
          <TemporaryWarningToast key={temporaryWarningKey}>{temporaryWarning}</TemporaryWarningToast>
        ) : null}

        {compact && !gpsConfigured ? (
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
            Configura il GPS del locale per abilitare la timbratura.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function TemporaryWarningToast({
  children,
  duration = 2400,
}: {
  children: ReactNode;
  duration?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(timeout);
  }, [duration]);

  if (!mounted || !visible) {
    return null;
  }

  return createPortal(
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        display: "grid",
        placeItems: "center",
        padding: 24,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: "min(88vw, 360px)",
          borderRadius: 28,
          border: "1px solid rgba(251, 146, 60, 0.28)",
          background: "rgba(255, 251, 235, 0.96)",
          boxShadow: "0 28px 70px rgba(124, 45, 18, 0.22)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          padding: "22px 20px",
          textAlign: "center",
          animation: "workbit-warning-pop 170ms ease-out",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 54,
            height: 54,
            margin: "0 auto 12px",
            borderRadius: 22,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffedd5",
            color: "#c2410c",
            fontSize: 28,
            fontWeight: 900,
          }}
        >
          !
        </span>
        <strong
          style={{
            display: "block",
            color: "#7c2d12",
            fontSize: 18,
            lineHeight: 1.25,
            fontWeight: 900,
          }}
        >
          {children}
        </strong>
      </div>
      <style jsx>{`
        @keyframes workbit-warning-pop {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
