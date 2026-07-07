export type SupportedLanguage = "it" | "en" | "es" | "fr";

export const LANGUAGE_COOKIE_NAME = "preferred-language";

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  if (value === "en" || value === "es" || value === "fr") {
    return value;
  }

  return "it";
}

export function getLocale(language: string): string {
  const normalized = normalizeLanguage(language);

  if (normalized === "en") {
    return "en-US";
  }

  if (normalized === "es") {
    return "es-ES";
  }

  if (normalized === "fr") {
    return "fr-FR";
  }

  return "it-IT";
}

type RuntimeEntry = [string, Record<SupportedLanguage, string>];
type RuntimePattern = {
  pattern: RegExp;
  values: Record<SupportedLanguage, string>;
};

const runtimeEntries: RuntimeEntry[] = [
  ["Accedi", { it: "Accedi", en: "Sign in", es: "Acceder", fr: "Se connecter" }],
  [
    "Gestisci turni, timbrature, richieste e bacheca del locale da un unico spazio.",
    {
      it: "Gestisci turni, timbrature, richieste e bacheca del locale da un unico spazio.",
      en: "Manage shifts, time logs, requests and the venue board from one place.",
      es: "Gestiona turnos, fichajes, solicitudes y el tablon del local desde un unico espacio.",
      fr: "Gerez plannings, pointages, demandes et tableau interne du local depuis un seul espace.",
    },
  ],
  ["Email", { it: "Email", en: "Email", es: "Correo", fr: "Email" }],
  ["Password", { it: "Password", en: "Password", es: "Contrasena", fr: "Mot de passe" }],
  [
    "Inserisci la password",
    {
      it: "Inserisci la password",
      en: "Enter your password",
      es: "Introduce tu contrasena",
      fr: "Saisissez votre mot de passe",
    },
  ],
  ["Nascondi password", { it: "Nascondi password", en: "Hide password", es: "Ocultar contrasena", fr: "Masquer le mot de passe" }],
  ["Mostra password", { it: "Mostra password", en: "Show password", es: "Mostrar contrasena", fr: "Afficher le mot de passe" }],
  [
    "Hai dimenticato la password?",
    {
      it: "Hai dimenticato la password?",
      en: "Forgot your password?",
      es: "Has olvidado tu contrasena?",
      fr: "Mot de passe oublie ?",
    },
  ],
  ["Accesso in corso...", { it: "Accesso in corso...", en: "Signing in...", es: "Accediendo...", fr: "Connexion..." }],
  ["Entra", { it: "Entra", en: "Enter", es: "Entrar", fr: "Entrer" }],
  ["Credenziali non valide", { it: "Credenziali non valide", en: "Invalid credentials", es: "Credenciales no validas", fr: "Identifiants invalides" }],
  ["Accesso non riuscito", { it: "Accesso non riuscito", en: "Sign in failed", es: "Acceso fallido", fr: "Connexion echouee" }],
  [
    "Impossibile accedere in questo momento",
    {
      it: "Impossibile accedere in questo momento",
      en: "Unable to sign in right now",
      es: "No es posible acceder en este momento",
      fr: "Impossible de se connecter pour le moment",
    },
  ],
  ["Recupero accesso", { it: "Recupero accesso", en: "Access recovery", es: "Recuperar acceso", fr: "Recuperation d'acces" }],
  ["Password temporanea via email", { it: "Password temporanea via email", en: "Temporary password by email", es: "Contrasena temporal por email", fr: "Mot de passe temporaire par email" }],
  [
    "Inserisci la tua email. Ti invieremo una password temporanea e al prossimo accesso dovrai cambiarla.",
    {
      it: "Inserisci la tua email. Ti invieremo una password temporanea e al prossimo accesso dovrai cambiarla.",
      en: "Enter your email. We will send you a temporary password and you will need to change it at the next sign-in.",
      es: "Introduce tu email. Te enviaremos una contrasena temporal y deberas cambiarla en el siguiente acceso.",
      fr: "Saisissez votre email. Nous vous enverrons un mot de passe temporaire a modifier lors de la prochaine connexion.",
    },
  ],
  ["Invio password temporanea", { it: "Invio password temporanea", en: "Send temporary password", es: "Enviar contrasena temporal", fr: "Envoyer le mot de passe temporaire" }],
  ["Invio in corso...", { it: "Invio in corso...", en: "Sending...", es: "Enviando...", fr: "Envoi..." }],
  ["Torna al login", { it: "Torna al login", en: "Back to login", es: "Volver al login", fr: "Retour a la connexion" }],
  [
    "Se l'indirizzo esiste, riceverai una password temporanea via email.",
    {
      it: "Se l'indirizzo esiste, riceverai una password temporanea via email.",
      en: "If the address exists, you will receive a temporary password by email.",
      es: "Si la direccion existe, recibiras una contrasena temporal por email.",
      fr: "Si l'adresse existe, vous recevrez un mot de passe temporaire par email.",
    },
  ],
  [
    "Recupero password non disponibile.",
    {
      it: "Recupero password non disponibile.",
      en: "Password recovery is not available.",
      es: "La recuperacion de contrasena no esta disponible.",
      fr: "La recuperation du mot de passe n'est pas disponible.",
    },
  ],
  [
    "Impossibile inviare la richiesta in questo momento.",
    {
      it: "Impossibile inviare la richiesta in questo momento.",
      en: "Unable to send the request right now.",
      es: "No es posible enviar la solicitud en este momento.",
      fr: "Impossible d'envoyer la demande pour le moment.",
    },
  ],
  ["Primo accesso", { it: "Primo accesso", en: "First access", es: "Primer acceso", fr: "Premiere connexion" }],
  ["Cambia password", { it: "Cambia password", en: "Change password", es: "Cambiar contrasena", fr: "Changer le mot de passe" }],
  [
    "Per continuare devi impostare una nuova password personale.",
    {
      it: "Per continuare devi impostare una nuova password personale.",
      en: "To continue, you need to set a new personal password.",
      es: "Para continuar debes establecer una nueva contrasena personal.",
      fr: "Pour continuer, vous devez definir un nouveau mot de passe personnel.",
    },
  ],
  ["Nuova password", { it: "Nuova password", en: "New password", es: "Nueva contrasena", fr: "Nouveau mot de passe" }],
  ["Conferma password", { it: "Conferma password", en: "Confirm password", es: "Confirmar contrasena", fr: "Confirmer le mot de passe" }],
  ["Salvataggio...", { it: "Salvataggio...", en: "Saving...", es: "Guardando...", fr: "Enregistrement..." }],
  ["Salva password", { it: "Salva password", en: "Save password", es: "Guardar contrasena", fr: "Enregistrer le mot de passe" }],
  ["Dashboard", { it: "Dashboard", en: "Dashboard", es: "Panel", fr: "Tableau de bord" }],
  ["Calendario", { it: "Calendario", en: "Calendar", es: "Calendario", fr: "Calendrier" }],
  ["Turni", { it: "Turni", en: "Shifts", es: "Turnos", fr: "Plannings" }],
  ["Mansioni", { it: "Mansioni", en: "Tasks", es: "Tareas", fr: "Taches" }],
  ["Timbrature", { it: "Timbrature", en: "Time logs", es: "Fichajes", fr: "Pointages" }],
  ["Bacheca", { it: "Bacheca", en: "Board", es: "Tablon", fr: "Tableau" }],
  ["Richieste", { it: "Richieste", en: "Requests", es: "Solicitudes", fr: "Demandes" }],
  ["Indisponibilita", { it: "Indisponibilita", en: "Availability", es: "Disponibilidad", fr: "Disponibilites" }],
  ["Persone", { it: "Personale", en: "Staff", es: "Personal", fr: "Personnel" }],
  ["Impostazioni", { it: "Impostazioni", en: "Settings", es: "Configuracion", fr: "Parametres" }],
  ["Abbonamento", { it: "Abbonamento", en: "Billing", es: "Suscripcion", fr: "Abonnement" }],
  ["Profilo PDF", { it: "Profilo PDF", en: "Personal PDF", es: "PDF personal", fr: "PDF personnel" }],
  ["Export PDF", { it: "Export PDF", en: "Export PDF", es: "Exportar PDF", fr: "Export PDF" }],
  ["Super Admin", { it: "Super Admin", en: "Super Admin", es: "Super Admin", fr: "Super Admin" }],
  ["Abbonamento richiesto", { it: "Abbonamento richiesto", en: "Subscription required", es: "Suscripcion requerida", fr: "Abonnement requis" }],
  [
    "Questo locale e attualmente bloccato perche l'abbonamento non e attivo.",
    {
      it: "Questo locale e attualmente bloccato perche l'abbonamento non e attivo.",
      en: "This venue is currently locked because the subscription is not active.",
      es: "Este local esta bloqueado porque la suscripcion no esta activa.",
      fr: "Cet etablissement est bloque car l'abonnement n'est pas actif.",
    },
  ],
  [
    "Attiva o rinnova l'abbonamento per sbloccare turni, timbrature, mansioni, bacheca e report.",
    {
      it: "Attiva o rinnova l'abbonamento per sbloccare turni, timbrature, mansioni, bacheca e report.",
      en: "Activate or renew the subscription to unlock shifts, time logs, tasks, board and reports.",
      es: "Activa o renueva la suscripcion para desbloquear turnos, fichajes, tareas, tablon e informes.",
      fr: "Activez ou renouvelez l'abonnement pour debloquer plannings, pointages, taches, tableau et rapports.",
    },
  ],
  [
    "Contatta il titolare del locale per riattivare l'abbonamento e sbloccare le funzionalita operative.",
    {
      it: "Contatta il titolare del locale per riattivare l'abbonamento e sbloccare le funzionalita operative.",
      en: "Contact the venue owner to reactivate the subscription and unlock operational features.",
      es: "Contacta con el propietario del local para reactivar la suscripcion y desbloquear las funciones operativas.",
      fr: "Contactez le proprietaire du local pour reactiver l'abonnement et debloquer les fonctionnalites.",
    },
  ],
  ["Vai al billing", { it: "Vai al billing", en: "Go to billing", es: "Ir a suscripcion", fr: "Aller a l'abonnement" }],
  ["Nuovo messaggio", { it: "Nuovo messaggio", en: "New message", es: "Nuevo mensaje", fr: "Nouveau message" }],
  ["Messaggio", { it: "Messaggio", en: "Message", es: "Mensaje", fr: "Message" }],
  ["Messaggi recenti", { it: "Messaggi recenti", en: "Recent messages", es: "Mensajes recientes", fr: "Messages recents" }],
  ["Messaggio fissato", { it: "Messaggio fissato", en: "Pinned message", es: "Mensaje fijado", fr: "Message epingle" }],
  ["Pubblica", { it: "Pubblica", en: "Publish", es: "Publicar", fr: "Publier" }],
  ["Elimina messaggio", { it: "Elimina messaggio", en: "Delete message", es: "Eliminar mensaje", fr: "Supprimer le message" }],
  ["Messaggio", { it: "Messaggio", en: "Message", es: "Mensaje", fr: "Message" }],
  ["Messaggio in evidenza", { it: "Messaggio in evidenza", en: "Pinned message", es: "Mensaje destacado", fr: "Message en evidence" }],
  ["Messaggio interno", { it: "Messaggio interno", en: "Internal message", es: "Mensaje interno", fr: "Message interne" }],
  ["Nuova indisponibilita", { it: "Nuova indisponibilita", en: "New unavailability", es: "Nueva indisponibilidad", fr: "Nouvelle indisponibilite" }],
  ["Calendario indisponibilita", { it: "Calendario indisponibilita", en: "Unavailability calendar", es: "Calendario de indisponibilidad", fr: "Calendrier des indisponibilites" }],
  ["Motivo", { it: "Motivo", en: "Reason", es: "Motivo", fr: "Motif" }],
  ["Da", { it: "Da", en: "From", es: "Desde", fr: "Du" }],
  ["A", { it: "A", en: "To", es: "Hasta", fr: "Au" }],
  ["Salva indisponibilita", { it: "Salva indisponibilita", en: "Save unavailability", es: "Guardar indisponibilidad", fr: "Enregistrer l'indisponibilite" }],
  ["La tua indisponibilita", { it: "La tua indisponibilita", en: "Your unavailability", es: "Tu indisponibilidad", fr: "Votre indisponibilite" }],
  ["Nessuna nota aggiuntiva", { it: "Nessuna nota aggiuntiva", en: "No additional note", es: "Sin nota adicional", fr: "Aucune note supplementaire" }],
  ["Nuova mansione", { it: "Nuova mansione", en: "New task", es: "Nueva tarea", fr: "Nouvelle tache" }],
  ["Crea nuova mansione", { it: "Crea nuova mansione", en: "Create new task", es: "Crear nueva tarea", fr: "Creer une nouvelle tache" }],
  ["Titolo", { it: "Titolo", en: "Title", es: "Titulo", fr: "Titre" }],
  ["Descrizione", { it: "Descrizione", en: "Description", es: "Descripcion", fr: "Description" }],
  ["Scadenza", { it: "Scadenza", en: "Due date", es: "Vencimiento", fr: "Echeance" }],
  ["Assegna a", { it: "Assegna a", en: "Assign to", es: "Asignar a", fr: "Assigner a" }],
  ["Nessun singolo assegnatario", { it: "Nessun singolo assegnatario", en: "No single assignee", es: "Sin asignatario individual", fr: "Aucun destinataire unique" }],
  ["Assegna a tutto il team", { it: "Assegna a tutto il team", en: "Assign to the whole team", es: "Asignar a todo el equipo", fr: "Assigner a toute l'equipe" }],
  ["Assegnato a tutto il team", { it: "Assegnato a tutto il team", en: "Assigned to the whole team", es: "Asignado a todo el equipo", fr: "Assigne a toute l'equipe" }],
  ["Segna come urgente", { it: "Segna come urgente", en: "Mark as urgent", es: "Marcar como urgente", fr: "Marquer comme urgent" }],
  ["Salva mansione", { it: "Salva mansione", en: "Save task", es: "Guardar tarea", fr: "Enregistrer la tache" }],
  ["Conferma mansione", { it: "Conferma mansione", en: "Confirm task", es: "Confirmar tarea", fr: "Confirmer la tache" }],
  ["Elenco mansioni", { it: "Elenco mansioni", en: "Task list", es: "Lista de tareas", fr: "Liste des taches" }],
  ["Nessuna mansione disponibile.", { it: "Nessuna mansione disponibile.", en: "No task available.", es: "No hay tareas disponibles.", fr: "Aucune tache disponible." }],
  ["Assegnata a tutto il team", { it: "Assegnata a tutto il team", en: "Assigned to the whole team", es: "Asignada a todo el equipo", fr: "Assignee a toute l'equipe" }],
  ["Senza assegnatario singolo", { it: "Senza assegnatario singolo", en: "No single assignee", es: "Sin asignatario individual", fr: "Sans destinataire unique" }],
  ["TODO", { it: "Da fare", en: "To do", es: "Por hacer", fr: "A faire" }],
  ["DONE", { it: "Completata", en: "Done", es: "Completada", fr: "Terminee" }],
  ["Non assegnata", { it: "Non assegnata", en: "Not assigned", es: "No asignada", fr: "Non assignee" }],
  ["Segna completata", { it: "Segna completata", en: "Mark as completed", es: "Marcar como completada", fr: "Marquer comme terminee" }],
  ["Elimina mansione completata", { it: "Elimina mansione completata", en: "Delete completed task", es: "Eliminar tarea completada", fr: "Supprimer la tache terminee" }],
  ["Richiedi ferie o permesso", { it: "Richiedi ferie o permesso", en: "Request vacation or leave", es: "Solicitar vacaciones o permiso", fr: "Demander conges ou permission" }],
  ["Richiedi cambio turno", { it: "Richiedi cambio turno", en: "Request shift swap", es: "Solicitar cambio de turno", fr: "Demander un echange de planning" }],
  ["Tipo", { it: "Tipo", en: "Type", es: "Tipo", fr: "Type" }],
  ["Ferie", { it: "Ferie", en: "Vacation", es: "Vacaciones", fr: "Conges" }],
  ["Permesso", { it: "Permesso", en: "Leave", es: "Permiso", fr: "Permission" }],
  ["Invia richiesta", { it: "Invia richiesta", en: "Send request", es: "Enviar solicitud", fr: "Envoyer la demande" }],
  ["Turno da cambiare", { it: "Turno da cambiare", en: "Shift to change", es: "Turno a cambiar", fr: "Planning a echanger" }],
  ["Seleziona un turno", { it: "Seleziona un turno", en: "Select a shift", es: "Selecciona un turno", fr: "Selectionnez un planning" }],
  ["Collega coinvolto", { it: "Collega coinvolto", en: "Coworker involved", es: "Companero implicado", fr: "Collegue implique" }],
  ["Seleziona un collega", { it: "Seleziona un collega", en: "Select a coworker", es: "Selecciona un companero", fr: "Selectionnez un collegue" }],
  ["Invia cambio turno", { it: "Invia cambio turno", en: "Send shift swap request", es: "Enviar cambio de turno", fr: "Envoyer l'echange de planning" }],
  ["Storico richieste", { it: "Storico richieste", en: "Request history", es: "Historial de solicitudes", fr: "Historique des demandes" }],
  ["Nessuna richiesta presente.", { it: "Nessuna richiesta presente.", en: "No request found.", es: "No hay solicitudes.", fr: "Aucune demande presente." }],
  ["Cambio turno", { it: "Cambio turno", en: "Shift swap", es: "Cambio de turno", fr: "Echange de planning" }],
  ["Data non disponibile", { it: "Data non disponibile", en: "Date not available", es: "Fecha no disponible", fr: "Date non disponible" }],
  ["Nessun dettaglio aggiuntivo", { it: "Nessun dettaglio aggiuntivo", en: "No additional detail", es: "Sin detalle adicional", fr: "Aucun detail supplementaire" }],
  ["Approva", { it: "Approva", en: "Approve", es: "Aprobar", fr: "Approuver" }],
  ["Rifiuta", { it: "Rifiuta", en: "Reject", es: "Rechazar", fr: "Refuser" }],
  ["Aggiungi timbratura manuale", { it: "Aggiungi timbratura manuale", en: "Add manual time log", es: "Agregar fichaje manual", fr: "Ajouter un pointage manuel" }],
  ["Dipendente", { it: "Dipendente", en: "Employee", es: "Empleado", fr: "Employe" }],
  ["Seleziona", { it: "Seleziona", en: "Select", es: "Selecciona", fr: "Selectionner" }],
  ["Entrata", { it: "Entrata", en: "Clock in", es: "Entrada", fr: "Entree" }],
  ["Uscita", { it: "Uscita", en: "Clock out", es: "Salida", fr: "Sortie" }],
  ["Timestamp", { it: "Timestamp", en: "Timestamp", es: "Marca de tiempo", fr: "Horodatage" }],
  ["Nota", { it: "Nota", en: "Note", es: "Nota", fr: "Note" }],
  ["Salva timbratura manuale", { it: "Salva timbratura manuale", en: "Save manual time log", es: "Guardar fichaje manual", fr: "Enregistrer le pointage manuel" }],
  ["Timbratura veloce", { it: "Timbratura veloce", en: "Quick clock", es: "Fichaje rapido", fr: "Pointage rapide" }],
  ["Entrata / uscita", { it: "Entrata / uscita", en: "Clock in / out", es: "Entrada / salida", fr: "Entree / sortie" }],
  ["GPS non configurato", { it: "GPS non configurato", en: "GPS not configured", es: "GPS no configurado", fr: "GPS non configure" }],
  ["Aggiorna posizione", { it: "Aggiorna posizione", en: "Update location", es: "Actualizar posicion", fr: "Mettre a jour la position" }],
  ["Entrata registrata.", { it: "Entrata registrata.", en: "Clock in recorded.", es: "Entrada registrada.", fr: "Entree enregistree." }],
  ["Operazione non riuscita", { it: "Operazione non riuscita", en: "Operation failed", es: "Operacion fallida", fr: "Operation echouee" }],
  ["Impossibile contattare il servizio timbrature.", { it: "Impossibile contattare il servizio timbrature.", en: "Unable to reach the time log service.", es: "No es posible contactar el servicio de fichajes.", fr: "Impossible de contacter le service de pointage." }],
  ["Geolocalizzazione non disponibile.", { it: "Geolocalizzazione non disponibile.", en: "Geolocation unavailable.", es: "Geolocalizacion no disponible.", fr: "Geolocalisation indisponible." }],
  ["Impossibile leggere la posizione attuale.", { it: "Impossibile leggere la posizione attuale.", en: "Unable to read the current location.", es: "No es posible leer la posicion actual.", fr: "Impossible de lire la position actuelle." }],
  ["Configura il GPS del locale per abilitare la timbratura.", { it: "Configura il GPS del locale per abilitare la timbratura.", en: "Configure the venue GPS to enable clocking.", es: "Configura el GPS del local para habilitar el fichaje.", fr: "Configurez le GPS du local pour activer le pointage." }],
  ["Le tue timbrature", { it: "Le tue timbrature", en: "Your time logs", es: "Tus fichajes", fr: "Vos pointages" }],
  ["Totale ore personale", { it: "Totale ore personale", en: "Personal hours total", es: "Total de horas personal", fr: "Total d'heures personnel" }],
  ["Ore reali", { it: "Ore reali", en: "Real hours", es: "Horas reales", fr: "Heures reelles" }],
  ["Ore lavorate", { it: "Ore lavorate", en: "Worked hours", es: "Horas trabajadas", fr: "Heures travaillees" }],
  ["Manuale", { it: "Manuale", en: "Manual", es: "Manual", fr: "Manuel" }],
  ["Confermato", { it: "Confermato", en: "Confirmed", es: "Confirmado", fr: "Confirme" }],
  ["Da confermare", { it: "Da confermare", en: "To confirm", es: "Por confirmar", fr: "A confirmer" }],
  ["Oggi", { it: "Oggi", en: "Today", es: "Hoy", fr: "Aujourd'hui" }],
  ["Nessun evento", { it: "Nessun evento", en: "No event", es: "Sin eventos", fr: "Aucun evenement" }],
  ["Invio turni", { it: "Invio turni", en: "Shift sending", es: "Envio de turnos", fr: "Envoi des plannings" }],
  ["Tutti inviati", { it: "Tutti inviati", en: "All sent", es: "Todos enviados", fr: "Tous envoyes" }],
  ["Configurazione locale", { it: "Configurazione locale", en: "Venue setup", es: "Configuracion del local", fr: "Configuration du local" }],
  ["Stato abbonamento", { it: "Stato abbonamento", en: "Subscription status", es: "Estado de la suscripcion", fr: "Etat de l'abonnement" }],
  ["Attivo", { it: "Attivo", en: "Active", es: "Activo", fr: "Actif" }],
  ["In trial", { it: "In trial", en: "In trial", es: "En prueba", fr: "En essai" }],
  ["Pagamento fallito", { it: "Pagamento fallito", en: "Payment failed", es: "Pago fallido", fr: "Paiement echoue" }],
  ["Cancellato", { it: "Cancellato", en: "Canceled", es: "Cancelado", fr: "Annule" }],
  ["Non pagato", { it: "Non pagato", en: "Unpaid", es: "Impagado", fr: "Impayee" }],
  ["Inattivo", { it: "Inattivo", en: "Inactive", es: "Inactivo", fr: "Inactif" }],
  ["Questo locale e sbloccato da un piano gestito manualmente dal super admin.", { it: "Questo locale e sbloccato da un piano gestito manualmente dal super admin.", en: "This venue is unlocked by a plan managed manually by the super admin.", es: "Este local esta desbloqueado por un plan gestionado manualmente por el super admin.", fr: "Cet etablissement est debloque par un plan gere manuellement par le super admin." }],
  ["Chiudi", { it: "Chiudi", en: "Close", es: "Cerrar", fr: "Fermer" }],
  ["Crea titolare", { it: "Crea titolare", en: "Create owner", es: "Crear propietario", fr: "Creer le proprietaire" }],
  ["Crea bar", { it: "Crea bar", en: "Create venue", es: "Crear local", fr: "Creer le local" }],
  ["Pagamenti", { it: "Pagamenti", en: "Payments", es: "Pagos", fr: "Paiements" }],
  ["Nome", { it: "Nome", en: "First name", es: "Nombre", fr: "Prenom" }],
  ["Cognome", { it: "Cognome", en: "Last name", es: "Apellido", fr: "Nom" }],
  ["Password iniziale", { it: "Password iniziale", en: "Initial password", es: "Contrasena inicial", fr: "Mot de passe initial" }],
  ["Lingua", { it: "Lingua", en: "Language", es: "Idioma", fr: "Langue" }],
  ["Nome bar", { it: "Nome bar", en: "Venue name", es: "Nombre del local", fr: "Nom du local" }],
  ["Email locale", { it: "Email locale", en: "Venue email", es: "Email del local", fr: "Email du local" }],
  ["Telefono", { it: "Telefono", en: "Phone", es: "Telefono", fr: "Telephone" }],
  ["Indirizzo", { it: "Indirizzo", en: "Address", es: "Direccion", fr: "Adresse" }],
  ["Citta", { it: "Citta", en: "City", es: "Ciudad", fr: "Ville" }],
  ["CAP", { it: "CAP", en: "Postal code", es: "Codigo postal", fr: "Code postal" }],
  ["Pagamenti", { it: "Pagamenti", en: "Payments", es: "Pagos", fr: "Paiements" }],
  ["FREE", { it: "FREE", en: "FREE", es: "FREE", fr: "FREE" }],
  ["LIFETIME", { it: "LIFETIME", en: "LIFETIME", es: "LIFETIME", fr: "LIFETIME" }],
  ["PAID", { it: "PAID", en: "PAID", es: "PAID", fr: "PAID" }],
  ["TRIAL", { it: "TRIAL", en: "TRIAL", es: "TRIAL", fr: "TRIAL" }],
  ["ACTIVE", { it: "ATTIVO", en: "ACTIVE", es: "ACTIVO", fr: "ACTIF" }],
  ["TRIALING", { it: "IN PROVA", en: "TRIALING", es: "EN PRUEBA", fr: "EN ESSAI" }],
  ["PAST_DUE", { it: "SCADUTO", en: "PAST DUE", es: "VENCIDO", fr: "EN RETARD" }],
  ["CANCELED", { it: "CANCELLATO", en: "CANCELED", es: "CANCELADO", fr: "ANNULE" }],
  ["UNPAID", { it: "NON PAGATO", en: "UNPAID", es: "IMPAGADO", fr: "IMPAYE" }],
  ["INACTIVE", { it: "INATTIVO", en: "INACTIVE", es: "INACTIVO", fr: "INACTIF" }],
  ["OWNER", { it: "Titolare", en: "Owner", es: "Propietario", fr: "Proprietaire" }],
  ["MANAGER", { it: "Responsabile", en: "Supervisor", es: "Responsable", fr: "Responsable" }],
  ["AMMINISTRAZIONE", { it: "Amministrazione", en: "Administration", es: "Administracion", fr: "Administration" }],
  ["EMPLOYEE", { it: "Dipendente", en: "Employee", es: "Empleado", fr: "Employe" }],
  [
    "La password deve avere almeno 6 caratteri.",
    {
      it: "La password deve avere almeno 6 caratteri.",
      en: "The password must contain at least 6 characters.",
      es: "La contrasena debe tener al menos 6 caracteres.",
      fr: "Le mot de passe doit contenir au moins 6 caracteres.",
    },
  ],
  [
    "Le password non coincidono.",
    {
      it: "Le password non coincidono.",
      en: "Passwords do not match.",
      es: "Las contrasenas no coinciden.",
      fr: "Les mots de passe ne correspondent pas.",
    },
  ],
  [
    "Impossibile aggiornare la password",
    {
      it: "Impossibile aggiornare la password",
      en: "Unable to update the password",
      es: "No es posible actualizar la contrasena",
      fr: "Impossible de mettre a jour le mot de passe",
    },
  ],
  [
    "Impossibile aggiornare la password in questo momento",
    {
      it: "Impossibile aggiornare la password in questo momento",
      en: "Unable to update the password right now",
      es: "No es posible actualizar la contrasena en este momento",
      fr: "Impossible de mettre a jour le mot de passe pour le moment",
    },
  ],
  [
    "Posizione GPS gia salvata. Restera questa finche non la aggiorni.",
    {
      it: "Posizione GPS gia salvata. Restera questa finche non la aggiorni.",
      en: "GPS location already saved. It will stay this way until you update it again.",
      es: "La posicion GPS ya esta guardada. Se mantendra asi hasta que la actualices de nuevo.",
      fr: "La position GPS est deja enregistree. Elle restera ainsi jusqu'a une nouvelle mise a jour.",
    },
  ],
  [
    "Nessuna posizione GPS salvata.",
    {
      it: "Nessuna posizione GPS salvata.",
      en: "No GPS location saved yet. Use the button to register it.",
      es: "No hay ninguna posicion GPS guardada. Usa el boton para registrarla.",
      fr: "Aucune position GPS enregistree. Utilisez le bouton pour l'enregistrer.",
    },
  ],
  [
    "Geolocalizzazione non disponibile su questo dispositivo.",
    {
      it: "Geolocalizzazione non disponibile su questo dispositivo.",
      en: "Geolocation is not available on this device.",
      es: "La geolocalizacion no esta disponible en este dispositivo.",
      fr: "La geolocalisation n'est pas disponible sur cet appareil.",
    },
  ],
  [
    "Posizione acquisita. Salva per confermare questo punto GPS.",
    {
      it: "Posizione acquisita. Salva per confermare questo punto GPS.",
      en: "Location captured. Save to confirm this GPS point.",
      es: "Posicion adquirida. Guarda para confirmar este punto GPS.",
      fr: "Position acquise. Enregistrez pour confirmer ce point GPS.",
    },
  ],
  [
    "Impossibile leggere la posizione attuale. Controlla i permessi GPS.",
    {
      it: "Impossibile leggere la posizione attuale. Controlla i permessi GPS.",
      en: "Unable to read the current location. Check GPS permissions.",
      es: "No es posible leer la posicion actual. Comprueba los permisos GPS.",
      fr: "Impossible de lire la position actuelle. Verifiez les autorisations GPS.",
    },
  ],
  ["Posizione del locale", { it: "Posizione del locale", en: "Venue location", es: "Posicion del local", fr: "Position du local" }],
  ["Localizzazione...", { it: "Localizzazione...", en: "Locating...", es: "Localizando...", fr: "Localisation..." }],
  ["Localizza la mia posizione", { it: "Localizza la mia posizione", en: "Locate my position", es: "Localizar mi posicion", fr: "Localiser ma position" }],
  ["Workspace", { it: "Spazio di lavoro", en: "Workspace", es: "Espacio de trabajo", fr: "Espace de travail" }],
  ["Apri sezione", { it: "Apri sezione", en: "Open section", es: "Abrir seccion", fr: "Ouvrir la section" }],
  ["Chiudi menu", { it: "Chiudi menu", en: "Close menu", es: "Cerrar menu", fr: "Fermer le menu" }],
  ["Navigazione dashboard", { it: "Navigazione dashboard", en: "Dashboard navigation", es: "Navegacion del panel", fr: "Navigation du tableau de bord" }],
  ["Ore del mese", { it: "Ore del mese", en: "Hours this month", es: "Horas del mes", fr: "Heures du mois" }],
  ["Turni in arrivo", { it: "Turni in arrivo", en: "Upcoming shifts", es: "Proximos turnos", fr: "Plannings a venir" }],
  ["Nessun turno schedulato al momento.", { it: "Nessun turno schedulato al momento.", en: "No shifts scheduled right now.", es: "No hay turnos programados por ahora.", fr: "Aucun planning prevu pour le moment." }],
  ["Turno condiviso", { it: "Il tuo turno", en: "Your shift", es: "Tu turno", fr: "Ton service" }],
  ["Mansioni aperte", { it: "Mansioni aperte", en: "Open tasks", es: "Tareas abiertas", fr: "Taches ouvertes" }],
  ["Nessuna mansione aperta per il locale.", { it: "Nessuna mansione aperta per il locale.", en: "No open task for this venue.", es: "No hay tareas abiertas para el local.", fr: "Aucune tache ouverte pour cet etablissement." }],
  ["In attesa di completamento", { it: "In attesa di completamento", en: "Waiting for completion", es: "Pendiente de completar", fr: "En attente de completion" }],
  ["Richieste in sospeso", { it: "Richieste in sospeso", en: "Pending requests", es: "Solicitudes pendientes", fr: "Demandes en attente" }],
  ["Tutto aggiornato", { it: "Tutto aggiornato", en: "Everything is up to date", es: "Todo actualizado", fr: "Tout est a jour" }],
  ["Nessuna richiesta in sospeso da gestire.", { it: "Nessuna richiesta in sospeso da gestire.", en: "There are no pending requests to manage.", es: "No hay solicitudes pendientes por gestionar.", fr: "Aucune demande en attente a gerer." }],
  ["Controlla lo stato delle tue richieste e dei cambi turno.", { it: "Controlla lo stato delle tue richieste e dei cambi turno.", en: "Check the status of your requests and shift swaps.", es: "Consulta el estado de tus solicitudes y cambios de turno.", fr: "Consultez l'etat de vos demandes et echanges de planning." }],
  ["Team attivo", { it: "Team attivo", en: "Active team", es: "Equipo activo", fr: "Equipe active" }],
  ["Nessun membro attivo collegato al locale.", { it: "Nessun membro attivo collegato al locale.", en: "No active member is linked to this venue.", es: "No hay miembros activos vinculados al local.", fr: "Aucun membre actif n'est lie a cet etablissement." }],
  ["Timbrature del team", { it: "Timbrature del team", en: "Team time logs", es: "Fichajes del equipo", fr: "Pointages de l'equipe" }],
  ["Filtra per giorno", { it: "Filtra per giorno", en: "Filter by day", es: "Filtrar por dia", fr: "Filtrer par jour" }],
  ["Nessuna timbratura registrata.", { it: "Nessuna timbratura registrata.", en: "No time logs recorded.", es: "No hay fichajes registrados.", fr: "Aucun pointage enregistre." }],
  ["Chiudi popup timbrature", { it: "Chiudi popup timbrature", en: "Close time log popup", es: "Cerrar ventana de fichajes", fr: "Fermer la fenetre des pointages" }],
  ["Nessuna timbratura trovata per il giorno selezionato.", { it: "Nessuna timbratura trovata per il giorno selezionato.", en: "No time log found for the selected day.", es: "No se ha encontrado ningun fichaje para el dia seleccionado.", fr: "Aucun pointage trouve pour le jour selectionne." }],
  ["Coordinate non salvate", { it: "Coordinate non salvate", en: "Coordinates not saved", es: "Coordenadas no guardadas", fr: "Coordonnees non enregistrees" }],
  ["ufficiale", { it: "ufficiale", en: "official", es: "oficial", fr: "officiel" }],
  ["Create Bar", { it: "Crea locale", en: "Create venue", es: "Crear local", fr: "Creer l'etablissement" }],
  ["Set GPS", { it: "Imposta GPS", en: "Set GPS", es: "Configurar GPS", fr: "Definir le GPS" }],
  ["Rounding Rules", { it: "Regole arrotondamento 5 minuti", en: "Rounding rules", es: "Reglas de redondeo", fr: "Regles d'arrondi" }],
  ["Invite Employees", { it: "Invita dipendenti", en: "Invite employees", es: "Invitar empleados", fr: "Inviter des employes" }],
  ["SaaS onboarding", { it: "Onboarding SaaS", en: "SaaS onboarding", es: "Onboarding SaaS", fr: "Onboarding SaaS" }],
  ["Set up your bar workspace", { it: "Configura lo spazio di lavoro del locale", en: "Set up your bar workspace", es: "Configura el espacio de trabajo del local", fr: "Configurez l'espace de travail du local" }],
  ["Move step by step. Every section saves directly to the database so you can leave and continue later.", { it: "Procedi passo dopo passo. Ogni sezione salva direttamente nel database, cosi puoi uscire e continuare più tardi.", en: "Move step by step. Every section saves directly to the database so you can leave and continue later.", es: "Avanza paso a paso. Cada seccion guarda directamente en la base de datos para que puedas salir y continuar mas tarde.", fr: "Avancez etape par etape. Chaque section enregistre directement dans la base de donnees afin que vous puissiez reprendre plus tard." }],
  ["Create your first bar", { it: "Crea il tuo primo locale", en: "Create your first venue", es: "Crea tu primer local", fr: "Creez votre premier etablissement" }],
  ["Start by creating the main bar profile. You can add more bars later from the owner dashboard.", { it: "Inizia creando il profilo principale del locale. Potrai aggiungere altri locali più tardi dalla dashboard titolare.", en: "Start by creating the main venue profile. You can add more venues later from the owner dashboard.", es: "Empieza creando el perfil principal del local. Podras anadir mas locales mas adelante desde el panel del propietario.", fr: "Commencez par creer le profil principal de l'etablissement. Vous pourrez ajouter d'autres etablissements plus tard depuis le tableau du proprietaire." }],
  ["Bar name", { it: "Nome locale", en: "Venue name", es: "Nombre del local", fr: "Nom de l'etablissement" }],
  ["Save and continue", { it: "Salva e continua", en: "Save and continue", es: "Guardar y continuar", fr: "Enregistrer et continuer" }],
  ["Set GPS location", { it: "Imposta la posizione GPS", en: "Set GPS location", es: "Configurar la posicion GPS", fr: "Definir la position GPS" }],
  ["Employees will use this location when clocking in and clocking out.", { it: "I dipendenti useranno questa posizione per timbrare entrata e uscita.", en: "Employees will use this location when clocking in and clocking out.", es: "Los empleados usaran esta posicion al fichar entrada y salida.", fr: "Les employes utiliseront cette position pour pointer l'entree et la sortie." }],
  ["Radius in meters", { it: "Raggio in metri", en: "Radius in meters", es: "Radio en metros", fr: "Rayon en metres" }],
  ["Save GPS and continue", { it: "Salva GPS e continua", en: "Save GPS and continue", es: "Guardar GPS y continuar", fr: "Enregistrer le GPS et continuer" }],
  ["Set rounding rules", { it: "Imposta la regola di arrotondamento", en: "Set rounding rules", es: "Configurar las reglas de redondeo", fr: "Definir les regles d'arrondi" }],
  ["This step is optional. You can enable it now or leave it disabled and configure it later.", { it: "Questo passaggio e facoltativo. Puoi attivarlo ora oppure lasciarlo disattivato e configurarlo più tardi.", en: "This step is optional. You can enable it now or leave it disabled and configure it later.", es: "Este paso es opcional. Puedes activarlo ahora o dejarlo desactivado y configurarlo mas tarde.", fr: "Cette etape est facultative. Vous pouvez l'activer maintenant ou la laisser desactivee et la configurer plus tard." }],
  ["Enable rounding", { it: "Attiva arrotondamento con tolleranza", en: "Enable rounding", es: "Activar redondeo", fr: "Activer l'arrondi" }],
  ["Rounding minutes", { it: "Minuti di tolleranza", en: "Rounding minutes", es: "Minutos de redondeo", fr: "Minutes d'arrondi" }],
  ["Rounding mode", { it: "Modalita di arrotondamento", en: "Rounding mode", es: "Modo de redondeo", fr: "Mode d'arrondi" }],
  ["5 minutes", { it: "5 minuti", en: "5 minutes", es: "5 minutos", fr: "5 minutes" }],
  ["10 minutes", { it: "10 minuti", en: "10 minutes", es: "10 minutos", fr: "10 minutes" }],
  ["15 minutes", { it: "15 minuti", en: "15 minutes", es: "15 minutos", fr: "15 minutes" }],
  ["Nearest", { it: "Più vicino", en: "Nearest", es: "Mas cercano", fr: "Le plus proche" }],
  ["Up", { it: "Per eccesso", en: "Up", es: "Hacia arriba", fr: "Vers le haut" }],
  ["Down", { it: "Per difetto", en: "Down", es: "Hacia abajo", fr: "Vers le bas" }],
  ["Save rules and continue", { it: "Salva regole e continua", en: "Save rules and continue", es: "Guardar reglas y continuar", fr: "Enregistrer les regles et continuer" }],
  ["Invite first employees", { it: "Invita i primi dipendenti", en: "Invite first employees", es: "Invita a los primeros empleados", fr: "Inviter les premiers employes" }],
  ["Create the first employee accounts now. They will be asked to change password at first sign-in.", { it: "Crea ora i primi account del team. Al primo accesso verranno obbligati a cambiare password.", en: "Create the first employee accounts now. They will be asked to change password at first sign-in.", es: "Crea ahora las primeras cuentas del equipo. Se les pedira cambiar la contrasena en el primer acceso.", fr: "Creez maintenant les premiers comptes employes. Un changement de mot de passe leur sera demande lors de la premiere connexion." }],
  ["First name", { it: "Nome", en: "First name", es: "Nombre", fr: "Prenom" }],
  ["Last name", { it: "Cognome", en: "Last name", es: "Apellido", fr: "Nom" }],
  ["Temporary password", { it: "Password temporanea", en: "Temporary password", es: "Contrasena temporal", fr: "Mot de passe temporaire" }],
  ["Role", { it: "Ruolo", en: "Role", es: "Rol", fr: "Role" }],
  ["Invite employee", { it: "Invita dipendente", en: "Invite employee", es: "Invitar empleado", fr: "Inviter l'employe" }],
  ["Current team", { it: "Team attuale", en: "Current team", es: "Equipo actual", fr: "Equipe actuelle" }],
  ["These employees are already linked to the bar.", { it: "Questi dipendenti sono gia collegati al locale.", en: "These employees are already linked to the venue.", es: "Estos empleados ya estan vinculados al local.", fr: "Ces employes sont deja lies a l'etablissement." }],
  ["No employees invited yet. You can still finish and add them later.", { it: "Non hai ancora invitato dipendenti. Puoi comunque terminare e aggiungerli più tardi.", en: "No employees invited yet. You can still finish and add them later.", es: "Todavia no hay empleados invitados. Puedes terminar y anadirlos mas tarde.", fr: "Aucun employe invite pour le moment. Vous pouvez terminer maintenant et les ajouter plus tard." }],
  ["Invitati", { it: "Invitati", en: "Invited", es: "Invitados", fr: "Invites" }],
  ["Gia collegato", { it: "Gia collegato", en: "Already linked", es: "Ya vinculado", fr: "Deja lie" }],
  ["Da collegare", { it: "Da collegare", en: "To link", es: "Por vincular", fr: "A lier" }],
  ["Finish onboarding now if you prefer to invite employees later from the dashboard.", { it: "Completa ora l'onboarding se preferisci invitare altri dipendenti più tardi dalla dashboard.", en: "Finish onboarding now if you prefer to invite employees later from the dashboard.", es: "Termina ahora el onboarding si prefieres invitar empleados mas tarde desde el panel.", fr: "Terminez maintenant l'onboarding si vous preferez inviter les employes plus tard depuis le tableau de bord." }],
  ["Finish onboarding", { it: "Completa onboarding", en: "Finish onboarding", es: "Finalizar onboarding", fr: "Terminer l'onboarding" }],
  ["Billing", { it: "Abbonamento", en: "Billing", es: "Suscripcion", fr: "Abonnement" }],
  ["Il super admin gestisce i piani dalla console dedicata.", { it: "Il super admin gestisce i piani dalla console dedicata.", en: "The super admin manages plans from the dedicated console.", es: "El super admin gestiona los planes desde la consola dedicada.", fr: "Le super admin gere les offres depuis la console dediee." }],
  ["Seleziona un locale attivo per gestire l'abbonamento.", { it: "Seleziona un locale attivo per gestire l'abbonamento.", en: "Select an active venue to manage the subscription.", es: "Selecciona un local activo para gestionar la suscripcion.", fr: "Selectionnez un etablissement actif pour gerer l'abonnement." }],
  ["Solo il titolare puo gestire l'abbonamento del locale.", { it: "Solo il titolare puo gestire l'abbonamento del locale.", en: "Only the owner can manage the venue subscription.", es: "Solo el propietario puede gestionar la suscripcion del local.", fr: "Seul le proprietaire peut gerer l'abonnement du local." }],
  ["Locale attivo", { it: "Locale attivo", en: "Active venue", es: "Local activo", fr: "Etablissement actif" }],
  ["Free", { it: "Gratis", en: "Free", es: "Gratis", fr: "Gratuit" }],
  ["Trial", { it: "Prova", en: "Trial", es: "Prueba", fr: "Essai" }],
  ["Lifetime", { it: "A vita", en: "Lifetime", es: "Vitalicio", fr: "A vie" }],
  ["Paid", { it: "A pagamento", en: "Paid", es: "De pago", fr: "Payant" }],
  ["Mensile", { it: "Mensile", en: "Monthly", es: "Mensual", fr: "Mensuel" }],
  ["Annuale", { it: "Annuale", en: "Yearly", es: "Anual", fr: "Annuel" }],
  ["Non impostato", { it: "Non impostato", en: "Not set", es: "No configurado", fr: "Non defini" }],
  ["Non disponibile", { it: "Non disponibile", en: "Unavailable", es: "No disponible", fr: "Indisponible" }],
  ["Per attivare il periodo di prova devi inserire una carta su Stripe. La prova dura sempre 30 giorni: non verra addebitato nulla adesso e, alla fine dei 30 giorni, il piano scelto si rinnovera automaticamente.", { it: "Per attivare il periodo di prova devi inserire una carta su Stripe. La prova dura sempre 30 giorni: non verra addebitato nulla adesso e, alla fine dei 30 giorni, il piano scelto si rinnovera automaticamente.", en: "To activate the trial period you need to add a card on Stripe. The trial always lasts 30 days: nothing will be charged now and, at the end of the 30 days, the chosen plan will renew automatically.", es: "Para activar el periodo de prueba debes introducir una tarjeta en Stripe. La prueba siempre dura 30 dias: no se cobrara nada ahora y, al final de los 30 dias, el plan elegido se renovara automaticamente.", fr: "Pour activer la periode d'essai, vous devez ajouter une carte sur Stripe. L'essai dure toujours 30 jours : rien ne sera facture maintenant et, a la fin des 30 jours, l'offre choisie se renouvellera automatiquement." }],
  ["Avvia la prova e poi rinnovo mensile", { it: "Avvia la prova e poi rinnovo mensile", en: "Start trial, then monthly renewal", es: "Iniciar prueba y luego renovacion mensual", fr: "Demarrer l'essai puis renouvellement mensuel" }],
  ["Dopo i 30 giorni di prova partira l'abbonamento mensile da 29,99 EUR.", { it: "Dopo i 30 giorni di prova partira l'abbonamento mensile da 29,99 EUR.", en: "After the 30-day trial, the monthly subscription of 29.99 EUR will start.", es: "Despues de los 30 dias de prueba comenzara la suscripcion mensual de 29,99 EUR.", fr: "Apres les 30 jours d'essai, l'abonnement mensuel de 29,99 EUR commencera." }],
  ["Avvia la prova e poi rinnovo annuale", { it: "Avvia la prova e poi rinnovo annuale", en: "Start trial, then yearly renewal", es: "Iniciar prueba y luego renovacion anual", fr: "Demarrer l'essai puis renouvellement annuel" }],
  ["Dopo i 30 giorni di prova partira l'abbonamento annuale da 299 EUR.", { it: "Dopo i 30 giorni di prova partira l'abbonamento annuale da 299 EUR.", en: "After the 30-day trial, the yearly subscription of 299 EUR will start.", es: "Despues de los 30 dias de prueba comenzara la suscripcion anual de 299 EUR.", fr: "Apres les 30 jours d'essai, l'abonnement annuel de 299 EUR commencera." }],
  ["Carta salvata correttamente. Il locale e in prova per 30 giorni e il piano scelto si rinnovera automaticamente alla fine del periodo indicato.", { it: "Carta salvata correttamente. Il locale e in prova per 30 giorni e il piano scelto si rinnovera automaticamente alla fine del periodo indicato.", en: "Card saved successfully. The venue is in a 30-day trial and the chosen plan will renew automatically at the end of the displayed period.", es: "Tarjeta guardada correctamente. El local esta en prueba durante 30 dias y el plan elegido se renovara automaticamente al final del periodo indicado.", fr: "Carte enregistree correctement. L'etablissement est en essai pendant 30 jours et l'offre choisie se renouvellera automatiquement a la fin de la periode indiquee." }],
  ["Abbonamento attivo. Il locale e sbloccato e operativo.", { it: "Abbonamento attivo. Il locale e sbloccato e operativo.", en: "Subscription active. The venue is unlocked and operational.", es: "Suscripcion activa. El local esta desbloqueado y operativo.", fr: "Abonnement actif. L'etablissement est debloque et operationnel." }],
  ["Abbonamento disattivato. Il locale resta bloccato finche non attivi un nuovo piano.", { it: "Abbonamento disattivato. Il locale resta bloccato finche non attivi un nuovo piano.", en: "Subscription disabled. The venue stays locked until you activate a new plan.", es: "Suscripcion desactivada. El local permanecera bloqueado hasta que actives un nuevo plan.", fr: "Abonnement desactive. L'etablissement reste bloque tant que vous n'activez pas une nouvelle offre." }],
  ["Il pagamento non risulta valido. Rinnova l'abbonamento per sbloccare il locale.", { it: "Il pagamento non risulta valido. Rinnova l'abbonamento per sbloccare il locale.", en: "The payment is not valid. Renew the subscription to unlock the venue.", es: "El pago no es valido. Renueva la suscripcion para desbloquear el local.", fr: "Le paiement n'est pas valide. Renouvelez l'abonnement pour debloquer l'etablissement." }],
  ["L'abbonamento non e attivo. Per usare turni, timbrature, mansioni, richieste e report serve un piano attivo.", { it: "L'abbonamento non e attivo. Per usare turni, timbrature, mansioni, richieste e report serve un piano attivo.", en: "The subscription is not active. You need an active plan to use shifts, time logs, tasks, requests and reports.", es: "La suscripcion no esta activa. Necesitas un plan activo para usar turnos, fichajes, tareas, solicitudes e informes.", fr: "L'abonnement n'est pas actif. Vous avez besoin d'une offre active pour utiliser plannings, pointages, taches, demandes et rapports." }],
  ["Apertura checkout...", { it: "Apertura checkout...", en: "Opening checkout...", es: "Abriendo checkout...", fr: "Ouverture du checkout..." }],
  ["Attiva abbonamento mensile", { it: "Attiva abbonamento mensile", en: "Activate monthly subscription", es: "Activar suscripcion mensual", fr: "Activer l'abonnement mensuel" }],
  ["Attiva abbonamento annuale", { it: "Attiva abbonamento annuale", en: "Activate yearly subscription", es: "Activar suscripcion anual", fr: "Activer l'abonnement annuel" }],
  ["Vuoi davvero disattivare l'abbonamento? Il locale verra bloccato subito.", { it: "Vuoi davvero disattivare l'abbonamento? Il locale verra bloccato subito.", en: "Do you really want to disable the subscription? The venue will be locked immediately.", es: "Quieres desactivar realmente la suscripcion? El local se bloqueara de inmediato.", fr: "Voulez-vous vraiment desactiver l'abonnement ? L'etablissement sera bloque immediatement." }],
  ["Impossibile avviare il checkout Stripe.", { it: "Impossibile avviare il checkout Stripe.", en: "Unable to start Stripe Checkout.", es: "No es posible iniciar Stripe Checkout.", fr: "Impossible de lancer Stripe Checkout." }],
  ["Impossibile disattivare l'abbonamento.", { it: "Impossibile disattivare l'abbonamento.", en: "Unable to disable the subscription.", es: "No es posible desactivar la suscripcion.", fr: "Impossible de desactiver l'abonnement." }],
  ["Abbonamento disattivato.", { it: "Abbonamento disattivato.", en: "Subscription disabled.", es: "Suscripcion desactivada.", fr: "Abonnement desactive." }],
  ["Disattivazione...", { it: "Disattivazione...", en: "Disabling...", es: "Desactivando...", fr: "Desactivation..." }],
  ["Disattiva abbonamento", { it: "Disattiva abbonamento", en: "Disable subscription", es: "Desactivar suscripcion", fr: "Desactiver l'abonnement" }],
  ["Questa area e riservata al super admin.", { it: "Questa area e riservata al super admin.", en: "This area is reserved for the super admin.", es: "Esta area esta reservada para el super admin.", fr: "Cette zone est reservee au super admin." }],
  ["Crea prima almeno un titolare da associare al nuovo bar.", { it: "Crea prima almeno un titolare da associare al nuovo bar.", en: "Create at least one owner first to assign to the new venue.", es: "Crea primero al menos un propietario para asignarlo al nuevo local.", fr: "Creez d'abord au moins un proprietaire a associer au nouvel etablissement." }],
  ["Titolare", { it: "Titolare", en: "Owner", es: "Propietario", fr: "Proprietaire" }],
  ["Seleziona titolare", { it: "Seleziona titolare", en: "Select owner", es: "Selecciona propietario", fr: "Selectionnez le proprietaire" }],
  ["Nessun bar creato al momento.", { it: "Nessun bar creato al momento.", en: "No venue created yet.", es: "Todavia no se ha creado ningun local.", fr: "Aucun etablissement cree pour le moment." }],
  ["Tutti", { it: "Tutti", en: "All", es: "Todos", fr: "Tous" }],
  ["Active", { it: "Attivo", en: "Active", es: "Activo", fr: "Actif" }],
  ["Past due", { it: "Scaduto", en: "Past due", es: "Vencido", fr: "En retard" }],
  ["Inactive", { it: "Inattivo", en: "Inactive", es: "Inactivo", fr: "Inactif" }],
  ["Free / Lifetime", { it: "Free / Lifetime", en: "Free / Lifetime", es: "Gratis / Vitalicio", fr: "Gratuit / A vie" }],
  ["Bar", { it: "Locale", en: "Venue", es: "Local", fr: "Etablissement" }],
  ["Stato", { it: "Stato", en: "Status", es: "Estado", fr: "Statut" }],
  ["Stripe subscription id", { it: "Stripe subscription id", en: "Stripe subscription id", es: "Stripe subscription id", fr: "Stripe subscription id" }],
  ["Azioni", { it: "Azioni", en: "Actions", es: "Acciones", fr: "Actions" }],
  ["In scadenza", { it: "In scadenza", en: "Expiring soon", es: "A punto de vencer", fr: "Bientot a expiration" }],
  ["Vuoi eliminare definitivamente", { it: "Vuoi eliminare definitivamente", en: "Do you want to permanently delete", es: "Quieres eliminar definitivamente", fr: "Voulez-vous supprimer definitivement" }],
  ["Chiudi popup billing", { it: "Chiudi popup billing", en: "Close billing popup", es: "Cerrar ventana de suscripcion", fr: "Fermer la fenetre d'abonnement" }],
  ["Imposta FREE", { it: "Imposta FREE", en: "Set FREE", es: "Definir FREE", fr: "Definir FREE" }],
  ["Imposta LIFETIME", { it: "Imposta LIFETIME", en: "Set LIFETIME", es: "Definir LIFETIME", fr: "Definir LIFETIME" }],
  ["Riporta a PAID", { it: "Riporta a PAID", en: "Set back to PAID", es: "Volver a PAID", fr: "Remettre en PAID" }],
  ["Plan type", { it: "Tipo piano", en: "Plan type", es: "Tipo de plan", fr: "Type d'offre" }],
  ["Status", { it: "Stato", en: "Status", es: "Estado", fr: "Statut" }],
  ["Billing interval", { it: "Intervallo di fatturazione", en: "Billing interval", es: "Intervalo de facturacion", fr: "Intervalle de facturation" }],
  ["Scadenza periodo", { it: "Scadenza periodo", en: "Period end", es: "Fin del periodo", fr: "Fin de periode" }],
  ["Dettagli Stripe", { it: "Dettagli Stripe", en: "Stripe details", es: "Detalles de Stripe", fr: "Details Stripe" }],
  ["Sbloccato", { it: "Sbloccato", en: "Unlocked", es: "Desbloqueado", fr: "Debloque" }],
  ["Bloccato", { it: "Bloccato", en: "Locked", es: "Bloqueado", fr: "Bloque" }],
  ["Eliminazione...", { it: "Eliminazione...", en: "Deleting...", es: "Eliminando...", fr: "Suppression..." }],
  ["Elimina cliente", { it: "Elimina cliente", en: "Delete customer", es: "Eliminar cliente", fr: "Supprimer le client" }],
  ["Salva modifiche", { it: "Salva modifiche", en: "Save changes", es: "Guardar cambios", fr: "Enregistrer les modifications" }],
];

