# Fatture elettroniche: invio automatico allo SDI (Openapi)

Ogni pagamento Stripe diventa una FatturaPA (regime forfettario, numerata 2026/1, 2026/2…).
Con Openapi collegato la fattura parte da sola verso lo SDI appena è pronta, e lo stato si
aggiorna quando lo SDI risponde. Senza Openapi resta tutto come prima: in console
(Denaro › Fatture) si scarica l'XML, si carica su Fatture e Corrispettivi e si segna "inviata".

## Come funziona

- Pagamento → fattura pronta (`READY`) → **inviata** a Openapi (`SENT`).
- Lo SDI risponde e Openapi chiama `https://app.workbit.it/api/webhooks/openapi-sdi?key=…`:
  - **RC** consegnata → `Consegnata`;
  - **MC** non recapitata → `Consegnata` con la nota "la trova nel cassetto fiscale" (è comunque emessa);
  - **NS** scartata → `Scartata` con il motivo dello SDI.
- Lo stato viene sempre riletto da Openapi, non preso dal messaggio: un messaggio falso non cambia nulla.
- Ogni notte il lavoro programmato manda le fatture rimaste pronte e chiede lo stato di quelle
  in attesa da più di un'ora (se un messaggio di Openapi si è perso).
- **Scartata**: si correggono i dati (di solito quelli del cliente) e in console si preme
  "Invia di nuovo": la fattura viene riscritta con i dati attuali, **stesso numero e stessa data**,
  nome file nuovo.

## Da fare una volta (dopo la partita IVA)

1. Account su **console.openapi.com**, attiva il servizio **SDI** (Fatturazione elettronica) e
   ricarica qualche euro (0,07 € a fattura inviata, meno con abbonamento).
2. Crea il **token** per le API SDI (prima quello di **Sandbox** per la prova).
3. Su **Railway**, servizio dell'app, variabili:
   - `OPENAPI_SDI_TOKEN` = il token
   - `OPENAPI_SDI_SANDBOX` = `1` per la prova, da togliere per il reale
   - `OPENAPI_SDI_CALLBACK_KEY` = una chiave lunga a caso (la stessa del punto 4)
4. Dal PC, registra Workbit come mittente e collega le risposte dello SDI:

       OPENAPI_SDI_TOKEN=… OPENAPI_SDI_SANDBOX=1 OPENAPI_SDI_CALLBACK_KEY=… \
         npx tsx scripts/openapi-sdi-setup.ts configura <partita IVA> "<nome>" <email>

5. Prova in sandbox (manda una fattura finta e chiede la ricevuta di consegna):

       OPENAPI_SDI_TOKEN=… OPENAPI_SDI_SANDBOX=1 npx tsx scripts/openapi-sdi-setup.ts prova <partita IVA>

6. Passaggio al reale: token di produzione, togli `OPENAPI_SDI_SANDBOX`, rilancia il punto 4
   senza `OPENAPI_SDI_SANDBOX`.

La console (Denaro › Fatture) dice sempre in che modo è: manuale, prova (sandbox) o automatico.

## File

- `lib/invoicing/openapi-sdi.ts`: chiamate a Openapi.
- `lib/invoicing/send.ts`: invio, stato dalle risposte dello SDI, passata notturna.
- `app/api/webhooks/openapi-sdi/route.ts`: dove Openapi manda le risposte.
- `scripts/openapi-sdi-setup.ts`: configurazione e prova.
- Provato in locale contro un finto Openapi (invio, RC, NS con motivo, nuovo invio, chiave errata
  rifiutata) il 15/10/2026; manca la prova sulla sandbox vera, che richiede l'account.
