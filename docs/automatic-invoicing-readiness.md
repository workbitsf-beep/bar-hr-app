# Fatturazione automatica: base predisposta

Workbit continua a usare Stripe per gli abbonamenti. Questa preparazione non emette fatture
fiscali e non modifica checkout, rinnovi o accesso alle attività.

## Disponibile ora

- `BillingProfile`: anagrafica fiscale separata per ogni attività.
- `Invoice`: archivio idempotente dei documenti Stripe, importi, stato, periodo e link PDF.
- Sincronizzazione webhook per fatture finalizzate, pagate, fallite, annullate o inesigibili.
- `FiscalInvoiceProvider`: contratto neutro per collegare in futuro un provider SDI.
- Ogni attività mantiene fatturazione e abbonamento indipendenti anche con lo stesso titolare.

## Da decidere prima dell’attivazione fiscale

1. Provider SDI: Fatture in Cloud, Aruba, TeamSystem o altro.
2. Dati dell’emittente Workbit, regime fiscale, aliquote e natura IVA.
3. Numerazione, note di credito, conservazione sostitutiva e gestione degli scarti SDI.
4. Momento di emissione: `invoice.paid`, pagamento SEPA confermato o altra regola contabile.
5. Validazione obbligatoria di Partita IVA, codice fiscale, PEC/codice destinatario.

`invoicingEnabled` resta disattivato per impostazione predefinita: nessun documento fiscale viene
emesso finché non sarà configurato esplicitamente un provider.
