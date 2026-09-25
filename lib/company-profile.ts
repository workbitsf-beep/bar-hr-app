import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * The company details every legal document is written from.
 *
 * Entered once, in the console. Anything left empty shows up in the generated
 * text as a visible gap rather than silently disappearing, so an unfinished
 * document cannot be published by accident.
 */
export type CompanyProfile = {
  legalName: string;
  registeredOffice: string;
  vatNumber: string;
  taxCode: string;
  reaAndCapital: string;
  legalRepresentative: string;
  certifiedEmail: string;
  serviceName: string;
  website: string;
  privacyEmail: string;
  supportEmail: string;
  dpoContact: string;
  courtCity: string;
  hostingRegion: string;
  trialDays: string;
  noticeDays: string;
  exportDays: string;
  breachHours: string;
  deletionPath: string;
  deletionDays: string;
  retentionTimelogs: string;
  retentionPosition: string;
  retentionRequests: string;
  retentionCertificate: string;
  retentionNotes: string;
  retentionDocuments: string;
  retentionAccessLogs: string;
  retentionTaxData: string;
  collectsCertificateCode: boolean;
  invoicingActive: boolean;
  documentVersion: string;
  effectiveFrom: string;
};

export const COMPANY_PROFILE_DEFAULTS: CompanyProfile = {
  legalName: "",
  registeredOffice: "",
  vatNumber: "",
  taxCode: "",
  reaAndCapital: "",
  legalRepresentative: "",
  certifiedEmail: "",
  serviceName: "Workbit",
  website: "app.workbit.it",
  privacyEmail: "",
  supportEmail: "",
  dpoContact: "",
  courtCity: "",
  hostingRegion: "",
  trialDays: "14",
  noticeDays: "30",
  exportDays: "30",
  breachHours: "48",
  deletionPath: "Impostazioni › Sicurezza › Eliminazione account e locale",
  deletionDays: "30",
  retentionTimelogs: "per 5 anni dalla registrazione",
  retentionPosition:
    "per 12 mesi dalla timbratura; trascorso questo termine le coordinate vengono cancellate e restano solo data e ora",
  retentionRequests: "per 5 anni dalla chiusura della richiesta",
  retentionCertificate: "per 30 giorni dalla fine del periodo di assenza",
  retentionNotes: "fino alla cessazione del rapporto di lavoro con il locale",
  retentionDocuments:
    "fino a quando il locale li rimuove, e comunque non oltre la cessazione del rapporto di lavoro",
  retentionAccessLogs: "per 12 mesi",
  retentionTaxData: "per 10 anni, come previsto dalla normativa civilistica e fiscale",
  collectsCertificateCode: true,
  invoicingActive: false,
  documentVersion: "1.0",
  effectiveFrom: "",
};

/** Labels used both by the form and by the gaps left in the generated text. */
export const COMPANY_PROFILE_LABELS: Record<keyof CompanyProfile, string> = {
  legalName: "Ragione sociale",
  registeredOffice: "Sede legale",
  vatNumber: "Partita IVA",
  taxCode: "Codice fiscale",
  reaAndCapital: "REA e capitale sociale",
  legalRepresentative: "Legale rappresentante",
  certifiedEmail: "PEC",
  serviceName: "Nome del servizio",
  website: "Sito web",
  privacyEmail: "Email per la privacy",
  supportEmail: "Email assistenza",
  dpoContact: "Contatto DPO",
  courtCity: "Foro competente",
  hostingRegion: "Area dei server",
  trialDays: "Giorni di prova",
  noticeDays: "Giorni di preavviso",
  exportDays: "Giorni per esportare i dati",
  breachHours: "Ore per avvisare di una violazione",
  deletionPath: "Percorso nell'app",
  deletionDays: "Giorni per la cancellazione",
  retentionTimelogs: "Conservazione timbrature",
  retentionPosition: "Conservazione coordinate",
  retentionRequests: "Conservazione richieste",
  retentionCertificate: "Conservazione codice certificato",
  retentionNotes: "Conservazione note",
  retentionDocuments: "Conservazione documenti",
  retentionAccessLogs: "Conservazione log",
  retentionTaxData: "Conservazione dati fiscali",
  collectsCertificateCode: "Raccolta del codice certificato",
  invoicingActive: "Fatturazione elettronica attiva",
  documentVersion: "Versione",
  effectiveFrom: "In vigore dal",
};

/** Fields the documents can do without. */
const OPTIONAL_FIELDS: Array<keyof CompanyProfile> = [
  "taxCode",
  "reaAndCapital",
  "dpoContact",
];

export function getMissingProfileFields(profile: CompanyProfile) {
  return (Object.keys(COMPANY_PROFILE_LABELS) as Array<keyof CompanyProfile>).filter((key) => {
    if (OPTIONAL_FIELDS.includes(key) || typeof profile[key] === "boolean") {
      return false;
    }

    return String(profile[key] ?? "").trim() === "";
  });
}

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const row = await prisma.companyProfile.findUnique({ where: { id: "singleton" } });
  const stored = (row?.data ?? {}) as Partial<CompanyProfile>;

  return { ...COMPANY_PROFILE_DEFAULTS, ...stored };
}

export async function saveCompanyProfile(profile: CompanyProfile) {
  await prisma.companyProfile.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", data: profile },
    update: { data: profile },
  });
}

export function readCompanyProfileFromForm(formData: FormData): CompanyProfile {
  const next = { ...COMPANY_PROFILE_DEFAULTS };

  for (const key of Object.keys(COMPANY_PROFILE_DEFAULTS) as Array<keyof CompanyProfile>) {
    const raw = formData.get(key);

    if (typeof COMPANY_PROFILE_DEFAULTS[key] === "boolean") {
      (next[key] as boolean) = raw === "on";
      continue;
    }

    (next[key] as string) = String(raw ?? "").trim();
  }

  return next;
}