const runtimePatterns: RuntimePattern[] = [
  {
    pattern: /^Locale:\s*(.+)$/u,
    values: {
      it: "Locale: $1",
      en: "Venue: $1",
      es: "Local: $1",
      fr: "Etablissement : $1",
    },
  },
  {
    pattern: /^Piano:\s*(.+)$/u,
    values: {
      it: "Piano: $1",
      en: "Plan: $1",
      es: "Plan: $1",
      fr: "Offre : $1",
    },
  },
  {
    pattern: /^Intervallo:\s*(.+)$/u,
    values: {
      it: "Intervallo: $1",
      en: "Interval: $1",
      es: "Intervalo: $1",
      fr: "Intervalle : $1",
    },
  },
  {
    pattern: /^Rinnovo \/ scadenza:\s*(.+)$/u,
    values: {
      it: "Rinnovo / scadenza: $1",
      en: "Renewal / expiry: $1",
      es: "Renovacion / vencimiento: $1",
      fr: "Renouvellement / expiration : $1",
    },
  },
  {
    pattern: /^Fine trial:\s*(.+)$/u,
    values: {
      it: "Fine trial: $1",
      en: "Trial end: $1",
      es: "Fin de prueba: $1",
      fr: "Fin de l'essai : $1",
    },
  },
  {
    pattern: /^Scadenza\s+(.+)$/u,
    values: {
      it: "Scadenza $1",
      en: "Due $1",
      es: "Vence $1",
      fr: "Echeance $1",
    },
  },
  {
    pattern: /^Creata da\s+(.+)$/u,
    values: {
      it: "Creata da $1",
      en: "Created by $1",
      es: "Creada por $1",
      fr: "Creee par $1",
    },
  },
  {
    pattern: /^Assegnata a\s+(.+)$/u,
    values: {
      it: "Assegnata a $1",
      en: "Assigned to $1",
      es: "Asignada a $1",
      fr: "Assignee a $1",
    },
  },
  {
    pattern: /^Completata da\s+(.+)$/u,
    values: {
      it: "Completata da $1",
      en: "Completed by $1",
      es: "Completada por $1",
      fr: "Terminee par $1",
    },
  },
  {
    pattern: /^Collega coinvolto:\s*(.+)$/u,
    values: {
      it: "Collega coinvolto: $1",
      en: "Coworker involved: $1",
      es: "Companero implicado: $1",
      fr: "Collegue implique : $1",
    },
  },
  {
    pattern: /^Indisponibilita:\s*(.+)$/u,
    values: {
      it: "Indisponibilita: $1",
      en: "Unavailability: $1",
      es: "Indisponibilidad: $1",
      fr: "Indisponibilite : $1",
    },
  },
  {
    pattern: /^Ferie:\s*(.+)$/u,
    values: {
      it: "Ferie: $1",
      en: "Vacation: $1",
      es: "Vacaciones: $1",
      fr: "Conges : $1",
    },
  },
  {
    pattern: /^Permesso:\s*(.+)$/u,
    values: {
      it: "Permesso: $1",
      en: "Leave: $1",
      es: "Permiso: $1",
      fr: "Permission : $1",
    },
  },
  {
    pattern: /^Customer id:\s*(.+)$/u,
    values: {
      it: "Customer id: $1",
      en: "Customer id: $1",
      es: "Customer id: $1",
      fr: "Customer id : $1",
    },
  },
  {
    pattern: /^Subscription id:\s*(.+)$/u,
    values: {
      it: "Subscription id: $1",
      en: "Subscription id: $1",
      es: "Subscription id: $1",
      fr: "Subscription id : $1",
    },
  },
  {
    pattern: /^Price id:\s*(.+)$/u,
    values: {
      it: "Price id: $1",
      en: "Price id: $1",
      es: "Price id: $1",
      fr: "Price id : $1",
    },
  },
  {
    pattern: /^Accesso attuale:\s*(.+)$/u,
    values: {
      it: "Accesso attuale: $1",
      en: "Current access: $1",
      es: "Acceso actual: $1",
      fr: "Acces actuel : $1",
    },
  },
  {
    pattern: /^(\d+)\s+messaggi$/u,
    values: {
      it: "$1 messaggi",
      en: "$1 messages",
      es: "$1 mensajes",
      fr: "$1 messages",
    },
  },
  {
    pattern: /^(\d+)\s+elementi$/u,
    values: {
      it: "$1 elementi",
      en: "$1 items",
      es: "$1 elementos",
      fr: "$1 elements",
    },
  },
  {
    pattern: /^(\d+)\s+risultati$/u,
    values: {
      it: "$1 risultati",
      en: "$1 results",
      es: "$1 resultados",
      fr: "$1 resultats",
    },
  },
  {
    pattern: /^(\d+)\s+persone$/u,
    values: {
      it: "$1 persone",
      en: "$1 people",
      es: "$1 personas",
      fr: "$1 personnes",
    },
  },
  {
    pattern: /^(\d+)\s+registrazioni$/u,
    values: {
      it: "$1 registrazioni",
      en: "$1 records",
      es: "$1 registros",
      fr: "$1 enregistrements",
    },
  },
  {
    pattern: /^(\d+)\s+turni$/u,
    values: {
      it: "$1 turni",
      en: "$1 shifts",
      es: "$1 turnos",
      fr: "$1 plannings",
    },
  },
  {
    pattern: /^(\d+)\s+persone$/u,
    values: {
      it: "$1 persone",
      en: "$1 people",
      es: "$1 personas",
      fr: "$1 personnes",
    },
  },
  {
    pattern: /^(\d+)\s+timbrature visibili$/u,
    values: {
      it: "$1 timbrature visibili",
      en: "$1 visible time logs",
      es: "$1 fichajes visibles",
      fr: "$1 pointages visibles",
    },
  },
  {
    pattern: /^(\d+)\s+da inviare$/u,
    values: {
      it: "$1 da inviare",
      en: "$1 to send",
      es: "$1 por enviar",
      fr: "$1 a envoyer",
    },
  },
  {
    pattern: /^(\d+)\s+email inviate\.$/u,
    values: {
      it: "$1 email inviate.",
      en: "$1 emails sent.",
      es: "$1 emails enviados.",
      fr: "$1 emails envoyes.",
    },
  },
  {
    pattern: /^(\d+(?:[.,]\d+)?)\s+ore lavorate$/u,
    values: {
      it: "$1 ore lavorate",
      en: "$1 worked hours",
      es: "$1 horas trabajadas",
      fr: "$1 heures travaillees",
    },
  },
  {
    pattern: /^Ore reali\s+(\d+(?:[.,]\d+)?)\s+[Â·-]\s+aggiornate in tempo reale$/u,
    values: {
      it: "Ore reali $1 - aggiornate in tempo reale",
      en: "Actual hours $1 - updated in real time",
      es: "Horas reales $1 - actualizadas en tiempo real",
      fr: "Heures reelles $1 - mises a jour en temps reel",
    },
  },
  {
    pattern: /^Ultimo completamento:\s+(.+)$/u,
    values: {
      it: "Ultimo completamento: $1",
      en: "Latest completion: $1",
      es: "Ultima finalizacion: $1",
      fr: "Derniere completion : $1",
    },
  },
  {
    pattern: /^(\d+)\s+richieste da gestire$/u,
    values: {
      it: "$1 richieste da gestire",
      en: "$1 requests to review",
      es: "$1 solicitudes por revisar",
      fr: "$1 demandes a traiter",
    },
  },
  {
    pattern: /^Posizione aggiornata automaticamente\. Sei nel raggio corretto \((\d+)\s*m\)\.$/u,
    values: {
      it: "Posizione aggiornata automaticamente. Sei nel raggio corretto ($1 m).",
      en: "Location updated automatically. You are within the allowed radius ($1 m).",
      es: "Posicion actualizada automaticamente. Estas dentro del radio permitido ($1 m).",
      fr: "Position mise a jour automatiquement. Vous etes dans le rayon autorise ($1 m).",
    },
  },
  {
    pattern: /^Posizione aggiornata automaticamente\. Sei fuori raggio di (\d+)\s*m\.$/u,
    values: {
      it: "Posizione aggiornata automaticamente. Sei fuori raggio di $1 m.",
      en: "Location updated automatically. You are outside the radius by $1 m.",
      es: "Posicion actualizada automaticamente. Estas fuera del radio por $1 m.",
      fr: "Position mise a jour automatiquement. Vous etes hors du rayon de $1 m.",
    },
  },
  {
    pattern: /^Sei nel raggio corretto \((\d+)\s*m\)\.$/u,
    values: {
      it: "Sei nel raggio corretto ($1 m).",
      en: "You are within the allowed radius ($1 m).",
      es: "Estas dentro del radio permitido ($1 m).",
      fr: "Vous etes dans le rayon autorise ($1 m).",
    },
  },
  {
    pattern: /^Sei fuori raggio di (\d+)\s*m\.$/u,
    values: {
      it: "Sei fuori raggio di $1 m.",
      en: "You are outside the radius by $1 m.",
      es: "Estas fuera del radio por $1 m.",
      fr: "Vous etes hors du rayon de $1 m.",
    },
  },
  {
    pattern: /^Raggio (\d+)\s*m$/u,
    values: {
      it: "Raggio $1 m",
      en: "Radius $1 m",
      es: "Radio $1 m",
      fr: "Rayon $1 m",
    },
  },
  {
    pattern: /^Distanza attuale:\s*(\d+)\s*m$/u,
    values: {
      it: "Distanza attuale: $1 m",
      en: "Current distance: $1 m",
      es: "Distancia actual: $1 m",
      fr: "Distance actuelle : $1 m",
    },
  },
  {
    pattern: /^Arrotondamento attivo:\s*(.+)\s+ogni\s+(\d+)\s+minuti\.$/u,
    values: {
      it: "Arrotondamento attivo: $1 ogni $2 minuti.",
      en: "Rounding enabled: $1 every $2 minutes.",
      es: "Redondeo activo: $1 cada $2 minutos.",
      fr: "Arrondi actif : $1 toutes les $2 minutes.",
    },
  },
  {
    pattern: /^Uscita registrata\. Durata\s+(\d+(?:[.,]\d+)?)\s+ore\.$/u,
    values: {
      it: "Uscita registrata. Durata $1 ore.",
      en: "Clock out recorded. Duration $1 hours.",
      es: "Salida registrada. Duracion $1 horas.",
      fr: "Sortie enregistree. Duree $1 heures.",
    },
  },
  {
    pattern: /^(\d+)\s+timbrature\s+[Â·-]\s+ultima\s+(.+)$/u,
    values: {
      it: "$1 timbrature - ultima $2",
      en: "$1 time logs - latest $2",
      es: "$1 fichajes - ultimo $2",
      fr: "$1 pointages - dernier $2",
    },
  },
  {
    pattern: /^(\d+)\s+bar$/u,
    values: {
      it: "$1 bar",
      en: "$1 venues",
      es: "$1 locales",
      fr: "$1 etablissements",
    },
  },
  {
    pattern: /^Step\s+(\d+)$/u,
    values: {
      it: "Step $1",
      en: "Step $1",
      es: "Paso $1",
      fr: "Etape $1",
    },
  },
];

