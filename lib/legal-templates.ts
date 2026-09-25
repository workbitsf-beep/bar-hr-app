import "server-only";

import { LegalDocumentType } from "@prisma/client";
import {
  COMPANY_PROFILE_LABELS,
  type CompanyProfile,
} from "@/lib/company-profile";

/**
 * The legal documents, written once and filled in from the company details.
 *
 * They are drafts, not advice: the parts a lawyer has to decide — the position
 * of geolocation under art. 4 of the Statuto dei Lavoratori, the medical
 * certificate code, the retention periods — are exactly the ones exposed as
 * fields, so the answer lands in the text instead of in a note nobody reads.
 *
 * A value left empty comes out as [Ragione sociale] rather than as a blank, so
 * an unfinished document announces itself.
 */
export type LegalTemplate = {
  type: LegalDocumentType;
  title: string;
  /** Marked required when the stores or the law block publication without it. */
  essential: boolean;
  /** Kept for inspection rather than published: no public page shows it. */
  internal?: boolean;
  summary: string;
  build: (profile: CompanyProfile) => string;
};

function value(profile: CompanyProfile, key: keyof CompanyProfile) {
  const raw = profile[key];

  if (typeof raw === "boolean") {
    return raw ? "sì" : "no";
  }

  const trimmed = String(raw ?? "").trim();

  return trimmed || `[${COMPANY_PROFILE_LABELS[key]}]`;
}

/** A blank the venue fills in, not the company. */
function venueBlank(label: string) {
  return `[${label}]`;
}

function company(profile: CompanyProfile) {
  const parts = [
    value(profile, "legalName"),
    `con sede legale in ${value(profile, "registeredOffice")}`,
    `partita IVA ${value(profile, "vatNumber")}`,
  ];

  if (profile.taxCode.trim()) {
    parts.push(`codice fiscale ${profile.taxCode.trim()}`);
  }

  if (profile.reaAndCapital.trim()) {
    parts.push(profile.reaAndCapital.trim());
  }

  return parts.join(", ");
}

