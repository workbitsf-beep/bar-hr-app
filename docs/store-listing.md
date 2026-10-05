# Schede App Store e Google Play — bozze

Testi pronti da incollare in App Store Connect e Play Console. Dove c'è **[da confermare]**
serve una decisione tua o del consulente privacy prima dell'invio.

## Identità

| Campo | Valore |
|---|---|
| Nome | Workbit |
| ID app (iOS e Android) | `it.workbit.app` — definitivo, non si cambia più |
| Sottotitolo Apple (max 30) | Turni e presenze del locale |
| Descrizione breve Google (max 80) | Turni, timbrature con GPS, ferie e report del mese per bar e ristoranti. |
| Categoria principale | Business (Apple) / Business (Google) |
| Categoria secondaria | Produttività |
| Classificazione età | 4+ (Apple) / PEGI 3 (Google): nessun contenuto sensibile |
| URL supporto | https://app.workbit.it/support |
| URL privacy | https://app.workbit.it/privacy |
| URL eliminazione account | https://app.workbit.it/account-deletion |
| Parole chiave Apple (max 100) | turni,presenze,timbratura,ferie,ristorante,bar,personale,haccp,calendario,report |

## Descrizione lunga (max 4000)

Workbit è l'app per gestire il personale di bar, ristoranti e locali, pensata per chi lavora
in sala e non davanti a un computer.

**Turni.** Il titolare prepara la settimana in pochi tocchi, con i turni di pranzo e cena già
impostati, e la pubblica: ognuno vede subito i propri turni sul telefono.

**Timbrature.** Entrata e uscita si registrano dal telefono, solo quando si è davvero nel
locale: la posizione viene verificata al momento della timbratura e non viene seguita in
nessun altro momento.

**Ferie, permessi e cambi turno.** Le richieste arrivano al titolare o al responsabile, che
risponde con un tocco. Chi ha chiesto riceve la risposta in notifica.

**Il mese in un PDF.** A fine mese il report di ogni persona o di tutto il team è pronto:
ore lavorate, arrotondamenti, ferie, permessi, straordinari, corsi e reperibilità.

**Il locale in ordine.** Bacheca con conferma di lettura, attività ricorrenti, lista della
spesa, corsi con scadenza (HACCP, antincendio, primo soccorso) e documenti di ogni persona,
visibili solo a chi deve vederli.

**Accesso sicuro.** Sblocco con Face ID o impronta tramite passkey, e ruoli separati per
titolare, responsabile, amministrazione e dipendenti.

Workbit è un servizio in abbonamento per le attività: l'account del locale si attiva dal sito,
e il titolare invita le persone del suo team.

## Note per i revisori

### Apple (App Review Information → Notes)

> Workbit is a workforce management service sold to businesses (bars and restaurants) for
> their employees, under guideline 3.1.3(c) Enterprise Services. The app contains no purchase:
> the business subscribes on the web, and employees are invited by their employer.
>
> Two demo accounts on a demo venue:
> - Owner: `revisione.titolare@workbit.it` / **[password dallo script]** — schedules shifts,
>   approves requests, downloads the monthly PDF report.
> - Employee: `revisione.dipendente@workbit.it` / **[password dallo script]** — sees shifts,
>   clocks in and out, sends requests.
>
> Clock-in checks that the employee is at the venue. For review, the demo venue accepts
> clock-ins from anywhere, and the employee has a shift every day so clock-in is always
> available. Location is read only at the moment of clocking in.
>
> Account deletion: Settings → "Elimina il mio account" (employee) or "Elimina locale e
> account" (owner).

### Google (App content → App access)

Stesse due credenziali, con la stessa spiegazione in italiano o inglese.

## Etichette privacy Apple (App Privacy)

Tracciamento: **No** (nessun dato usato per pubblicità o ceduto a terzi, nessun SDK di
analisi o pubblicità).

| Tipo di dato | Raccolto | Collegato alla persona | Scopo |
|---|---|---|---|
| Nome | Sì | Sì | Funzionalità dell'app |
| Indirizzo email | Sì | Sì | Funzionalità dell'app |
| Numero di telefono | Solo del locale, se il titolare lo inserisce | No | Funzionalità dell'app |
| Posizione precisa | Sì, solo al momento della timbratura | Sì | Funzionalità dell'app |
| Foto o video | Sì, se allegati a un documento | Sì | Funzionalità dell'app |
| Altri contenuti dell'utente | Sì (note, richieste, documenti) | Sì | Funzionalità dell'app |
| ID utente | Sì | Sì | Funzionalità dell'app |
| Informazioni sanitarie | **[da confermare]** — la richiesta di malattia può contenere il numero del certificato | Sì | Funzionalità dell'app |
| Dati di pagamento | No: li raccoglie Stripe, sul sito | — | — |
| Diagnostica | No | — | — |

## Sicurezza dei dati Google (Data safety)

- **Raccolta:** posizione precisa, nome, email, ID utente, file e documenti, foto, altri
  contenuti generati dall'utente; **[da confermare]** informazioni sanitarie (come sopra).
- **Condivisione con terzi:** nessuna. Hosting e invio di email e notifiche sono fornitori che
  trattano i dati per conto di Workbit, e per Google non contano come condivisione.
- **Cifratura in transito:** sì (solo HTTPS).
- **Eliminazione:** sì, dall'app e dalla pagina https://app.workbit.it/account-deletion.
- **Obbligatorietà:** posizione obbligatoria per timbrare; il resto è necessario al
  funzionamento del servizio.

## Screenshot

Da fare sul locale demo, dopo averlo creato, nelle dimensioni richieste:

- **Apple:** iPhone 6,9" (1320 × 2868). Facoltativo l'iPad: l'app è pensata per il
  telefono e conviene dichiararla solo iPhone.
- **Google:** almeno 2 screenshot del telefono (es. 1080 × 2400) e la grafica in evidenza
  1024 × 500.

Schermate consigliate, in quest'ordine:
1. Home del dipendente: turno di oggi, pulsante di timbratura, ore del mese.
2. Calendario della settimana del titolare.
3. Richiesta di ferie e risposta del titolare.
4. Report del mese (PDF).
5. Bacheca con conferma di lettura.
6. Corsi con scadenza.