const monthWordReplacements: Record<SupportedLanguage, Array<[RegExp, string]>> = {
  it: [
    [/\bJanuary\b/giu, "gennaio"],
    [/\bFebruary\b/giu, "febbraio"],
    [/\bMarch\b/giu, "marzo"],
    [/\bApril\b/giu, "aprile"],
    [/\bMay\b/giu, "maggio"],
    [/\bJune\b/giu, "giugno"],
    [/\bJuly\b/giu, "luglio"],
    [/\bAugust\b/giu, "agosto"],
    [/\bSeptember\b/giu, "settembre"],
    [/\bOctober\b/giu, "ottobre"],
    [/\bNovember\b/giu, "novembre"],
    [/\bDecember\b/giu, "dicembre"],
  ],
  en: [
    [/\bgennaio\b/giu, "January"],
    [/\bfebbraio\b/giu, "February"],
    [/\bmarzo\b/giu, "March"],
    [/\baprile\b/giu, "April"],
    [/\bmaggio\b/giu, "May"],
    [/\bgiugno\b/giu, "June"],
    [/\bluglio\b/giu, "July"],
    [/\bagosto\b/giu, "August"],
    [/\bsettembre\b/giu, "September"],
    [/\bottobre\b/giu, "October"],
    [/\bnovembre\b/giu, "November"],
    [/\bdicembre\b/giu, "December"],
    [/\bgen\b/giu, "Jan"],
    [/\bfeb\b/giu, "Feb"],
    [/\bmar\b/giu, "Mar"],
    [/\bapr\b/giu, "Apr"],
    [/\bmag\b/giu, "May"],
    [/\bgiu\b/giu, "Jun"],
    [/\blug\b/giu, "Jul"],
    [/\bago\b/giu, "Aug"],
    [/\bset\b/giu, "Sep"],
    [/\bott\b/giu, "Oct"],
    [/\bnov\b/giu, "Nov"],
    [/\bdic\b/giu, "Dec"],
  ],
  es: [
    [/\bgennaio\b/giu, "enero"],
    [/\bfebbraio\b/giu, "febrero"],
    [/\bmarzo\b/giu, "marzo"],
    [/\baprile\b/giu, "abril"],
    [/\bmaggio\b/giu, "mayo"],
    [/\bgiugno\b/giu, "junio"],
    [/\bluglio\b/giu, "julio"],
    [/\bagosto\b/giu, "agosto"],
    [/\bsettembre\b/giu, "septiembre"],
    [/\bottobre\b/giu, "octubre"],
    [/\bnovembre\b/giu, "noviembre"],
    [/\bdicembre\b/giu, "diciembre"],
    [/\bgen\b/giu, "ene"],
    [/\bfeb\b/giu, "feb"],
    [/\bmar\b/giu, "mar"],
    [/\bapr\b/giu, "abr"],
    [/\bmag\b/giu, "may"],
    [/\bgiu\b/giu, "jun"],
    [/\blug\b/giu, "jul"],
    [/\bago\b/giu, "ago"],
    [/\bset\b/giu, "sep"],
    [/\bott\b/giu, "oct"],
    [/\bnov\b/giu, "nov"],
    [/\bdic\b/giu, "dic"],
  ],
  fr: [
    [/\bgennaio\b/giu, "janvier"],
    [/\bfebbraio\b/giu, "fevrier"],
    [/\bmarzo\b/giu, "mars"],
    [/\baprile\b/giu, "avril"],
    [/\bmaggio\b/giu, "mai"],
    [/\bgiugno\b/giu, "juin"],
    [/\bluglio\b/giu, "juillet"],
    [/\bagosto\b/giu, "aout"],
    [/\bsettembre\b/giu, "septembre"],
    [/\bottobre\b/giu, "octobre"],
    [/\bnovembre\b/giu, "novembre"],
    [/\bdicembre\b/giu, "decembre"],
    [/\bgen\b/giu, "janv"],
    [/\bfeb\b/giu, "fevr"],
    [/\bmar\b/giu, "mars"],
    [/\bapr\b/giu, "avr"],
    [/\bmag\b/giu, "mai"],
    [/\bgiu\b/giu, "juin"],
    [/\blug\b/giu, "juil"],
    [/\bago\b/giu, "aout"],
    [/\bset\b/giu, "sept"],
    [/\bott\b/giu, "oct"],
    [/\bnov\b/giu, "nov"],
    [/\bdic\b/giu, "dec"],
  ],
};

