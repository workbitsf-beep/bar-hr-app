# Costi e fornitori · Presenze per il consulente

## Presenze (`/dashboard/presenze`)

Dal 30 ottobre 2026 una sola pagina sostituisce tre voci di menu: Timbrature, Export PDF e Presenze per il consulente. I vecchi indirizzi portano qui (`next.config.js`). Cosa vede chi la apre:
- **Titolare e staff con il permesso timbrature o report**:
  - chi è dentro adesso;
  - il riepilogo del mese e la lista delle persone;
  - l'invio al consulente.
- **Dettaglio di una persona**:
  - i giorni con le timbrature e il PDF del mese;
  - "Sistema timbratura", per togliere o aggiungere una timbratura;
  - "Solo nel file", per la correzione che vale solo per il consulente.
- **Tutti gli altri**: il proprio mese.

La timbratura vera resta sulla Home.

### Il file per il consulente

Per il titolare e per chi ha il permesso "report", ognuno sulle persone che segue. Impostazioni e destinatari: solo il titolare.

**Da dove vengono le ore** (`BarSettings.payrollSource`):
- `CLOCK`: dalle timbrature arrotondate, come il report del mese.
- `SHIFTS`: dai turni pubblicati, meno l'eventuale pausa (`payrollBreakMinutes` sui turni di almeno `payrollBreakAfterHours` ore). Il file si ricalcola a ogni apertura, quindi segue il calendario. I turni non pubblicati e quelli su chiamata non contano, e la pagina lo dice.
- `AUTO` (predefinito): `SHIFTS` se il locale ha spento la timbratura, altrimenti `CLOCK`.

