# iPhone su TestFlight, senza Mac

L'app iPhone si compila, si firma e si carica su TestFlight dalle macchine macOS di GitHub
(`.github/workflows/ios-testflight.yml`). Serve solo l'account Apple Developer.

## Una volta sola

1. **Account Apple Developer** (da persona, 99 $/anno): app "Apple Developer" sull'iPhone o
   developer.apple.com. Attivazione da qualche ora a 2 giorni.
2. **Team ID**: developer.apple.com › Account › Membership details. 10 caratteri.
3. **L'app in App Store Connect**: appstoreconnect.apple.com › App › "+" › Nuova app.
   - Piattaforma iOS, nome **Workbit**, lingua Italiano.
   - Bundle ID **it.workbit.app**: se non è nell'elenco, crealo prima in developer.apple.com ›
     Identifiers, con le capability **Push Notifications** e **Associated Domains**.
   - SKU: `workbit-ios`.
4. **Chiave API** (serve a GitHub per firmare e caricare): App Store Connect › Utenti e accesso ›
   Integrazioni › App Store Connect API › "+", ruolo **Admin**. Scarica il file `.p8`
   (si scarica una volta sola) e annota **Key ID** e **Issuer ID**.
5. **Segreti su GitHub**: repository bar-hr-app › Settings › Secrets and variables › Actions ›
   New repository secret:
   - `APPLE_TEAM_ID`
   - `ASC_KEY_ID`
   - `ASC_ISSUER_ID`
   - `ASC_KEY_P8`: tutto il testo del file `.p8`, righe BEGIN ed END comprese.

6. **Certificato e profilo di distribuzione** (una volta l'anno): con il file `.p8` sul PC,

       ASC_KEY_ID=... ASC_ISSUER_ID=... ASC_KEY_FILE=AuthKey_....p8 OUT_DIR=cartella          npx tsx scripts/ios-signing-setup.ts

   crea su Apple il certificato e il profilo "Workbit App Store" e li scrive in `OUT_DIR`;
   vanno nei segreti `IOS_DIST_P12` (base64), `IOS_DIST_P12_PASSWORD` e `IOS_PROFILE` (base64).
   Su Windows, se openssl cerca un `openssl.cnf` che non c'è, aggiungi `OPENSSL_CONF=` a un file vuoto.
   Fatto il 15/10/2026, scade il 15/10/2027.

   La firma "gestita da Apple" sulle macchine di GitHub non accetta la chiave API
   ("No Accounts with App Store Connect Access"): per questo il certificato è nostro.

### Notifiche push su iPhone (facoltativo, ma da fare prima del lancio)

7. **Firebase** (stesso progetto di Android) › Impostazioni progetto › Aggiungi app › iOS,
   bundle ID `it.workbit.app`. Scarica `GoogleService-Info.plist` e mettine tutto il testo nel
   segreto `GOOGLE_SERVICE_INFO_PLIST`.
8. **Chiave APNs**: developer.apple.com › Keys › "+" › Apple Push Notifications service.
   Scarica il `.p8` e caricalo in Firebase › Impostazioni progetto › Cloud Messaging ›
   App Apple › Chiave di autenticazione APNs (con Key ID e Team ID).

Senza i punti 7 e 8 l'app funziona, ma su iPhone le notifiche non arrivano.

## Ogni volta che vuoi una build

GitHub › repository bar-hr-app › **Actions** › **App iOS · TestFlight** › **Run workflow**.
Dura circa 15-20 minuti; poi la build compare in App Store Connect › TestFlight dopo 10-30
minuti di elaborazione Apple. Il numero di build sale da solo.

Il contenuto dell'app arriva dal sito (app.workbit.it): una nuova build serve solo quando
cambia la parte nativa (plugin, icona, permessi), non per ogni modifica.

## Tester

- **Interni** (fino a 100, subito, senza revisione): App Store Connect › Utenti e accesso,
  invitali, poi TestFlight › Test interni.
- **Esterni** (fino a 10.000, con un link pubblico): TestFlight › Test esterni. La prima build
  passa una revisione leggera di Apple (di solito un giorno).

I tester installano l'app **TestFlight** dall'App Store e aprono l'invito.
