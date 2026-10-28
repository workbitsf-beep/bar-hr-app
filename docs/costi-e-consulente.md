# Costi e fornitori · Presenze per il consulente

## Presenze per il consulente (`/dashboard/consulente`)

Per il titolare e per chi ha il permesso "report". Per ogni persona e ogni giorno del mese:
- ore ordinarie e straordinari;
- ferie, permessi e malattia;
- festività, chiusure e formazione.

Ogni voce porta il codice che usa il programma paghe del consulente.

- **File**:
  - un Excel con tre fogli: Riepilogo, Foglio presenze e Tracciato;
  - un CSV con le righe del tracciato (`;`, decimali con la virgola, date gg/mm/aaaa).

  Si scaricano o partono per email al consulente. La risposta del consulente arriva al titolare.
- **Codici**: ORD, STR, FER, PER, MAL, CHI, FES e FOR di partenza. Si cambiano dalla pagina.
- **Matricola o codice fiscale**: si scrive persona per persona nella stessa pagina (`EmployeeBar.payrollCode`).
- **Ore settimanali del contratto** (`EmployeeBar.contractWeeklyHours`):
  - le ore oltre il contratto della settimana (da lunedì a domenica) diventano straordinario;
  - un giorno di ferie o malattia vale ore settimanali ÷ 6 (÷ 5 per un'azienda).

  Senza queste ore va tutto in ordinarie e il riepilogo lo segnala.
- **Ore lavorate**: sono quelle arrotondate del report del mese (`buildMonthlyDataset`), con le stesse regole del PDF.

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
