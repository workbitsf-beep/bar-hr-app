# Piani Workbit

Approvati l'8 ottobre 2026. Prezzi senza IVA, regime forfettario. I prezzi annuali valgono circa dieci mesi.

## I piani

| | Al mese | All'anno | Persone |
|---|---|---|---|
| **Base** | 29,99 € | 299 € | fino a 12, titolare compreso |
| **Pro**, tutto incluso | 59,99 € | 599 € | senza limite, per un locale |

## Gli extra del Base

Si sommano allo stesso abbonamento: il cliente paga una volta sola.

| Extra | Al mese | All'anno | Cosa fa |
|---|---|---|---|
| **Reparti** | 7,99 € | 79 € | Banco, cucina, sala e un reparto con il nome scelto dal titolare. Jolly, capi reparto, checklist, note e carrello per reparto. |
| **+5 persone** | 6,99 € l'uno | 69 € | Massimo 2 pacchetti: da 12 a 22 persone. |
| **Il tuo stile** | 2,99 € | 29 € | Logo del locale nell'intestazione e font dell'insegna, scelto tra 8. |

Il Pro comprende reparti, stile e persone senza limite.

## Quale fa per chi

| Locale | Piano | Al mese |
|---|---|---|
| Bar con 8 persone | Base | 29,99 € |
| Pizzeria con forno e sala, 6 persone | Base + Reparti | 37,98 € |
| Bar con 18 persone, tutti insieme | Base + 2 pacchetti | 43,97 € |
| Ristorante con 20 persone, reparti e logo | Base + Reparti + 2 pacchetti + Stile | 54,95 € |
| Ristorante con 30 persone | Pro | 59,99 € |

Il Base con tutti gli extra arriva a 54,95 €, quindi a chi è grande conviene il Pro. Oltre 22 persone il Pro è l'unica scelta.

## Cosa c'è già nell'app

- **Console super admin**, scheda del locale → *Piano*: si sceglie Base o Pro, si accendono Reparti e Stile e si scelgono i pacchetti (0, 1 o 2).
- **Limite di persone**: quando il locale è pieno, *Personale → +* spiega come aggiungere persone invece di mostrare il modulo. Il controllo vale anche sul server.
- **Impostazioni → Il tuo piano** (solo il titolare): il piano attivo, le persone sul totale e a cosa serve ogni extra. Non ci sono prezzi né tasti per comprare, per le regole degli store.
- **Impostazioni → Stile del locale** (con Stile o Pro): si carica il logo, che viene ritagliato quadrato, e si sceglie il font dell'insegna con l'anteprima del nome del locale.
- **Sito, pagina /prezzi**: piani, extra, esempi e domande frequenti aggiornati.

## Da fare

1. **Stripe**: creare i prezzi del Pro e degli extra, mensili e annuali, come righe di un unico abbonamento. Poi collegarli al checkout e al webhook, così piano ed extra si accendono da soli quando il cliente paga. Fino ad allora li accende il super admin dalla console.
2. **Ricavo mensile nella console**: oggi conta solo il Base, va aggiunto quanto rendono gli extra.
3. **Logo nel report PDF del mese.**