function heading(profile: CompanyProfile, title: string, extra?: string) {
  return [
    title,
    `Versione ${value(profile, "documentVersion")} · in vigore dal ${value(profile, "effectiveFrom")}`,
    extra,
    "",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

function buildPrivacy(profile: CompanyProfile) {
  const service = value(profile, "serviceName");
  const cert = profile.collectsCertificateCode;

  return [
    heading(profile, "INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI"),

    "1. CHI È IL TITOLARE",
    `Il titolare dei trattamenti descritti al punto 3 è ${company(profile)} (di seguito «${service}» o «noi»).`,
    `Per qualsiasi domanda sui tuoi dati puoi scrivere a ${value(profile, "privacyEmail")} oppure alla PEC ${value(profile, "certifiedEmail")}.`,
    profile.dpoContact.trim()
      ? `Il responsabile della protezione dei dati è raggiungibile a ${profile.dpoContact.trim()}.`
      : "",
    "",

    "2. A CHI SI RIVOLGE QUESTA INFORMATIVA",
    `${service} è un servizio in abbonamento per la gestione del personale di bar e ristoranti: turni, timbrature, richieste di ferie e permessi, note interne, documenti e formazione. Si usa dal sito ${value(profile, "website")} e dall'app per smartphone.`,
    "Questa informativa riguarda i clienti, cioè le attività che sottoscrivono l'abbonamento e le persone che le rappresentano; i dipendenti e collaboratori dei clienti che usano il servizio; chi visita il sito o scrive all'assistenza.",
    "Il nostro ruolo cambia a seconda dei dati. Per i dati dei clienti siamo titolari. Per i dati che i locali gestiscono sul proprio personale agiamo come responsabili del trattamento per conto del locale, che ne è il titolare (punto 4).",
    "",

    "3. DATI DEI CLIENTI: COSA TRATTIAMO E PERCHÉ",
    "• Creare e gestire l'account e fornire il servizio — nome, cognome, email, ruolo, credenziali, lingua. Base giuridica: esecuzione del contratto (art. 6.1.b GDPR).",
    "• Incassare l'abbonamento — i dati della carta sono raccolti direttamente da Stripe; noi riceviamo un identificativo cliente e l'esito dei pagamenti. Base giuridica: esecuzione del contratto.",
    "• Emettere le fatture — ragione sociale, partita IVA, codice fiscale, codice destinatario, PEC, indirizzo. Base giuridica: obbligo di legge (art. 6.1.c).",
    "• Rispondere alle richieste di assistenza — dati di contatto e contenuto della richiesta. Base giuridica: esecuzione del contratto.",
    "• Inviare comunicazioni di servizio — email e identificativo del dispositivo per le notifiche. Base giuridica: esecuzione del contratto.",
    "• Proteggere il servizio da accessi non autorizzati — sessioni attive, log di accesso, indirizzo IP, tipo di dispositivo. Base giuridica: legittimo interesse alla sicurezza (art. 6.1.f).",
    "Fornire questi dati è necessario per sottoscrivere e usare il servizio. Non facciamo profilazione, non vendiamo i dati e non li cediamo a terzi per finalità di marketing.",
    "",

    "4. DATI DEL PERSONALE DEI LOCALI",
    `I dati che il locale gestisce sui propri dipendenti tramite ${service} sono trattati per conto del locale, che in quanto datore di lavoro è titolare del trattamento. ${service} li tratta come responsabile ai sensi dell'art. 28 GDPR, secondo le istruzioni del locale e in base a un accordo sottoscritto con esso. Si tratta di:`,
    "• dati dell'account: nome, cognome, email, ruolo, credenziali, lingua, identificativo del dispositivo;",
    "• turni, assegnazioni, conferme e disponibilità;",
    "• timbrature di entrata e uscita, con data, ora e posizione al momento della timbratura (punto 5);",
    `• richieste di ferie, permessi, cambio turno, straordinari e malattia, con le relative motivazioni${cert ? " e, per la malattia, il numero di protocollo del certificato medico" : ""};`,
    "• note scritte dai responsabili del locale su singoli dipendenti;",
    "• documenti caricati dal locale, per esempio contratti, buste paga o attestati;",
    "• corsi di formazione assegnati e stato di completamento.",
    cert
      ? `Il numero di protocollo del certificato medico è un dato relativo alla salute. È accessibile solo al dipendente e alle persone che il locale abilita a gestire le richieste, e si conserva ${value(profile, "retentionCertificate")}.`
      : "",
    "Se sei un dipendente, l'informativa completa te la fornisce il tuo datore di lavoro, al quale puoi rivolgerti per esercitare i tuoi diritti. Se scrivi a noi, inoltriamo la richiesta al locale e lo aiutiamo a darti una risposta.",
    "",

    "5. POSIZIONE AL MOMENTO DELLA TIMBRATURA",
    "L'app rileva la posizione del dispositivo solo nel momento in cui il dipendente timbra l'entrata o l'uscita, per verificare che si trovi entro il raggio dalla sede impostato dal locale. La posizione non viene rilevata in altri momenti, né in background, né in modo continuativo, e non viene ricostruito alcun percorso.",
    `Le coordinate vengono salvate insieme alla timbratura e si conservano ${value(profile, "retentionPosition")}. Il permesso di localizzazione si può revocare dalle impostazioni del telefono: in quel caso la timbratura dall'app potrebbe non essere possibile e il locale indica una modalità alternativa.`,
    "",

    "6. A CHI COMUNICHIAMO I DATI",
    "I dati sono accessibili al nostro personale autorizzato, vincolato alla riservatezza, e ai fornitori che ci aiutano a erogare il servizio, nominati responsabili del trattamento:",
    `• Railway — server e database. Area di conservazione: ${value(profile, "hostingRegion")}. Tutti i dati del servizio.`,
    "• Stripe — incasso degli abbonamenti. Dati del cliente e di pagamento.",
    "• Google Firebase — notifiche push. Identificativo del dispositivo e testo della notifica.",
    "• Resend — invio di email. Indirizzo, nome e contenuto del messaggio.",
    profile.invoicingActive
      ? "• Fatture in Cloud (TeamSystem) — fatturazione elettronica. Dati fiscali del cliente."
      : "",
    "Per alcune finalità, come la prevenzione delle frodi nei pagamenti, Stripe agisce come titolare autonomo secondo la propria informativa. I dati possono inoltre essere comunicati a consulenti fiscali e legali, vincolati al segreto professionale, e alle autorità quando la legge lo richiede.",
    "",

    "7. TRASFERIMENTI FUORI DALL'UNIONE EUROPEA",
    `Alcuni fornitori hanno sede negli Stati Uniti o possono accedere ai dati da lì. In questi casi il trasferimento avviene sulla base della decisione di adeguatezza EU-US Data Privacy Framework, per i fornitori che vi aderiscono, oppure delle clausole contrattuali standard approvate dalla Commissione Europea (art. 46 GDPR). Puoi chiederne copia scrivendo a ${value(profile, "privacyEmail")}.`,
    "",

    "8. PER QUANTO TEMPO CONSERVIAMO I DATI",
    `• Dati dell'account: per tutta la durata del contratto. Alla cessazione il locale può chiedere l'esportazione entro ${value(profile, "exportDays")} giorni, dopodiché vengono cancellati.`,
    `• Dati fiscali e di fatturazione: ${value(profile, "retentionTaxData")}.`,
    `• Orari delle timbrature: ${value(profile, "retentionTimelogs")}.`,
    `• Coordinate delle timbrature: ${value(profile, "retentionPosition")}.`,
    `• Richieste di ferie, permessi e simili: ${value(profile, "retentionRequests")}.`,
    cert ? `• Numero di protocollo del certificato medico: ${value(profile, "retentionCertificate")}.` : "",
    `• Note sul personale: ${value(profile, "retentionNotes")}.`,
    `• Documenti caricati: ${value(profile, "retentionDocuments")}.`,
    `• Log di accesso: ${value(profile, "retentionAccessLogs")}.`,
    "Per i dati del personale il locale, in quanto titolare, può chiedere la cancellazione anticipata. La cancellazione di un account o di un locale elimina anche tutti i dati collegati, salvo quelli che dobbiamo conservare per legge.",
    "",

    "9. COME PROTEGGIAMO I DATI",
    "Le comunicazioni con il servizio sono cifrate. Le password sono salvate solo in forma non reversibile ed è possibile accedere con passkey. Ogni utente vede solo i dati del proprio locale e secondo il proprio ruolo; le sessioni attive si possono chiudere in qualsiasi momento. L'accesso ai sistemi è limitato al personale autorizzato.",
    "",

    "10. I TUOI DIRITTI",
    `Puoi chiedere l'accesso ai tuoi dati, la rettifica, la cancellazione, la limitazione del trattamento e la portabilità, e puoi opporti ai trattamenti basati sul legittimo interesse (artt. 15–22 GDPR). Scrivi a ${value(profile, "privacyEmail")} o alla PEC ${value(profile, "certifiedEmail")}: rispondiamo entro un mese.`,
    "Hai anche il diritto di proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).",
    "",

    "11. CANCELLAZIONE DELL'ACCOUNT",
    `Puoi chiedere la cancellazione del tuo account seguendo le indicazioni della pagina «Cancellazione account» su ${value(profile, "website")}. Gli account dei dipendenti sono gestiti dal locale: il dipendente può chiedere la cancellazione al proprio datore di lavoro o a noi, e in questo caso la inoltriamo al locale.`,
    "",

    "12. COOKIE E STRUMENTI SIMILI",
    "Il sito e l'app usano solo strumenti tecnici necessari al funzionamento, come il mantenimento della sessione e la lingua scelta. Non usiamo cookie di profilazione né strumenti pubblicitari. Per questi strumenti non è richiesto il consenso.",
    "",

    "13. MINORI",
    `${service} è destinato ad attività commerciali. Se un locale impiega lavoratori minorenni, ne gestisce i dati in qualità di titolare, nel rispetto delle norme applicabili.`,
    "",

    "14. MODIFICHE",
    "Pubblichiamo ogni nuova versione di questa informativa su questa pagina, con numero di versione e data. Le modifiche rilevanti le comunichiamo anche via email o nell'app.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildTerms(profile: CompanyProfile) {
  const service = value(profile, "serviceName");

  return [
    heading(profile, `CONDIZIONI GENERALI DI SERVIZIO DI ${service.toUpperCase()}`),

    "1. PARTI E DEFINIZIONI",
    `• Fornitore: ${company(profile)}, PEC ${value(profile, "certifiedEmail")}.`,
    "• Cliente: l'impresa o il professionista che sottoscrive l'abbonamento.",
    "• Utenti: le persone che il Cliente abilita a usare il Servizio.",
    `• Servizio: la piattaforma ${service}, accessibile dal sito ${value(profile, "website")} e dall'app.`,
    "• Accordo sul trattamento: l'accordo ai sensi dell'art. 28 GDPR che fa parte di queste condizioni.",
    "",

    "2. OGGETTO",
    "Il Fornitore concede al Cliente l'uso del Servizio in abbonamento per gestire il proprio personale: pianificazione dei turni, timbrature con verifica della posizione, richieste di ferie, permessi e malattia, note interne, documenti, formazione e notifiche.",
    "Il Fornitore può aggiornare e migliorare le funzionalità, a condizione di non ridurre in modo sostanziale quelle essenziali descritte al momento della sottoscrizione.",
    "",

    "3. USO PROFESSIONALE",
    "Il Servizio è riservato a imprese e professionisti. Il Cliente dichiara di sottoscriverlo nell'esercizio della propria attività; non si applicano pertanto le disposizioni del Codice del Consumo dedicate ai consumatori.",
    "",

    "4. ACCOUNT E UTENTI",
    "Il Cliente fornisce dati veritieri e li mantiene aggiornati. È responsabile della custodia delle credenziali e delle attività svolte dagli Utenti che abilita, e informa senza ritardo il Fornitore di qualsiasi uso non autorizzato.",
    "",

    "5. PROVA GRATUITA",
    `Il Cliente può provare il Servizio gratuitamente per ${value(profile, "trialDays")} giorni, senza obbligo di proseguire. Al termine, il Servizio continua solo se il Cliente attiva un abbonamento a pagamento.`,
    "",

    "6. PREZZI E PAGAMENTI",
    `I prezzi sono quelli pubblicati su ${value(profile, "website")} al momento dell'attivazione, IVA esclusa salvo diversa indicazione. L'abbonamento si paga in anticipo tramite Stripe e si rinnova automaticamente per periodi della stessa durata. Il Fornitore emette fattura elettronica per ogni pagamento.`,
    `Le variazioni di prezzo vengono comunicate almeno ${value(profile, "noticeDays")} giorni prima e si applicano dal rinnovo successivo; il Cliente che non le accetta può disdire prima del rinnovo. In caso di mancato pagamento, il Fornitore può sospendere il Servizio dopo un avviso.`,
    "",

    "7. DURATA E DISDETTA",
    `Il contratto dura quanto l'abbonamento e si rinnova a ogni scadenza. Il Cliente può disdire in qualsiasi momento dalla sezione dedicata all'abbonamento o scrivendo a ${value(profile, "supportEmail")}. La disdetta ha effetto alla fine del periodo già pagato; non sono previsti rimborsi per periodi parziali.`,
    `Il Fornitore può recedere con un preavviso di almeno ${value(profile, "noticeDays")} giorni, rimborsando la parte di abbonamento già pagata e non goduta.`,
    "",

    "8. OBBLIGHI DEL CLIENTE",
    "Il Cliente si impegna a:",
    "• usare il Servizio nel rispetto della legge, in particolare della normativa sul lavoro e sulla protezione dei dati;",
    "• fornire ai propri dipendenti l'informativa sul trattamento dei loro dati, compresa la rilevazione della posizione al momento della timbratura;",
    "• verificare e adempiere, prima di attivare la timbratura con posizione, quanto previsto dall'art. 4 della L. 300/1970, inclusi l'eventuale accordo sindacale o l'autorizzazione dell'Ispettorato del lavoro;",
    "• impostare correttamente la posizione della sede e il raggio di verifica;",
    "• inserire solo i dati necessari, con particolare cautela nelle note sul personale, nei documenti caricati e nei dati relativi alla salute;",
    "• non caricare contenuti illeciti, non tentare di accedere a dati di altri clienti, non decodificare, copiare o rivendere il Servizio.",
    "",

    "9. DATI PERSONALI",
    `Per i dati del personale il Cliente è titolare del trattamento e il Fornitore è responsabile, secondo l'Accordo sul trattamento, che fa parte integrante di queste condizioni. I dati del Cliente come contraente sono trattati secondo l'informativa privacy pubblicata su ${value(profile, "website")}.`,
    "",

    "10. DISPONIBILITÀ E ASSISTENZA",
    `Il Fornitore mantiene il Servizio con diligenza professionale, ma non può garantire che funzioni senza interruzioni o errori. Le manutenzioni programmate vengono annunciate quando possibile. L'assistenza è disponibile a ${value(profile, "supportEmail")}.`,
    "Il Servizio è uno strumento organizzativo: non sostituisce il Libro Unico del Lavoro né gli altri adempimenti del datore di lavoro. Il Cliente verifica i dati prima di usarli per paghe, contributi o provvedimenti verso il personale.",
    "",

    "11. PROPRIETÀ INTELLETTUALE",
    "Il Servizio e il software restano di proprietà del Fornitore. Il Cliente riceve una licenza d'uso non esclusiva e non trasferibile per la durata del contratto. I dati inseriti dal Cliente e dagli Utenti restano del Cliente.",
    "",

    "12. LIMITAZIONE DI RESPONSABILITÀ",
    "Il Fornitore risponde solo dei danni diretti causati da un proprio inadempimento, entro l'importo pagato dal Cliente nei 12 mesi precedenti il fatto. Sono esclusi i danni indiretti, il mancato guadagno e la perdita di opportunità. Questi limiti non si applicano in caso di dolo o colpa grave (art. 1229 c.c.) né negli altri casi in cui la legge non consente di limitare la responsabilità.",
    "",

    "13. SOSPENSIONE",
    "Il Fornitore può sospendere l'accesso, con avviso quando possibile, in caso di mancato pagamento, di violazione grave di queste condizioni o di rischi concreti per la sicurezza del Servizio o di altri clienti.",
    "",

    "14. FINE DEL CONTRATTO E RESTITUZIONE DEI DATI",
    `Alla cessazione del contratto il Cliente può chiedere l'esportazione dei propri dati entro ${value(profile, "exportDays")} giorni. Trascorso questo termine i dati vengono cancellati, salvo quelli che il Fornitore deve conservare per legge.`,
    "",

    "15. MODIFICHE ALLE CONDIZIONI",
    `Il Fornitore può modificare queste condizioni comunicandolo almeno ${value(profile, "noticeDays")} giorni prima dell'entrata in vigore. Il Cliente che non accetta le modifiche può disdire prima di quella data senza costi. Ogni accettazione viene registrata con la versione accettata.`,
    "",

    "16. COMUNICAZIONI",
    `Il Fornitore scrive al Cliente all'indirizzo email dell'account. Il Cliente scrive al Fornitore a ${value(profile, "supportEmail")} o, per le comunicazioni formali, alla PEC ${value(profile, "certifiedEmail")}.`,
    "",

    "17. LEGGE APPLICABILE E FORO",
    `Queste condizioni sono regolate dalla legge italiana. Per ogni controversia è competente in via esclusiva il Foro di ${value(profile, "courtCity")}.`,
    "",

    "APPROVAZIONE SPECIFICA",
    "Ai sensi degli artt. 1341 e 1342 c.c. il Cliente dichiara di approvare specificamente, tramite un'apposita conferma nell'app distinta dall'accettazione delle presenti condizioni, le clausole: 6 (rinnovo automatico e variazioni di prezzo), 7 (assenza di rimborsi per periodi parziali, recesso del Fornitore), 10 (limiti di disponibilità), 12 (limitazione di responsabilità), 13 (sospensione), 15 (modifiche alle condizioni), 17 (foro esclusivo).",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildDpa(profile: CompanyProfile) {
  const service = value(profile, "serviceName");
  const cert = profile.collectsCertificateCode;

  return [
    heading(
      profile,
      "ACCORDO SUL TRATTAMENTO DEI DATI PERSONALI",
      "Ai sensi dell'art. 28 del Regolamento (UE) 2016/679"
    ),

    `Il presente accordo è concluso tra il Cliente che sottoscrive il servizio ${service}, in qualità di Titolare, e ${company(profile)}, rappresentata da ${value(profile, "legalRepresentative")}, in qualità di Responsabile. Fa parte integrante delle Condizioni generali di servizio.`,
    "",

    "1. OGGETTO E DURATA",
    "Il Responsabile tratta dati personali per conto del Titolare per fornire il Servizio. L'accordo dura quanto il contratto di servizio e, dopo la sua fine, per il tempo necessario alla restituzione o cancellazione dei dati.",
    "",

    "2. NATURA E FINALITÀ DEL TRATTAMENTO",
    "Conservazione, organizzazione, consultazione, elaborazione e cancellazione dei dati, e invio di notifiche ed email, allo scopo di mettere a disposizione del Titolare le funzioni di gestione del personale: turni, timbrature con verifica della posizione, richieste, note, documenti e formazione.",
    "",

    "3. INTERESSATI",
    "Dipendenti e collaboratori del Titolare, e le persone che il Titolare abilita come responsabili o amministratori del proprio locale.",
    "",

    "4. TIPI DI DATI",
    "• dati identificativi e di contatto: nome, cognome, email, ruolo, lingua;",
    "• credenziali, sessioni e identificativi dei dispositivi;",
    "• turni, disponibilità e timbrature, con data, ora e coordinate geografiche al momento della timbratura;",
    "• richieste di ferie, permessi, cambio turno e straordinari, con motivazioni in testo libero;",
    `• periodi di assenza per malattia${cert ? " e numero di protocollo del certificato medico, che costituisce dato relativo alla salute (art. 9 GDPR)" : ""};`,
    "• note dei responsabili su singoli dipendenti;",
    "• documenti caricati dal Titolare e i dati in essi contenuti, anche di natura retributiva;",
    "• corsi di formazione e stato di completamento.",
    "",

    "5. ISTRUZIONI DEL TITOLARE",
    "Il Responsabile tratta i dati solo su istruzioni documentate del Titolare, costituite da questo accordo, dalle Condizioni generali e dalle impostazioni che il Titolare configura nel Servizio, salvo che il diritto dell'Unione o italiano lo obblighi diversamente. Informa subito il Titolare se ritiene che un'istruzione violi la normativa.",
    "",

    "6. RISERVATEZZA",
    "Il Responsabile consente l'accesso ai dati solo alle persone autorizzate che ne hanno bisogno, vincolate a un obbligo di riservatezza.",
    "",

    "7. SICUREZZA",
    "Il Responsabile adotta le misure tecniche e organizzative adeguate previste dall'art. 32 GDPR, descritte nell'Allegato B, e le aggiorna nel tempo senza ridurne il livello di protezione.",
    "",

    "8. SUB-RESPONSABILI",
    `Il Titolare autorizza in via generale il ricorso ai sub-responsabili elencati nell'Allegato A. Il Responsabile comunica l'aggiunta o la sostituzione di un sub-responsabile almeno ${value(profile, "noticeDays")} giorni prima; il Titolare può opporsi per motivi ragionevoli e, se non si trova una soluzione, recedere senza penali.`,
    "Il Responsabile impone ai sub-responsabili gli stessi obblighi di protezione dei dati e ne risponde nei confronti del Titolare.",
    "",

    "9. TRASFERIMENTI FUORI DALL'UNIONE EUROPEA",
    "I trasferimenti verso paesi terzi avvengono solo con le garanzie del capo V GDPR: decisione di adeguatezza, incluso l'EU-US Data Privacy Framework per i fornitori certificati, oppure clausole contrattuali standard.",
    "",

    "10. RICHIESTE DEGLI INTERESSATI",
    "Il Responsabile aiuta il Titolare a rispondere alle richieste degli interessati con le funzioni del Servizio e, dove serve, con assistenza diretta. Se riceve una richiesta, la inoltra al Titolare senza ritardo e non risponde nel merito senza sue istruzioni.",
    "",

    "11. ASSISTENZA AL TITOLARE",
    "Il Responsabile assiste il Titolare negli obblighi degli artt. 32–36 GDPR, fornendo le informazioni disponibili utili alla valutazione d'impatto e alla consultazione preventiva.",
    "",

    "12. VIOLAZIONI DEI DATI",
    `Il Responsabile comunica al Titolare ogni violazione dei dati personali senza ingiustificato ritardo e comunque entro ${value(profile, "breachHours")} ore da quando ne viene a conoscenza, con le informazioni previste dall'art. 33.3 GDPR disponibili in quel momento, e lo assiste nelle notifiche successive.`,
    "",

    "13. FINE DEL TRATTAMENTO",
    `Alla cessazione del Servizio il Responsabile, a scelta del Titolare, restituisce i dati in un formato di uso comune o li cancella entro ${value(profile, "exportDays")} giorni, salvo quelli che la legge gli impone di conservare.`,
    "",

    "14. VERIFICHE",
    "Il Responsabile mette a disposizione le informazioni necessarie a dimostrare il rispetto di questo accordo. Il Titolare può svolgere un'ispezione, anche tramite un revisore vincolato alla riservatezza, con preavviso di almeno 30 giorni, a proprie spese e non più di una volta l'anno, salvo in caso di violazione dei dati.",
    "",

    "15. OBBLIGHI DEL TITOLARE",
    "Il Titolare garantisce di avere una base giuridica valida per i trattamenti, di aver informato i dipendenti, di aver adempiuto quanto previsto dall'art. 4 della L. 300/1970 per la timbratura con posizione e di impartire istruzioni lecite. Si impegna a inserire solo i dati necessari.",
    "",

    "16. RESPONSABILITÀ",
    "Ciascuna parte risponde secondo l'art. 82 GDPR. Per il resto si applicano le limitazioni delle Condizioni generali, nei limiti consentiti dalla legge.",
    "",

    "ALLEGATO A — SUB-RESPONSABILI AUTORIZZATI",
    `• Railway — server applicativo e database. Tutti i dati del Servizio. Area: ${value(profile, "hostingRegion")}.`,
    "• Google Firebase — notifiche push. Identificativo del dispositivo e testo della notifica. Area: UE / USA.",
    "• Resend — invio di email. Nome, indirizzo email e contenuto del messaggio. Area: USA.",
    "• Stripe — incasso degli abbonamenti. Dati del cliente e di pagamento. Area: UE / USA.",
    profile.invoicingActive
      ? "• Fatture in Cloud (TeamSystem) — fatturazione elettronica. Dati fiscali del cliente. Area: UE."
      : "",
    "",

    "ALLEGATO B — MISURE DI SICUREZZA",
    "• cifratura delle comunicazioni tra dispositivi e server;",
    "• password salvate solo in forma di hash; accesso anche con passkey;",
    "• separazione dei dati per locale e permessi in base al ruolo dell'utente;",
    "• sessioni attive visibili e revocabili;",
    "• accesso amministrativo ai sistemi limitato al personale autorizzato;",
    "• cancellazione a cascata dei dati collegati quando si elimina un utente o un locale.",
    "",

    "ACCETTAZIONE",
    `Il Cliente accetta questo accordo nell'app al momento della sottoscrizione, con una conferma dedicata. ${service} registra l'account che ha accettato, la data, l'ora e la versione dell'accordo. Le versioni successive vengono sottoposte di nuovo ad accettazione con le stesse modalità.`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildGeolocation(profile: CompanyProfile) {
  const service = value(profile, "serviceName");

  return [
    heading(
      profile,
      "INFORMATIVA AI DIPENDENTI SULLA TIMBRATURA CON RILEVAZIONE DELLA POSIZIONE",
      "Ai sensi degli artt. 13 del Regolamento (UE) 2016/679 e 4 della L. 300/1970"
    ),

    `Questo è un modello che ${service} mette a disposizione dei locali. Le parti fra parentesi quadre le compila il locale prima di consegnarlo ai dipendenti.`,
    "",

    "CHI TRATTA I TUOI DATI",
    `Il titolare è il tuo datore di lavoro, ${venueBlank("Ragione sociale del locale")}, con sede in ${venueBlank("Sede del locale")}, contattabile a ${venueBlank("Email o telefono del locale")}.`,
    `Il locale usa il servizio ${service}, fornito da ${value(profile, "legalName")}, che tratta i dati per suo conto come responsabile del trattamento.`,
    "",

    "COSA VIENE RILEVATO E QUANDO",
    `Quando timbri l'entrata o l'uscita dall'app, il telefono comunica la sua posizione in quel momento. La posizione viene confrontata con quella del locale per verificare che tu sia entro ${venueBlank("raggio")} metri dalla sede. Vengono salvate data, ora e coordinate della timbratura.`,
    "La posizione non viene rilevata in nessun altro momento: né durante il turno, né quando l'app è chiusa o in background, né fuori dall'orario di lavoro. Non viene ricostruito alcun percorso.",
    "",

    "PERCHÉ",
    "Per verificare che la timbratura avvenga sul luogo di lavoro e per registrare correttamente le presenze.",
    "",

    "BASE GIURIDICA",
    `Il trattamento è necessario per la gestione del rapporto di lavoro e per gli obblighi di legge del datore di lavoro (artt. 6.1.b, 6.1.c e 88 GDPR, art. 114 del d.lgs. 196/2003), nel rispetto dell'art. 4 della L. 300/1970. ${venueBlank("Estremi dell'accordo sindacale o dell'autorizzazione dell'Ispettorato del lavoro, se previsti")}`,
    "",

    "COME VENGONO USATE LE INFORMAZIONI",
    "Le informazioni raccolte sono utilizzabili ai fini connessi al rapporto di lavoro nei limiti dell'art. 4, comma 3, della L. 300/1970 e nel rispetto della normativa sulla protezione dei dati, a condizione che tu ne sia adeguatamente informato: questo documento serve a questo.",
    "",

    "CHI PUÒ VEDERE I DATI",
    `${venueBlank("Ruoli autorizzati nel locale, per esempio titolare e responsabile di sala")}. Inoltre ${service} e i suoi fornitori tecnici, solo per far funzionare il servizio.`,
    "",

    "PER QUANTO TEMPO",
    `Le coordinate si conservano ${value(profile, "retentionPosition")}. Gli orari delle timbrature si conservano ${value(profile, "retentionTimelogs")}.`,
    "",

    "SE NON VUOI CONCEDERE LA POSIZIONE",
    `Puoi negare o revocare il permesso di localizzazione dalle impostazioni del telefono. In quel caso non potrai timbrare dall'app e registrerai le presenze in questo modo: ${venueBlank("Modalità alternativa di timbratura")}.`,
    "",

    "I TUOI DIRITTI",
    `Puoi chiedere l'accesso ai tuoi dati, la rettifica, la cancellazione, la limitazione e la portabilità, e opporti al trattamento nei casi previsti (artt. 15–22 GDPR), scrivendo a ${venueBlank("Email del locale")}. Puoi anche proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).`,
    "",

    "PRESA VISIONE",
    `Confermi di aver letto questa informativa toccando «Ho letto e compreso» nell'app. ${service} registra la conferma con il tuo account, la data, l'ora e la versione del documento, e la rende consultabile al locale. La conferma attesta che hai ricevuto l'informazione: non è un consenso al trattamento.`,
    "Se il documento viene aggiornato, l'app ti chiede di leggerlo e confermarlo di nuovo.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildAccountDeletion(profile: CompanyProfile) {
  const service = value(profile, "serviceName");

  return [
    heading(profile, `COME ELIMINARE IL TUO ACCOUNT ${service.toUpperCase()}`),

    `Questa pagina spiega come chiedere l'eliminazione del tuo account ${service} e dei dati collegati, quali dati vengono cancellati e quali invece conserviamo per obbligo di legge. ${service} è un servizio di ${value(profile, "legalName")}.`,
    "",

    "1. DALL'APP",
    `Accedi a ${service} con il tuo account, vai in ${value(profile, "deletionPath")} e conferma. La richiesta parte subito e non serve scrivere a nessuno.`,
    "",

    "2. PER EMAIL",
    `Se non riesci ad accedere, scrivi a ${value(profile, "supportEmail")} dall'indirizzo email del tuo account, chiedendo l'eliminazione. Potremmo chiederti di confermare la tua identità prima di procedere.`,
    "",

    "3. SE SEI UN DIPENDENTE",
    "Il tuo account è stato creato dal locale per cui lavori, che è titolare dei tuoi dati di lavoro. Puoi chiedere la cancellazione al tuo datore di lavoro oppure a noi: in questo secondo caso inoltriamo la richiesta al locale e lo assistiamo nella risposta.",
    "",

    "4. COSA VIENE CANCELLATO",
    "Vengono eliminati i dati del tuo account — nome, cognome, email, credenziali, sessioni, identificativi dei dispositivi per le notifiche — e i dati collegati che non dobbiamo conservare per legge: turni, disponibilità, richieste, note che ti riguardano, documenti assegnati, corsi.",
    "",

    "5. COSA CONSERVIAMO E PERCHÉ",
    `• Timbrature e registrazioni delle presenze: ${value(profile, "retentionTimelogs")}, perché documentano il rapporto di lavoro.`,
    `• Dati fiscali e fatture: ${value(profile, "retentionTaxData")}.`,
    `• Log di accesso: ${value(profile, "retentionAccessLogs")}, per la sicurezza del servizio.`,
    "Questi dati restano al locale in quanto datore di lavoro, non a noi per finalità nostre.",
    "",

    "6. IN QUANTO TEMPO",
    `La cancellazione avviene entro ${value(profile, "deletionDays")} giorni dalla richiesta. Al termine ricevi una conferma all'indirizzo email che ci hai indicato.`,
    "",

    "7. SE ELIMINI ANCHE IL LOCALE",
    `Se sei il titolare e chiedi l'eliminazione del locale, vengono cancellati tutti i dati collegati, compresi quelli dei dipendenti. Prima di procedere puoi chiedere l'esportazione dei dati entro ${value(profile, "exportDays")} giorni.`,
    "",

    "8. CONTATTI",
    `Per qualsiasi domanda: ${value(profile, "supportEmail")}. Per le questioni sulla protezione dei dati: ${value(profile, "privacyEmail")} o PEC ${value(profile, "certifiedEmail")}.`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildCookies(profile: CompanyProfile) {
  const service = value(profile, "serviceName");

  return [
    heading(profile, "COOKIE POLICY"),

    `${service} usa esclusivamente cookie e strumenti tecnici necessari al funzionamento del sito ${value(profile, "website")} e dell'app. Non usiamo cookie di profilazione, non tracciamo la navigazione per finalità pubblicitarie e non cediamo dati a circuiti di advertising. Per questi strumenti la normativa non richiede il consenso.`,
    "",

    "COSA USIAMO",
    "• Cookie di sessione: mantengono l'accesso tra una pagina e l'altra. Durano quanto la sessione impostata al momento dell'accesso e si cancellano con la disconnessione.",
    "• Cookie di preferenza: ricordano la lingua scelta e se hai chiesto di restare collegato.",
    "• Archiviazione locale del browser: conserva alcune preferenze di visualizzazione sul tuo dispositivo. Non viene mai trasmessa ai nostri server.",
    "",

    "COOKIE DI TERZE PARTI",
    "Le pagine di pagamento sono ospitate da Stripe, che utilizza propri cookie tecnici e antifrode secondo la propria informativa. Le notifiche push si appoggiano ai servizi Google, che non impiegano cookie sul nostro sito.",
    "",

    "COME DISATTIVARLI",
    "Puoi bloccare o cancellare i cookie dalle impostazioni del browser. Bloccando i cookie tecnici l'accesso al servizio non funziona: non è possibile restare autenticati.",
    "",

    "CONTATTI",
    `Per qualsiasi domanda: ${value(profile, "privacyEmail")}.`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildProcessingRegister(profile: CompanyProfile) {
  const service = value(profile, "serviceName");
  const cert = profile.collectsCertificateCode;
  const transfers =
    "Stati Uniti, per i fornitori con sede o accesso da lì: decisione di adeguatezza EU-US Data Privacy Framework per i fornitori certificati, altrimenti clausole contrattuali standard (art. 46 GDPR).";

  return [
    heading(profile, "REGISTRO DELLE ATTIVITÀ DI TRATTAMENTO", "Art. 30 del Regolamento (UE) 2016/679"),

    "DATI DELL'ORGANIZZAZIONE",
    `Denominazione: ${value(profile, "legalName")}`,
    `Sede legale: ${value(profile, "registeredOffice")}`,
    `Partita IVA: ${value(profile, "vatNumber")}${profile.taxCode.trim() ? ` · codice fiscale: ${profile.taxCode.trim()}` : ""}`,
    `Legale rappresentante: ${value(profile, "legalRepresentative")}`,
    `Contatti: PEC ${value(profile, "certifiedEmail")} · email ${value(profile, "privacyEmail")}`,
    `Responsabile della protezione dei dati: ${profile.dpoContact.trim() || "non nominato"}`,
    "",
    `Il registro è tenuto in forma elettronica, aggiornato a ogni modifica dei trattamenti e messo a disposizione del Garante su richiesta. Si compone di due parti: i trattamenti svolti come titolare (art. 30.1) e quelli svolti come responsabile per conto dei clienti (art. 30.2).`,
    "",

    "PARTE A — TRATTAMENTI COME TITOLARE (art. 30.1)",
    "",
    "A1. GESTIONE DEI CLIENTI E DEI CONTRATTI",
    `Finalità: registrazione, attivazione e gestione dell'account del cliente; erogazione del servizio ${service}; comunicazioni di servizio.`,
    "Base giuridica: esecuzione del contratto (art. 6.1.b).",
    "Interessati: titolari e legali rappresentanti dei locali clienti, referenti amministrativi.",
    "Dati: nome, cognome, email, ruolo, credenziali e passkey, lingua, identificativi dei dispositivi per le notifiche.",
    "Destinatari: Railway (hosting e database), Resend (email), Google Firebase (notifiche push).",
    `Trasferimenti extra UE: ${transfers}`,
    `Conservazione: per la durata del contratto; dopo la cessazione, cancellazione entro ${value(profile, "exportDays")} giorni salvo obblighi di legge.`,
    "",

    "A2. PAGAMENTI E FATTURAZIONE",
    "Finalità: incasso degli abbonamenti, emissione e conservazione delle fatture elettroniche, adempimenti contabili e fiscali.",
    "Base giuridica: esecuzione del contratto (art. 6.1.b) e obbligo di legge (art. 6.1.c).",
    "Interessati: clienti e loro legali rappresentanti.",
    "Dati: ragione sociale, partita IVA, codice fiscale, codice destinatario, PEC, indirizzo, identificativo cliente presso Stripe, storico dei pagamenti. I dati della carta sono trattati solo da Stripe.",
    `Destinatari: Stripe${profile.invoicingActive ? ", Fatture in Cloud" : ""}, Agenzia delle Entrate tramite Sistema di Interscambio, consulente fiscale.`,
    `Trasferimenti extra UE: ${transfers}`,
    `Conservazione: ${value(profile, "retentionTaxData")}.`,
    "",

    "A3. ASSISTENZA AI CLIENTI E AGLI UTENTI",
    `Finalità: risposta alle richieste di assistenza ricevute a ${value(profile, "supportEmail")}.`,
    "Base giuridica: esecuzione del contratto (art. 6.1.b).",
    "Interessati: clienti, utenti del servizio compresi i dipendenti dei locali, altri richiedenti.",
    "Dati: dati di contatto e contenuto della richiesta.",
    "Destinatari: fornitore del servizio di posta elettronica, Railway.",
    `Trasferimenti extra UE: ${transfers}`,
    "Conservazione: per la durata del contratto con il cliente.",
    "",

    "A4. SICUREZZA DEL SERVIZIO",
    "Finalità: prevenzione e accertamento di accessi non autorizzati e abusi, integrità del servizio.",
    "Base giuridica: legittimo interesse alla sicurezza del servizio (art. 6.1.f).",
    "Interessati: tutti gli utenti del servizio e i visitatori del sito.",
    "Dati: log di accesso, sessioni, indirizzo IP, tipo di dispositivo.",
    "Destinatari: Railway.",
    `Trasferimenti extra UE: ${transfers}`,
    `Conservazione: ${value(profile, "retentionAccessLogs")}.`,
    "",

    "A5. RICHIESTE DEGLI INTERESSATI E CANCELLAZIONE DEGLI ACCOUNT",
    "Finalità: gestione delle richieste di esercizio dei diritti (artt. 15–22) e delle richieste di eliminazione dell'account; prova del loro riscontro.",
    "Base giuridica: obbligo di legge (art. 6.1.c, artt. 12 e 17 GDPR).",
    "Interessati: chiunque presenti una richiesta.",
    "Dati: dati identificativi e di contatto, contenuto della richiesta, esito e data del riscontro.",
    "Destinatari: il locale titolare quando la richiesta riguarda dati del personale; Resend.",
    `Trasferimenti extra UE: ${transfers}`,
    "Conservazione: per il tempo necessario a dimostrare il riscontro, non oltre i termini di prescrizione.",
    "",

    "PARTE B — TRATTAMENTI COME RESPONSABILE (art. 30.2)",
    `Responsabile: ${value(profile, "legalName")}, ${value(profile, "registeredOffice")}, PEC ${value(profile, "certifiedEmail")}.`,
    `Titolari per conto dei quali si tratta: ciascun locale cliente del servizio ${service}. L'elenco aggiornato dei titolari, con i rispettivi dati identificativi e di contatto, è tenuto nel sistema ed è estraibile su richiesta. Il rapporto è regolato dall'Accordo sul trattamento accettato da ciascun cliente.`,
    "Interessati: dipendenti e collaboratori dei locali; responsabili e amministratori abilitati dai locali.",
    "Sub-responsabili: Railway (server e database), Google Firebase (notifiche push), Resend (email).",
    `Trasferimenti extra UE: ${transfers}`,
    "",
    "Categorie di trattamenti svolti per conto dei titolari:",
    "• Gestione degli account del personale — nome, cognome, email, ruolo, credenziali, passkey, lingua, identificativi dei dispositivi. Conservazione: fino all'eliminazione dell'account.",
    "• Pianificazione dei turni — turni, assegnazioni, conferme, disponibilità. Conservazione: per la durata del contratto con il locale.",
    `• Rilevazione delle presenze — data e ora delle timbrature, inserimenti manuali, chiusure automatiche. Conservazione: ${value(profile, "retentionTimelogs")}.`,
    `• Verifica della posizione alla timbratura — coordinate geografiche del dispositivo nel momento della timbratura; posizione e raggio della sede. Conservazione: ${value(profile, "retentionPosition")}.`,
    `• Gestione delle richieste — ferie, permessi, cambio turno, straordinari, malattia; motivazioni, esito, revisore. Conservazione: ${value(profile, "retentionRequests")}.`,
    cert
      ? `• Gestione delle assenze per malattia — numero di protocollo del certificato medico, dato relativo alla salute (art. 9). Conservazione: ${value(profile, "retentionCertificate")}.`
      : "",
    `• Note sul personale — testo libero dei responsabili su singoli dipendenti, conferme di lettura. Conservazione: ${value(profile, "retentionNotes")}.`,
    `• Archiviazione dei documenti — file caricati dal locale, anche contratti e buste paga. Conservazione: ${value(profile, "retentionDocuments")}.`,
    "• Formazione — corsi assegnati, scadenze, stato di completamento. Conservazione: per la durata del contratto con il locale.",
    "• Notifiche ed email — identificativo del dispositivo, indirizzo email, testo del messaggio. Conservazione: il tempo necessario all'invio.",
    "",

    "PARTE C — MISURE TECNICHE E ORGANIZZATIVE (art. 32)",
    "• cifratura delle comunicazioni tra dispositivi e server;",
    "• password salvate solo in forma di hash; accesso anche con passkey;",
    "• separazione dei dati per locale e permessi in base al ruolo dell'utente;",
    "• sessioni attive visibili e revocabili;",
    "• accesso amministrativo ai sistemi limitato al personale autorizzato, vincolato alla riservatezza;",
    "• fornitori nominati responsabili o sub-responsabili con accordo scritto;",
    `• procedura di gestione delle violazioni dei dati, con avviso ai clienti entro ${value(profile, "breachHours")} ore.`,
    "",

    "STORICO DEGLI AGGIORNAMENTI",
    `Versione ${value(profile, "documentVersion")} del ${value(profile, "effectiveFrom")} — prima redazione del registro.`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildImpactAssessment(profile: CompanyProfile) {
  const service = value(profile, "serviceName");
  const cert = profile.collectsCertificateCode;

  return [
    heading(
      profile,
      "VALUTAZIONE D'IMPATTO SULLA PROTEZIONE DEI DATI",
      `Art. 35 del Regolamento (UE) 2016/679 · Gestione del personale e timbratura con verifica della posizione tramite ${service}`
    ),

    "0. CHI LA ADOTTA",
    `La valutazione d'impatto spetta al titolare del trattamento, cioè al locale che usa ${service} per gestire il proprio personale. ${value(profile, "legalName")}, fornitore di ${service} e responsabile del trattamento, la predispone e la mette a disposizione dei clienti per assisterli, come previsto dall'art. 28.3.f GDPR e dall'Accordo sul trattamento.`,
    `Titolare: ${venueBlank("Ragione sociale del locale")}, ${venueBlank("Sede del locale")}.`,
    `Responsabile del trattamento: ${value(profile, "legalName")}, ${value(profile, "registeredOffice")}, PEC ${value(profile, "certifiedEmail")}.`,
    `Responsabile della protezione dei dati del locale: ${venueBlank("Nome e contatto, se nominato")}.`,
    `Redatta da: ${value(profile, "legalName")} per la parte tecnica; ${venueBlank("Nome di chi la completa per il locale")}.`,
    "",

    "1. PERCHÉ SERVE LA VALUTAZIONE",
    `Secondo le linee guida del Comitato europeo (WP248 rev.01), un trattamento che soddisfa almeno due criteri di rischio richiede di norma una valutazione d'impatto. Qui ne ricorrono ${cert ? "tre" : "due"}:`,
    "• interessati vulnerabili: i dipendenti, per lo squilibrio di potere nel rapporto con il datore di lavoro;",
    "• monitoraggio sistematico: la posizione viene rilevata e conservata a ogni timbratura;",
    cert ? "• dati particolari: il numero di protocollo del certificato medico è un dato relativo alla salute." : "",
    "Inoltre l'elenco del Garante (provvedimento n. 467 dell'11 ottobre 2018) include i trattamenti svolti nell'ambito del rapporto di lavoro con sistemi tecnologici, anche di geolocalizzazione, che permettono un controllo a distanza dell'attività dei dipendenti.",
    "",

    "2. DESCRIZIONE DEL TRATTAMENTO",
    `Contesto: bar o ristorante che gestisce il personale con ${service}: turni, timbrature, richieste, note, documenti, formazione. Circa ${venueBlank("numero")} dipendenti coinvolti.`,
    "Finalità: organizzazione del lavoro, rilevazione delle presenze, verifica che la timbratura avvenga sul luogo di lavoro, gestione di ferie, permessi e assenze.",
    "Interessati: dipendenti e collaboratori del locale; responsabili abilitati.",
    `Dati: account (nome, cognome, email, ruolo, credenziali); turni e disponibilità; timbrature con data, ora e coordinate; richieste con motivazioni${cert ? " e numero di protocollo del certificato medico" : ""}; note dei responsabili; documenti caricati; formazione.`,
    `Come funziona la posizione: al momento della timbratura l'app legge la posizione del telefono e la confronta con la sede e il raggio impostati dal locale (${venueBlank("raggio")} metri). Salva data, ora e coordinate. Nessuna rilevazione in altri momenti, in background o continuativa.`,
    `Flusso dei dati: telefono del dipendente → server ${service} su Railway (${value(profile, "hostingRegion")}) → consultazione da parte dei responsabili autorizzati del locale. Notifiche tramite Google Firebase, email tramite Resend.`,
    `Chi accede: ${venueBlank("Ruoli autorizzati nel locale")}; personale autorizzato di ${value(profile, "legalName")} solo per assistenza e manutenzione.`,
    `Conservazione: orari ${value(profile, "retentionTimelogs")}; coordinate ${value(profile, "retentionPosition")}; richieste ${value(profile, "retentionRequests")}${cert ? `; certificato ${value(profile, "retentionCertificate")}` : ""}; note ${value(profile, "retentionNotes")}; documenti ${value(profile, "retentionDocuments")}.`,
    "",

    "3. NECESSITÀ E PROPORZIONALITÀ",
    `Base giuridica: esecuzione del contratto di lavoro e obblighi di legge (artt. 6.1.b, 6.1.c e 88 GDPR, art. 114 d.lgs. 196/2003), nel rispetto dell'art. 4 L. 300/1970. ${venueBlank("Estremi dell'accordo sindacale o dell'autorizzazione INL, se previsti")}`,
    "Limitazione della finalità: la posizione serve solo a verificare il luogo della timbratura. Le informazioni sono utilizzabili ai fini del rapporto di lavoro nei limiti dell'art. 4, comma 3, L. 300/1970.",
    "Minimizzazione: rilevazione puntuale e non continua; nessun percorso; raggio configurabile; coordinate cancellate prima degli orari.",
    "Esattezza: le timbrature inserite a mano da un responsabile o chiuse in automatico sono contrassegnate come tali; il dipendente può chiedere la correzione.",
    "Trasparenza: informativa dedicata, letta e confermata dal dipendente nell'app con registrazione di data e versione.",
    `Diritti degli interessati: esercitabili verso il locale; ${service} assiste il locale e inoltra le richieste ricevute.`,
    "Responsabile e fornitori: accordo art. 28 accettato nell'app; sub-responsabili elencati; trasferimenti extra UE con DPF o clausole contrattuali standard.",
    `Alternative valutate: il locale indica perché ha scelto la verifica della posizione rispetto a soluzioni meno invasive, come un codice QR esposto in sede o un terminale fisso: ${venueBlank("motivazione del locale")}. Chi nega il permesso di localizzazione timbra così: ${venueBlank("modalità alternativa")}.`,
    "",

    "4. RISCHI PER I DIRITTI E LE LIBERTÀ DEGLI INTERESSATI",
    "Probabilità e gravità sono valutate su tre livelli: bassa, media, alta. Il rischio residuo tiene conto delle misure indicate, comprese quelle ancora da completare nel piano d'azione.",
    "",
    "R1. Uso della posizione per controllare l'attività oltre la timbratura — impatto: sensazione di sorveglianza, pressione, provvedimenti ingiustificati. Probabilità media, gravità alta. Misure: rilevazione solo alla timbratura; finalità dichiarata; accordo o autorizzazione ex art. 4; informativa confermata; accesso limitato ai ruoli autorizzati. Residuo: basso.",
    "R2. Accesso non autorizzato ai dati — impatto: divulgazione di presenze, posizioni, documenti. Probabilità bassa, gravità alta. Misure: password in hash, passkey, sessioni revocabili, separazione dei dati per locale, permessi per ruolo, cifratura delle comunicazioni. Residuo: basso.",
    cert
      ? `R3. Dati sulla salute visibili a chi non deve — impatto: discriminazione, danno alla reputazione. Probabilità media, gravità alta. Misure: visibilità ristretta a chi gestisce le richieste; conservazione breve (${value(profile, "retentionCertificate")}); valutare di non raccogliere affatto il numero di protocollo. Residuo: medio.`
      : "",
    `R4. Note sul personale con contenuti eccessivi o discriminatori — impatto: giudizi non verificati, pregiudizio nel rapporto di lavoro. Probabilità media, gravità media. Misure: limiti d'uso nelle condizioni di servizio; conservazione limitata; ${venueBlank("regole interne del locale sull'uso delle note")}. Residuo: medio.`,
    "R5. Conservazione oltre il necessario — impatto: esposizione prolungata di dati personali. Probabilità alta, gravità media. Misure: tempi definiti per ogni categoria; cancellazione automatica da implementare. Residuo: alto finché non è implementata.",
    "R6. Posizione imprecisa — impatto: timbratura rifiutata o contestata ingiustamente. Probabilità media, gravità media. Misure: raggio configurabile; correzione manuale tracciata; modalità alternativa di timbratura. Residuo: basso.",
    "R7. Perdita delle presenze alla cancellazione di un account — impatto: impossibilità per il dipendente di dimostrare ore lavorate. Probabilità media, gravità media. Misure: oggi la cancellazione è a cascata; conservare gli orari per i tempi di legge anche dopo l'eliminazione dell'account. Residuo: alto finché non è modificata.",
    `R8. Accesso ai dati da paesi terzi — impatto: perdita di controllo sui dati. Probabilità bassa, gravità media. Misure: server in ${value(profile, "hostingRegion")}; DPF o clausole contrattuali standard con i fornitori. Residuo: basso.`,
    `R9. Violazione dei dati presso un fornitore — impatto: divulgazione o indisponibilità dei dati. Probabilità bassa, gravità alta. Misure: fornitori nominati con accordo scritto; avviso al locale entro ${value(profile, "breachHours")} ore. Residuo: basso.`,
    "",

    "5. PIANO D'AZIONE",
    `• Implementare la cancellazione automatica secondo i tempi di conservazione — a carico di ${value(profile, "legalName")} — da fare.`,
    `• Conservare gli orari delle timbrature dopo l'eliminazione dell'account — a carico di ${value(profile, "legalName")} — da fare.`,
    `• Verificare l'area dei server e i permessi di accesso ai dati di malattia — a carico di ${value(profile, "legalName")} — da fare.`,
    `• Decidere se continuare a raccogliere il numero di protocollo del certificato — a carico di ${value(profile, "legalName")} e del locale — da decidere.`,
    `• Accordo sindacale o autorizzazione dell'Ispettorato, se necessari — a carico del locale — ${venueBlank("stato")}.`,
    `• Far leggere e confermare l'informativa ai dipendenti nell'app — a carico del locale — ${venueBlank("stato")}.`,
    `• Impostare sede e raggio e definire la modalità alternativa di timbratura — a carico del locale — ${venueBlank("stato")}.`,
    "",

    "6. CONCLUSIONE",
    "Con le misure in essere e il completamento del piano d'azione, il rischio residuo è da ritenersi accettabile. Finché le misure indicate come «da fare» non sono completate, alcuni rischi restano alti: se il titolare ritiene che non possano essere ridotti, deve consultare il Garante prima di iniziare il trattamento (art. 36 GDPR).",
    `Parere del responsabile della protezione dei dati: ${venueBlank("parere, se nominato")}.`,
    `Opinione dei dipendenti o dei loro rappresentanti (art. 35.9): ${venueBlank("come è stata raccolta e cosa è emerso")}.`,
    `Decisione del titolare: ${venueBlank("trattamento avviato / avviato con condizioni / consultazione del Garante")}.`,
    `Adottata il: ${venueBlank("data")}.`,
    "Prossimo riesame: entro un anno, o prima in caso di modifiche rilevanti al servizio o al trattamento.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export const LEGAL_TEMPLATES: LegalTemplate[] = [
  {
    type: LegalDocumentType.PRIVACY_POLICY,
    title: "Informativa sul trattamento dei dati personali",
    essential: true,
    summary: "Pubblica su /privacy. Gli store ne verificano l'indirizzo prima di approvare.",
    build: buildPrivacy,
  },
  {
    type: LegalDocumentType.TERMS_AND_CONDITIONS,
    title: "Condizioni generali di servizio",
    essential: true,
    summary: "Pubblica su /terms. È il contratto con il locale che si abbona.",
    build: buildTerms,
  },
  {
    type: LegalDocumentType.DPA,
    title: "Accordo sul trattamento dei dati personali",
    essential: true,
    summary: "Da far accettare a ogni titolare: è l'atto che regge il tuo ruolo di responsabile.",
    build: buildDpa,
  },
  {
    type: LegalDocumentType.GEOLOCATION_NOTICE,
    title: "Informativa sulla timbratura con rilevazione della posizione",
    essential: true,
    summary: "Modello che ogni locale consegna ai propri dipendenti, con le parti da completare.",
    build: buildGeolocation,
  },
  {
    type: LegalDocumentType.ACCOUNT_DELETION,
    title: "Come eliminare il tuo account",
    essential: true,
    summary: "Pubblica su /account-deletion. Obbligatoria per entrambi gli store.",
    build: buildAccountDeletion,
  },
  {
    type: LegalDocumentType.COOKIE_POLICY,
    title: "Cookie policy",
    essential: false,
    summary: "Solo strumenti tecnici: utile averla separata, anche se l'informativa già la copre.",
    build: buildCookies,
  },
  {
    type: LegalDocumentType.OTHER,
    title: "Registro delle attività di trattamento",
    essential: true,
    internal: true,
    summary: "Non si pubblica: si tiene e si mostra al Garante se lo chiede (art. 30).",
    build: buildProcessingRegister,
  },
  {
    type: LegalDocumentType.OTHER,
    title: "Valutazione d'impatto sulla protezione dei dati",
    essential: true,
    internal: true,
    summary: "Non si pubblica. Va completata prima di attivare il trattamento, non dopo (art. 35).",
    build: buildImpactAssessment,
  },
];
