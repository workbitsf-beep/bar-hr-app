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

## Decisione obbligatoria sui pagamenti

Workbit vende un servizio SaaS B2B per attività. Prima della submission va verificato con gli
account store se il checkout Stripe può essere mostrato nel wrapper nativo o deve essere gestito
solo sul web. Non va aggiunto un wrapper Capacitor prima di questa decisione: una semplice WebView
remota può essere respinta e un checkout esterno non conforme può bloccare la review.

## Blocco release

Eseguire in ambiente release:

```bash
STORE_RELEASE_CHECK_STRICT=1 npm run check:store
npm run lint
npm run build
```

Poi testare su dispositivi reali: notifiche push, GPS, passkey, caricamento documenti, download PDF,
eliminazione account, acquisto/rinnovo e ripristino sessione.
