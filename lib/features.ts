export type FeatureKey =
  | "timeTracking"
  | "shifts"
  | "requests"
  | "availability"
  | "overtime"
  | "tasks"
  | "noticeBoard"
  | "courses"
  | "documents"
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
  documentsEnabled: boolean | null;
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
    label: "Note",
    shortLabel: "Note",
    description: "Note da assegnare, leggere e completare.",
    emoji: "✅",
  },
  {
    key: "noticeBoard",
    field: "noticeBoardEnabled",
    label: "Note",
    shortLabel: "Note",
    description: "Note condivise con conferma lettura.",
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
    key: "documents",
    field: "documentsEnabled",
    label: "Documenti",
    shortLabel: "Documenti",
    description: "File e materiali condivisi.",
    emoji: "📎",
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
  documents: true,
  reports: true,
};

export const featureToggleDefinitions = featureDefinitions.filter(
  (feature) => feature.key !== "noticeBoard"
);

export function getFeatureFlags(settings?: FeatureSettingsInput | null): FeatureFlags {
  const flags = featureDefinitions.reduce<FeatureFlags>(
    (flags, feature) => ({
      ...flags,
      [feature.key]: settings?.[feature.field] ?? true,
    }),
    { ...defaultFeatureFlags }
  );
  const notesEnabled = flags.tasks || flags.noticeBoard;

  return {
    ...flags,
    tasks: notesEnabled,
    noticeBoard: false,
  };
}

export function parseFeatureFlags(formData: FormData): Record<string, boolean> {
  const parsed = Object.fromEntries(
    featureDefinitions.map((feature) => [feature.field, formData.get(feature.field) === "on"])
  );

  if (!formData.has("noticeBoardEnabled")) {
    parsed.noticeBoardEnabled = false;
  }

  if (!formData.has("tasksEnabled")) {
    parsed.tasksEnabled = parsed.noticeBoardEnabled ?? true;
  }

  return parsed;
}
