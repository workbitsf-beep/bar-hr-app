import "server-only";

import { AppLanguage, Role } from "@prisma/client";

type TranslationSet = {
  appName: string;
  menu: string;
  selectBar: string;
  changeBar: string;
  logout: string;
  language: string;
  calendar: string;
  dashboard: string;
  shifts: string;
  tasks: string;
  timelogs: string;
  board: string;
  requests: string;
  availability: string;
  people: string;
  settings: string;
  billing: string;
  personalPdf: string;
  exportPdf: string;
  noBarSelected: string;
  superAdmin: string;
};

const translations: Record<AppLanguage, TranslationSet> = {
  it: {
    appName: "Workbit ShiftHub",
    menu: "Menu",
    selectBar: "Seleziona un locale",
    changeBar: "Cambia locale",
    logout: "Esci",
    language: "Lingua",
    calendar: "Calendario",
    dashboard: "Dashboard",
    shifts: "Turni",
    tasks: "Mansioni",
    timelogs: "Timbrature",
    board: "Bacheca",
    requests: "Richieste",
    availability: "Indisponibilita",
    people: "Persone",
    settings: "Impostazioni",
    billing: "Abbonamento",
    personalPdf: "Profilo PDF",
    exportPdf: "Export PDF",
    noBarSelected: "Seleziona un locale",
    superAdmin: "Super Admin",
  },
  en: {
    appName: "Workbit ShiftHub",
    menu: "Menu",
    selectBar: "Select venue",
    changeBar: "Change venue",
    logout: "Log out",
    language: "Language",
    calendar: "Calendar",
    dashboard: "Dashboard",
    shifts: "Shifts",
    tasks: "Tasks",
    timelogs: "Time logs",
    board: "Board",
    requests: "Requests",
    availability: "Availability",
    people: "People",
    settings: "Settings",
    billing: "Billing",
    personalPdf: "Personal PDF",
    exportPdf: "Export PDF",
    noBarSelected: "Select venue",
    superAdmin: "Super Admin",
  },
  es: {
    appName: "Workbit ShiftHub",
    menu: "Menu",
    selectBar: "Selecciona local",
    changeBar: "Cambiar local",
    logout: "Cerrar sesion",
    language: "Idioma",
    calendar: "Calendario",
    dashboard: "Panel",
    shifts: "Turnos",
    tasks: "Tareas",
    timelogs: "Fichajes",
    board: "Tablon",
    requests: "Solicitudes",
    availability: "Disponibilidad",
    people: "Personas",
    settings: "Configuracion",
    billing: "Suscripcion",
    personalPdf: "PDF personal",
    exportPdf: "Exportar PDF",
    noBarSelected: "Selecciona local",
    superAdmin: "Super Admin",
  },
  fr: {
    appName: "Workbit ShiftHub",
    menu: "Menu",
    selectBar: "Choisir l'etablissement",
    changeBar: "Changer d'etablissement",
    logout: "Se deconnecter",
    language: "Langue",
    calendar: "Calendrier",
    dashboard: "Tableau de bord",
    shifts: "Plannings",
    tasks: "Taches",
    timelogs: "Pointages",
    board: "Tableau",
    requests: "Demandes",
    availability: "Disponibilites",
    people: "Equipe",
    settings: "Parametres",
    billing: "Abonnement",
    personalPdf: "PDF personnel",
    exportPdf: "Export PDF",
    noBarSelected: "Choisir l'etablissement",
    superAdmin: "Super Admin",
  },
};

const roleLabels: Record<AppLanguage, Record<string, string>> = {
  it: {
    SUPER_ADMIN: "Super Admin",
    OWNER: "Titolare",
    MANAGER: "Manager",
    EMPLOYEE: "Dipendente",
  },
  en: {
    SUPER_ADMIN: "Super Admin",
    OWNER: "Owner",
    MANAGER: "Manager",
    EMPLOYEE: "Employee",
  },
  es: {
    SUPER_ADMIN: "Super Admin",
    OWNER: "Propietario",
    MANAGER: "Manager",
    EMPLOYEE: "Empleado",
  },
  fr: {
    SUPER_ADMIN: "Super Admin",
    OWNER: "Proprietaire",
    MANAGER: "Manager",
    EMPLOYEE: "Employe",
  },
};

export function getTranslation(language: AppLanguage): TranslationSet {
  return translations[language] ?? translations.it;
}

export function getRoleLabel(language: AppLanguage, role: Role | string): string {
  return roleLabels[language]?.[role] ?? roleLabels.it[String(role)] ?? String(role);
}

export function getLanguageOptions() {
  return [
    { value: AppLanguage.it, label: "Italiano" },
    { value: AppLanguage.en, label: "English" },
    { value: AppLanguage.es, label: "Espanol" },
    { value: AppLanguage.fr, label: "Francais" },
  ];
}
