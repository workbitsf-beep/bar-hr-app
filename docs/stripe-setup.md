# Stripe: come preparare i prezzi

L'app trova i prezzi su Stripe per **codice** (la "lookup key"), non per id.
Basta crearli con i codici giusti: niente `price_…` da copiare su Railway.

Prima in **modalità test** (interruttore "Test mode" in alto su Stripe), poi
uguale in modalità reale.

## 1. Prodotti e prezzi

**Con lo script (consigliato):** crea tutti i prodotti e i prezzi qui sotto
dal catalogo dell'app, con i codici giusti. Si può rilanciare: quello che c'è
già resta com'è.

    STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe-catalog-setup.ts
    STRIPE_SECRET_KEY=sk_live_... npx tsx scripts/stripe-catalog-setup.ts --live

Fatto in modalità test il 15/10/2026. **A mano**, se serve:

Per ogni riga: *Prodotti → Aggiungi prodotto*, prezzo **ricorrente**, in EUR.
Ogni prodotto ha due prezzi, mensile e annuale. Nel prezzo apri
*Opzioni avanzate → Lookup key* e scrivi il codice esatto.

| Prodotto        | Mensile | Lookup key mensile        | Annuale | Lookup key annuale        |
|-----------------|--------:|---------------------------|--------:|---------------------------|
| Workbit Base    |  29,99 € | `workbit_base_monthly`     |  299 € | `workbit_base_yearly`      |
| Workbit Pro     |  59,99 € | `workbit_pro_monthly`      |  599 € | `workbit_pro_yearly`       |
| Reparti         |   7,99 € | `workbit_reparti_monthly`  |   79 € | `workbit_reparti_yearly`   |
| +5 persone      |   6,99 € | `workbit_persone5_monthly` |   69 € | `workbit_persone5_yearly`  |
| Il tuo stile    |   2,99 € | `workbit_stile_monthly`    |   29 € | `workbit_stile_yearly`     |
| Sede in più     |   7,99 € | `workbit_sede_monthly`     |   79 € | `workbit_sede_yearly`      |

- "+5 persone" e "Sede in più" si comprano a **quantità** (2 pacchetti, 3 sedi):
  il prezzo è per unità, la quantità la mette l'app.
- Se un codice manca, l'app non apre il pagamento e scrive nei log quale manca
  (`Su Stripe manca il prezzo con codice …`).
- I prezzi sono quelli del sito, senza IVA. Con il regime forfettario l'IVA
  non si applica: fallo confermare al commercialista prima dei pagamenti reali.

## 2. Webhook

*Sviluppatori → Webhook → Aggiungi endpoint*

- URL: `https://<dominio dell'app>/api/webhooks/stripe`
- Eventi:
  `checkout.session.completed`,
  `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.finalized`, `invoice.paid`, `invoice.payment_failed`,
  `invoice.voided`, `invoice.marked_uncollectible`

Copia il "Signing secret" (`whsec_…`).

## 3. Railway

Variabili del servizio:

- `STRIPE_SECRET_KEY` - la chiave segreta (`sk_test_…`, poi `sk_live_…`)
- `STRIPE_WEBHOOK_SECRET` - il `whsec_…` del punto 2
- `APP_URL` - l'indirizzo dell'app, senza `/` finale

`STRIPE_PRICE_MONTHLY` e `STRIPE_PRICE_YEARLY` non servono più.

## 4. Sconto stessa partita IVA

Nessuna configurazione: il coupon `workbit-stessa-piva-10` (10%, per sempre)
lo crea l'app la prima volta che serve. Vale dal secondo abbonamento con la
stessa partita IVA; il primo paga pieno. Uno sconto messo a mano dalla console
sul mensile ha la precedenza.

## 5. Prova in modalità test

1. Da web, come titolare: *Impostazioni → Abbonamento*, scegli piano ed extra,
   *Vai al pagamento*.
2. Carta di prova `4242 4242 4242 4242`, una data futura, CVC qualsiasi.
3. Tornato nell'app, il piano del locale deve essere quello comprato (lo
   vedi anche nella console, sezione Piano).
4. Cambia un extra da *Abbonamento → Aggiorna l'abbonamento*: su Stripe
   l'abbonamento cambia e la differenza va nella fattura dopo.
