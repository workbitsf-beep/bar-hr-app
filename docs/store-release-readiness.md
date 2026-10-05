# Preparazione App Store e Google Play

## Pronto nel progetto web

- PWA standalone con manifest, icone 192/512 e icona maskable.
- Icona originale Workbit 1024x1024 pronta come sorgente store.
- Service worker unico con cache statica e Firebase Messaging.
- URL pubblici: `/privacy`, `/terms`, `/support`, `/account-deletion`.
- Robots e sitemap senza indicizzazione di dashboard e API.
- Supporto safe-area iOS, viewport dinamica e accesso biometrico WebAuthn.
- Verifica locale/CI con `npm run check:store`.

## Dati da definire prima del packaging nativo

- Bundle ID definitivo iOS e Application ID Android, ad esempio `it.workbit.app`.
- Nome account Apple Developer e Google Play Console.
- Team ID Apple, certificati, provisioning profile e chiave Play App Signing.
- `APP_URL` HTTPS definitivo e `SUPPORT_EMAIL` pubblico su Railway.
- URL Firebase associati ai bundle nativi e file APNs/Google Services.

## Firma Android e passkey native

L'app Android è firmata con la chiave di upload custodita nei segreti GitHub
(`WORKBIT_KEYSTORE_BASE64`, `WORKBIT_KEYSTORE_PASSWORD`). L'impronta SHA-256 di quel
certificato è dichiarata in `public/.well-known/assetlinks.json`: è ciò che autorizza
l'app a usare le passkey registrate sul dominio, e va servita dallo stesso host indicato
da `WEBAUTHN_RP_ID` senza redirect (vedi l'esclusione in `proxy.ts`).

Quando il pacchetto verrà caricato su Google Play con Play App Signing attivo, Play
rifirmerà l'app con una propria chiave: la relativa impronta va **aggiunta** all'elenco
`sha256_cert_fingerprints`, senza rimuovere quella di upload.

Attenzione al ritardo: la verifica del collegamento non la fa l'app ma Google Play
Services, che tiene il risultato in cache per circa 40 minuti. Dopo ogni modifica al
file o al dominio delle passkey, l'app continua a rispondere `RP ID cannot be
validated` finché quella copia non scade. Si forza svuotando la cache di Google Play
Services sul dispositivo, altrimenti basta aspettare. Lo stato reale si controlla così,
senza telefono:

```bash
curl "https://digitalassetlinks.googleapis.com/v1/assetlinks:check?source.web.site=https://app.workbit.it&relation=delegate_permission/common.get_login_creds&target.android_app.package_name=it.workbit.app&target.android_app.certificate.sha256_fingerprint=<IMPRONTA>"
```

## iOS: cosa c'è e cosa manca

Il progetto iOS esiste (`ios/`) e viene compilato a ogni modifica da
`.github/workflows/ios.yml`, sulle macchine macOS di GitHub: serve a sapere che compila,
senza possedere un Mac. La compilazione è **non firmata e per simulatore**.

Serve un account Apple Developer (quindi D-U-N-S, quindi P.IVA) per:

- firmare e installare su un iPhone reale o su TestFlight;
- l'entitlement `aps-environment`, senza cui le notifiche push non arrivano;
- il Team ID, che va nel file `apple-app-site-association` da pubblicare su
  `https://app.workbit.it/.well-known/apple-app-site-association` — è l'equivalente di
  `assetlinks.json` e senza di esso le passkey su iOS non funzionano. Il file va servito
  con `Content-Type: application/json`, senza estensione e senza redirect.

Quello che iOS **non** richiede, a differenza di Android: le barre di sistema sono già
gestite, perché WKWebView riporta correttamente `env(safe-area-inset-*)` e il CSS
esistente lo usa già.

## Pagamenti nell'app installata

Decisione presa (ottobre 2026): nell'app installata non si vende nulla. Workbit è un servizio
venduto alle attività per il loro personale (Apple 3.1.3(c), Enterprise Services), quindi non
serve l'acquisto in-app purché l'app non mostri acquisti. All'avvio nell'app nativa la pagina
viene marcata `data-native` (script in testa a `app/layout.tsx`, più il cookie `wb-native`) e
tutto ciò che ha la classe `wb-web-only` sparisce: checkout, disdetta, inviti a rinnovare. Al
loro posto un testo neutro senza link né prezzo (`wb-native-only`). Sul sito non cambia nulla.
La registrazione di un nuovo locale, che mostra il prezzo, è raggiungibile solo dal sito.

## Notifiche

Su Android e iOS le notifiche passano dal plugin `@capacitor-firebase/messaging`, che dà un
token Firebase su entrambi. Le app Android installate prima del cambio continuano a usare il
vecchio plugin finché non vengono aggiornate (`lib/native-push.ts`). Per iOS mancano, e
richiedono gli account: `GoogleService-Info.plist` dell'app iOS registrata su Firebase in
`ios/App/App/`, la chiave APNs caricata su Firebase, la capability Push Notifications in Xcode.
Senza il plist il plugin non si avvia ma l'app non va in crash.

## Locale demo per i revisori

`node scripts/create-review-demo.js --confirm` crea sul database indicato da `DATABASE_URL` il
locale "Bar Aurora (demo)" con un titolare e un dipendente, e stampa le password. Raggio GPS
planetario e un turno di 24 ore ogni giorno per tre mesi, perché i revisori non sono a
Milano. `--remove` lo toglie. Testi delle schede e note per i revisori in
`docs/store-listing.md`.

## Blocco release

Eseguire in ambiente release:

```bash
STORE_RELEASE_CHECK_STRICT=1 npm run check:store
npm run lint
npm run build
```

Poi testare su dispositivi reali: notifiche push, GPS, passkey, caricamento documenti, download PDF,
eliminazione account, acquisto/rinnovo e ripristino sessione.