const dayWordReplacements: Record<SupportedLanguage, Array<[RegExp, string]>> = {
  it: [
    [/\bMonday\b/giu, "lunedi"],
    [/\bTuesday\b/giu, "martedi"],
    [/\bWednesday\b/giu, "mercoledi"],
    [/\bThursday\b/giu, "giovedi"],
    [/\bFriday\b/giu, "venerdi"],
    [/\bSaturday\b/giu, "sabato"],
    [/\bSunday\b/giu, "domenica"],
  ],
  en: [
    [/\blunedi\b/giu, "Monday"],
    [/\bmartedi\b/giu, "Tuesday"],
    [/\bmercoledi\b/giu, "Wednesday"],
    [/\bgiovedi\b/giu, "Thursday"],
    [/\bvenerdi\b/giu, "Friday"],
    [/\bsabato\b/giu, "Saturday"],
    [/\bdomenica\b/giu, "Sunday"],
  ],
  es: [
    [/\blunedi\b/giu, "lunes"],
    [/\bmartedi\b/giu, "martes"],
    [/\bmercoledi\b/giu, "miercoles"],
    [/\bgiovedi\b/giu, "jueves"],
    [/\bvenerdi\b/giu, "viernes"],
    [/\bsabato\b/giu, "sabado"],
    [/\bdomenica\b/giu, "domingo"],
  ],
  fr: [
    [/\blunedi\b/giu, "lundi"],
    [/\bmartedi\b/giu, "mardi"],
    [/\bmercoledi\b/giu, "mercredi"],
    [/\bgiovedi\b/giu, "jeudi"],
    [/\bvenerdi\b/giu, "vendredi"],
    [/\bsabato\b/giu, "samedi"],
    [/\bdomenica\b/giu, "dimanche"],
  ],
};

