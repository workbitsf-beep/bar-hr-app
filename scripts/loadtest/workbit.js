/**
 * Acts as the staff and owners of the fake bars, on a TEST copy of the app.
 *
 *   k6 run -e BASE_URL=https://workbit-loadtest.up.railway.app -e BARS=25 scripts/loadtest/workbit.js
 *
 * Run it a step at a time - BARS=10, 25, 50, 100, 200 - and compare. The bar
 * count is the only dial: each bar brings its own people, and they behave the
 * way a bar's people do.
 *
 * Three things happen at once:
 *  - the day:          staff open the app, look at the week, read notifications;
 *  - the shift change: everyone working tonight clocks in within a few minutes,
 *                      which is the heaviest moment a real bar has;
 *  - the owners:       home, calendar, requests, and the monthly PDF of the team.
 *
 * Never point BASE_URL at app.workbit.it.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "").replace(/\/$/, "");
const BARS = Number(__ENV.BARS || 10);

if (!BASE_URL || BASE_URL.includes("app.workbit.it")) {
  throw new Error("Imposta BASE_URL sulla copia di prova, mai su app.workbit.it.");
}

const everyone = JSON.parse(open("./sessions.json")).filter((person) => person.bar < BARS);
const staff = everyone.filter((person) => person.role !== "OWNER");
const owners = everyone.filter((person) => person.role === "OWNER");

const pageTime = new Trend("tempo_pagine", true);
const clockTime = new Trend("tempo_timbratura", true);
const pdfTime = new Trend("tempo_pdf", true);
const failures = new Rate("errori");

export const options = {
  scenarios: {
    giornata: {
      executor: "ramping-vus",
      exec: "day",
      startVUs: 0,
      // About a third of the staff has the app open at once on a normal day.
      stages: [
        { duration: "1m", target: Math.ceil(staff.length / 3) },
        { duration: "4m", target: Math.ceil(staff.length / 3) },
        { duration: "30s", target: 0 },
      ],
    },
    cambio_turno: {
      executor: "ramping-arrival-rate",
      exec: "shiftChange",
      startTime: "2m",
      timeUnit: "1m",
      preAllocatedVUs: Math.max(10, Math.ceil(staff.length / 4)),
      maxVUs: Math.max(20, staff.length),
      // Half the staff clocks in, all within three minutes.
      stages: [
        { duration: "30s", target: Math.ceil(staff.length / 6) },
        { duration: "2m", target: Math.ceil(staff.length / 6) },
        { duration: "30s", target: 0 },
      ],
    },
    titolari: {
      executor: "constant-vus",
      exec: "owner",
      vus: Math.max(1, Math.ceil(owners.length / 2)),
      duration: "5m",
    },
  },
  thresholds: {
    // "Clean" means: a clock-in answers within a second and a half for 95 out
    // of 100 people, a page within two, and almost nothing fails.
    tempo_timbratura: ["p(95)<1500"],
    tempo_pagine: ["p(95)<2000"],
    errori: ["rate<0.01"],
  },
  summaryTrendStats: ["med", "p(95)", "p(99)", "max"],
};

// A browser always asks for compressed pages. Without this header k6 took the
// calendar as 588 KB instead of 69 KB, and past twenty bars the test was
// measuring this PC's connection rather than the app.
function as(person) {
  return {
    headers: { Cookie: `session=${person.token}`, "Accept-Encoding": "gzip, deflate, br" },
    redirects: 0,
  };
}

function page(person, path) {
  const response = http.get(`${BASE_URL}${path}`, as(person));
  pageTime.add(response.timings.duration);
  failures.add(response.status !== 200);
  check(response, { [`${path} risponde`]: (r) => r.status === 200 });
  return response;
}

function clock(person, endpoint) {
  const params = as(person);
  params.headers["Content-Type"] = "application/json";
  const response = http.post(
    `${BASE_URL}/api/timelogs/${endpoint}`,
    JSON.stringify({ latitude: person.latitude, longitude: person.longitude, accuracy: 10 }),
    params
  );

  clockTime.add(response.timings.duration);
  // A 400 is "already in" or "already out": a person repeating the gesture,
  // not the server failing.
  failures.add(response.status >= 500 || response.status === 0);
  return response;
}

const anyOf = (list) => list[Math.floor(Math.random() * list.length)];

export function day() {
  const person = anyOf(staff);
  page(person, "/dashboard");
  sleep(2 + Math.random() * 3);
  page(person, "/api/notifications");
  sleep(1 + Math.random() * 2);
  page(person, "/dashboard/calendar");
  sleep(5 + Math.random() * 10);
}

export function shiftChange() {
  const person = anyOf(staff);
  page(person, "/dashboard");
  clock(person, "clock-in");
  sleep(1);
  // Out again straight away, so the same person can be picked again later.
  clock(person, "clock-out");
}

export function owner() {
  const person = anyOf(owners);
  page(person, "/dashboard");
  sleep(3 + Math.random() * 3);
  page(person, "/dashboard/calendar");
  sleep(3 + Math.random() * 3);
  page(person, "/dashboard/requests");
  sleep(3 + Math.random() * 3);

  // One owner in ten downloads the team's month: the heaviest thing the app does.
  if (Math.random() < 0.1) {
    const now = new Date();
    const params = as(person);
    params.headers["Content-Type"] = "application/json";
    params.timeout = "120s";
    const response = http.post(
      `${BASE_URL}/api/export/monthly`,
      JSON.stringify({ month: now.getMonth() + 1, year: now.getFullYear(), userId: "__ALL__", format: "pdf" }),
      params
    );
    pdfTime.add(response.timings.duration);
    failures.add(response.status !== 200);
  }

  sleep(10 + Math.random() * 10);
}

export function handleSummary(data) {
  const metric = (name, stat) => data.metrics[name]?.values?.[stat] ?? null;
  const summary = {
    bars: BARS,
    persone: everyone.length,
    timbratura: { mediana: metric("tempo_timbratura", "med"), p95: metric("tempo_timbratura", "p(95)"), max: metric("tempo_timbratura", "max") },
    pagine: { mediana: metric("tempo_pagine", "med"), p95: metric("tempo_pagine", "p(95)"), max: metric("tempo_pagine", "max") },
    pdf: { mediana: metric("tempo_pdf", "med"), p95: metric("tempo_pdf", "p(95)"), max: metric("tempo_pdf", "max") },
    errori: metric("errori", "rate"),
    richieste: metric("http_reqs", "count"),
  };

  return {
    [`scripts/loadtest/results/bars-${BARS}.json`]: JSON.stringify(summary, null, 2),
    stdout: `\n${BARS} bar · ${everyone.length} persone\n` +
      `Timbratura  mediana ${Math.round(summary.timbratura.mediana)} ms · 95% entro ${Math.round(summary.timbratura.p95)} ms\n` +
      `Pagine      mediana ${Math.round(summary.pagine.mediana)} ms · 95% entro ${Math.round(summary.pagine.p95)} ms\n` +
      `PDF         mediana ${Math.round(summary.pdf.mediana ?? 0)} ms · 95% entro ${Math.round(summary.pdf.p95 ?? 0)} ms\n` +
      `Errori      ${((summary.errori ?? 0) * 100).toFixed(2)}%\n`,
  };
}