Ferie, permessi, malattia, chiusure e corsi arrivano sempre dal calendario, giorno per giorno. Con le ore settimanali del contratto (`EmployeeBar.contractWeeklyHours`):
- quello che supera la settimana (da lunedì a domenica) è straordinario;
- un giorno di assenza vale ore settimanali ÷ 6 (÷ 5 per un'azienda).

**Destinatari** (`PayrollRecipient`, fino a 5): consulente, commercialista o altro. Ognuno ha:
- email e copia;
- il giorno del promemoria;
- il testo della mail;
- il proprio formato del file (`template`, vedi `lib/payroll/template.ts`).

Le opzioni del formato:
- **forma**: una riga per giorno, una per causale, una per persona, oppure il calendario del mese;
- **colonne**: in ordine, con le intestazioni libere e valori fissi;
- **causali**: un codice per ogni voce; un codice vuoto toglie la voce dal file;
- **tipo di file**: Excel o CSV, con separatore e codifica (UTF-8 con BOM, UTF-8, Windows);
- **formati**: date, decimali, ore a decimali o in hh:mm;
- **nome**: del file e del foglio.

Lo stesso codice scrive il file sul server e fa l'anteprima nel browser.

**Formato da un file del consulente** (`lib/payroll/template-ai.ts`, con `ANTHROPIC_API_KEY`): si carica un Excel o un CSV che il consulente usa già. Claude legge le prime righe e restituisce il modello, compilando uno schema JSON fisso. Il titolare lo vede nell'anteprima prima di salvare.

**Revisione** (dettaglio persona, `/dashboard/presenze/persona/[userId]`):
- i giorni strani sono segnati:
  - turno pubblicato senza timbratura;
  - più di 12 ore;
  - turno in un giorno di assenza;
- un giorno corretto (`PayrollDayOverride`) cambia solo il file, mentre timbrature e turni restano come sono;
- "Torna com'era" toglie la correzione.

**Invio**: la mail è già scritta e si può cambiare prima di mandarla. A seconda di dove si è:
- **nell'app**: si apre la mail del telefono con destinatari, oggetto, testo e allegato (`capacitor-email-composer`, serve la build nativa nuova). Le build vecchie, o un telefono senza un account di posta, passano dal menu Condividi;
- **dal computer**: il file si scarica e si apre il programma di posta (`mailto:`);
- **in alternativa**: "Invia da Workbit" (Resend), con risposte al titolare e titolare in copia.

Ogni invio resta in `PayrollSend`. Se dopo l'invio cambia una correzione, o un turno quando le ore vengono dai turni, la pagina chiede di rimandare.

**Promemoria** (`lib/payroll/reminders.ts`, nel passaggio dei cron): dal giorno scelto, dalle 9 ora italiana, una notifica al titolare per il mese prima. Arriva una volta per destinatario e mese, e non arriva se il mese è già partito.

## Costi e fornitori (`/dashboard/costi`)

Solo per il titolare. **Visibilità**:
- con `COSTS_ENABLED=1` su Railway la vedono tutti i titolari;
- senza, la vede solo il super admin, nei locali che possiede.

### Come entrano le fatture

1. **Zip dal cassetto fiscale.** Si scarica da Fatture e Corrispettivi → Consultazione → Fatture ricevute. Il lettore:
   - apre anche gli zip dentro lo zip;
   - legge i `.p7m` firmati e gli XML in UTF-8 o Latin-1;
   - salta i metadati e le ricevute dello SDI;
   - scarta gli allegati PDF.

   **Fatture escluse**: quelle emesse dal locale e quelle intestate a un'altra partita IVA. Il super admin può includerle con la casella di prova.

   **Doppioni**: la chiave è fornitore + numero + data + tipo, quindi ricaricare lo stesso mese non duplica niente.
2. **Ricezione automatica con Openapi.** Per attivarla:
   - il locale registra all'Agenzia delle Entrate il codice destinatario **USAL8PV**;
   - Workbit registra la sua partita IVA sul nostro account Openapi, con la callback `supplier-invoice` verso `/api/webhooks/openapi-invoices?key=OPENAPI_SDI_CALLBACK_KEY`.

   **Come arrivano**: le fatture si scaricano alla callback, e in più c'è un controllo durante il passaggio notturno (`runInboxSync`, al massimo ogni 6 ore). Resta spenta finché non c'è `COSTS_INBOX_ENABLED=1`: le ricezioni si pagano dal nostro credito Openapi.

### Categorie e prodotti

- **In ordine**: correzioni del titolare → categoria scelta per il fornitore → mappa condivisa già imparata (`SupplierProductMap`, scope "") → regole (`lib/costs/categories.ts`).
- **Con `ANTHROPIC_API_KEY`**: dopo ogni caricamento Claude rilegge le righe che le regole hanno solo indovinato (`classifyPendingLines`). Di ogni riga diverse ricava categoria, prodotto (chiave uguale tra fornitori) e unità base (€/l, €/kg, €/pz). Il risultato si impara una volta e vale per tutti i locali.
- **Senza la chiave**: restano le regole, e la ricerca online è spenta.

### Analisi (`lib/costs/analysis.ts`)

- **Totali**: per categoria e fornitore, confrontati con il mese prima e con la media degli ultimi tre.
- **Personale**: ore timbrate × costo orario della persona.
- **Incassi**: li scrive il titolare. Da qui il peso di merce e personale.
- **Prezzi per unità**: per prodotto e fornitore, con la variazione sugli ultimi 6 mesi.
- **Stesso prodotto da due fornitori a prezzi diversi.**
- **Luce**:
  - costo per kWh tutto compreso;
  - costo della sola parte energia, l'unica che cambia tra fornitori.
- **Dove risparmiare**:
  - "Dalle tue fatture": aumenti e fornitore più caro;
  - "da verificare": prezzi trovati online con link, e offerte luce.

  Ogni voce ha il suo valore stimato in euro all'anno, e compare solo se vale almeno 30 €.

### Prova del lettore

```
node --conditions=react-server --import tsx scripts/prova-fatture.mts fatture.zip
```

Fuori da Next il pacchetto `server-only` non esiste. Il comando qui sopra quindi parte solo dopo aver messo uno stub vuoto nel `NODE_PATH`.