function applyPatternReplacements(language: SupportedLanguage, value: string) {
  for (const rule of runtimePatterns) {
    if (rule.pattern.test(value)) {
      return value.replace(rule.pattern, rule.values[language]);
    }
  }

  return value;
}

function applyWordReplacements(language: SupportedLanguage, value: string) {
  let result = value;

  for (const [pattern, replacement] of monthWordReplacements[language]) {
    result = result.replace(pattern, replacement);
  }

  for (const [pattern, replacement] of dayWordReplacements[language]) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

function matchesRuntimeEntry(
  entry: RuntimeEntry,
  value: string
) {
  const [source, translations] = entry;

  if (source === value) {
    return true;
  }

  return Object.values(translations).some((translation) => translation === value);
}

export function translateRuntimeValue(language: string, value: string): string {
  const normalizedLanguage = normalizeLanguage(language);
  const trimmed = value.trim();

  if (!trimmed) {
    return value;
  }

  const directEntry = runtimeEntries.find((entry) => matchesRuntimeEntry(entry, trimmed));
  const translatedDirect = directEntry ? directEntry[1][normalizedLanguage] : trimmed;
  const translatedPattern = applyPatternReplacements(normalizedLanguage, translatedDirect);
  const translatedWords = applyWordReplacements(normalizedLanguage, translatedPattern);

  if (translatedWords === trimmed) {
    return value;
  }

  return value.replace(trimmed, translatedWords);
}
