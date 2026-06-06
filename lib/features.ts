export type FeatureKey =
  | "timeTracking"
  | "shifts"
  | "requests"
  | "availability"
  | "overtime"
  | "tasks"
  | "noticeBoard"
  | "courses"
  | "reports";

export type FeatureFlags = Record<FeatureKey, boolean>;

export type FeatureSettingsInput = Partial<{
  timeTrackingEnabled: boolean | null;
  shiftsEnabled: boolean | null;
  requestsEnabled: boolean | null;
  availabilityEnabled: boolean | null;
  overtimeEnabled: boolean | null;
  tasksEnabled: boolean | null;
  noticeBoardEnabled: boolean | null;
  coursesEnabled: boolean | null;
  reportsEnabled: boolean | null;
}>;

export const featureDefinitions: Array<{
  key: FeatureKey;
  field: keyof FeatureSettingsInput;
  label: string;
  shortLabel: string;
  description: string;
  emoji: string;
}> = [
  {
    key: "timeTracking",
    field: "timeTrackingEnabled",
    label: "Timbrature",
    shortLabel: "Timbrature",
    description: "Entrata, uscita e GPS.",
    emoji: "⏱️",
  },
  {
    key: "shifts",
    field: "shiftsEnabled",
    label: "Turni",
    shortLabel: "Turni",
    description: "Calendario e pianificazione.",
    emoji: "📅",
  },
  {
    key: "requests",
    field: "requestsEnabled",
    label: "Richieste",
    shortLabel: "Richieste",
    description: "Ferie, permessi, malattia e cambi turno.",
    emoji: "📝",
  },
  {
    key: "availability",
    field: "availabilityEnabled",
    label: "Indisponibilità",
    shortLabel: "Indisponibilità",
    description: "Segnalazioni di assenza o indisponibilità.",
    emoji: "🚫",
  },
  {
    key: "overtime",
    field: "overtimeEnabled",
    label: "Straordinari",
    shortLabel: "Straordinari",
    description: "Ore extra da approvare.",
    emoji: "⏳",
  },
  {
    key: "tasks",
    field: "tasksEnabled",
    label: "Mansioni",
    shortLabel: "Mansioni",
    description: "Attività assegnate al team.",
    emoji: "✅",
  },
  {
    key: "noticeBoard",
    field: "noticeBoardEnabled",
    label: "Bacheca",
    shortLabel: "Bacheca",
    description: "Comunicazioni interne.",
    emoji: "📢",
  },
  {
    key: "courses",
    field: "coursesEnabled",
    label: "Corsi",
    shortLabel: "Corsi",
    description: "Formazione e scadenze.",
    emoji: "🎓",
  },
  {
    key: "reports",
    field: "reportsEnabled",
    label: "Report PDF",
    shortLabel: "Report",
    description: "Export mensili personali o del team.",
    emoji: "📄",
  },
];

export const defaultFeatureFlags: FeatureFlags = {
  timeTracking: true,
  shifts: true,
  requests: true,
  availability: true,
  overtime: true,
  tasks: true,
  noticeBoard: true,
  courses: true,
  reports: true,
};

export function getFeatureFlags(settings?: FeatureSettingsInput | null): FeatureFlags {
  return featureDefinitions.reduce<FeatureFlags>(
    (flags, feature) => ({
      ...flags,
      [feature.key]: settings?.[feature.field] ?? true,
    }),
    { ...defaultFeatureFlags }
  );
}

export function parseFeatureFlags(formData: FormData): Record<string, boolean> {
  return Object.fromEntries(
    featureDefinitions.map((feature) => [feature.field, formData.get(feature.field) === "on"])
  );
}
