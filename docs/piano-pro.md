# Piano Pro: resoconto e idee

Aggiornato al 7 ottobre 2026. Da riprendere domani, anche con il socio per i prezzi.

---

## 1. Cosa c'è già (online)

Il Pro si accende a mano dal super admin: **Console → locale → Piano → Passa a Pro / Torna al Base**. Un locale Base vede l'app esattamente come prima.

### Reparti
- **Banco** (blu), **Cucina** (arancio), **Sala** (verde) più **un reparto con il nome scelto dal titolare** (rosa), da Impostazioni → Reparti.
- Due modi, scelti dal titolare:
  - **Calendario unico**: schede Tutti / Banco / Cucina / Sala in cima al calendario.
  - **Calendari separati**: ognuno vede solo il suo reparto, con il nome del capo reparto in cima.
- Nei turni c'è un pallino con l'iniziale del reparto (B, C, S…).
- I turni senza reparto (quelli vecchi, o messi su "Tutti") prendono il reparto della persona.

### Persone (Personale)
- Ogni persona ha un **reparto principale**, più gli altri reparti in cui **dà una mano**. Il reparto non è obbligatorio.
- **Capo reparto**: gestisce i turni del suo reparto e vede solo quello. Note, richieste e pubblicazione della settimana restano al titolare e ai responsabili.

### Jolly
- Non è un reparto e non ha calendario né pagina: è un segno sul turno.
- Quando dai un turno scegli il reparto oppure **Jolly**; il turno Jolly compare in **tutti** i reparti con il pallino **J**.

### Inserimento turni
- Il flusso è identico a prima. La scelta del reparto compare solo su "Tutti"; dentro un reparto c'è solo "reparto / Jolly".

### Pagina Oggi (titolare)
- **Tessere per reparto**: un anello con quanti sono dentro su quanti in turno, ritardi, "nessuno oggi". Tocchi una tessera e la lista si filtra.
- **Barre della settimana** a colori sfumati per reparto (viola = senza reparto) e avviso dei **reparti scoperti** nei prossimi giorni.
- **Carrello diviso per reparto**.
- **Checklist di apertura e chiusura** di oggi.

### Pagina Oggi (dipendente)
- La settimana ha il pallino del reparto su ogni turno, più "Oggi lavori in…".

### Checklist apertura / chiusura
- Una per reparto e per momento, da Impostazioni → Apertura e chiusura, fino a 20 voci.
- Si azzerano ogni giorno e si vede chi l'ha completata e a che ora.

### Note, bacheca, corsi
- Le **note** mandate a un reparto stanno nella sua sezione della pagina Note e compaiono sul calendario di quel reparto e su Tutti.
- In bacheca e nei corsi il tasto **Reparto** seleziona con un tocco tutte le persone di quel reparto.
- I **documenti** restano solo per persone o per tutti.

---

## 2. Cose rimaste aperte

| Cosa | Stato |
|---|---|
| **Prezzi e limiti** | Non applicati: nessun limite di persone, il Pro si accende solo a mano. Da decidere con il socio (vedi sezione 4). |
| **Cambio piano in abbonamento** (Stripe, fuori dall'app) | Progettato, non scritto. Serve un prezzo Stripe per il Pro, mensile e annuale, e il piano del locale che cambia da solo quando il cliente paga il Pro. |
| **Capo reparto e turni Jolly** | Li vede nel suo reparto ma non può modificarli. Il tasto di modifica c'è comunque e dà errore: va nascosto. |
| **Checklist su computer** | La card c'è sul telefono, non ancora nella pagina Oggi da computer. |
| **Popup documenti su iPhone** | Su computer resta aperto. Su iPhone va verificato a quale passaggio si chiude. |

---

## 3. Idee per il Pro

In ordine di priorità: prima quello che dà più valore a un locale con i reparti, con meno lavoro.

### A. Subito, perché completano quello che c'è

**1. Capo reparto completo**
- Approva ferie, permessi e scambi del **suo** reparto; il titolare vede tutto e può sempre intervenire.
- Pubblica la settimana del suo reparto.
- Riceve lui gli avvisi di ritardo e di mancata timbratura del suo reparto.
- *Perché:* oggi il capo reparto fa i turni ma tutto il resto torna al titolare. È la promessa del Pro: "il titolare delega".
- *Lavoro:* medio.

**2. Fabbisogno per reparto (copertura)**
- Il titolare imposta quante persone servono per reparto e fascia, per esempio "Cucina: 2 a pranzo, 3 a cena; venerdì e sabato 4".
- Il calendario segna le fasce **scoperte** in rosso e quelle **piene** in verde. La pagina Oggi dice "Sabato cena: manca 1 in Sala".
- *Perché:* è il problema vero di chi fa i turni, e oggi l'avviso dei reparti scoperti è solo una stima.
- *Lavoro:* medio.

**3. Settimana tipo per reparto**
- Salvi la settimana di un reparto come modello e la ricopi con un tocco, scegliendo le persone.
- *Perché:* fa risparmiare molto tempo ogni settimana.
- *Lavoro:* basso-medio.

### B. Il passo dopo: numeri per reparto

**4. Report per reparto**
- Ore lavorate, straordinari e assenze divise per reparto, nel PDF che c'è già e a schermo.
- *Lavoro:* basso, perché i dati ci sono già.

**5. Costo del personale per reparto**
- Costo orario per persona, visibile solo al titolare. Ne esce il costo della settimana per reparto, con un tetto di spesa e l'avviso quando lo superi mentre fai i turni.
- *Perché:* è il numero che un titolare guarda davvero. Da solo vale il prezzo del Pro.
- *Lavoro:* medio. Il costo orario è un dato delicato e va mostrato solo al titolare.

**6. Registro delle checklist**
- Storico delle checklist completate (chi, quando, cosa mancava), scaricabile.
- Voci con un valore da scrivere, per esempio "temperatura frigo: __ °C".
- *Perché:* aiuta nei controlli del locale.
- *Attenzione:* senza presentarlo come "registro HACCP a norma" se non lo è.
- *Lavoro:* medio.

### C. Più avanti, per un piano più alto (Enterprise)

**7. Più locali nello stesso account**
- Un titolare con 2-3 locali vede tutto insieme: persone condivise tra locali, ore totali, una sola fattura.
- *Perché:* è ciò che dà all'Enterprise qualcosa di suo oltre al numero di persone.

**8. Corsi obbligatori per reparto**
- Un corso, per esempio HACCP per la Cucina, assegnato a tutto il reparto, con scadenza e avviso quando scade.

**9. Chiama un Jolly**
- Quando in un reparto manca qualcuno, un tocco manda la richiesta di reperibilità a chi può coprire (i Jolly o chi dà una mano in quel reparto).
- Usa le richieste di reperibilità che esistono già.

### Cosa eviterei
- **Chat interna**: la gente usa già WhatsApp, è tanto lavoro e porta pochi clienti.
- **Troppe impostazioni per reparto** (orari, regole, colori diversi): il bello del Pro è che resta la stessa app.

---

## 4. Prezzi: dove eravamo rimasti

Il Base resta a **29,99 €**. Le altre cifre sono proposte da decidere con il socio.

| | Base | Pro | Enterprise |
|---|---|---|---|
| Prezzo al mese | 29,99 € | 49,99 € | 69,99 € |
| Persone incluse | 12 | 20 | 50 |
| Pacchetti da +5 persone a 5 € | fino a 22 persone (max 39,99 €) | fino a 30 persone (max 59,99 €) | — |
| Reparti e capi reparto | — | ✓ | ✓ |

- Ogni gradino porta al successivo: un Base pieno costa 39,99 €, e con 10 € in più hai il Pro con i reparti. Un Pro pieno costa 59,99 €, e con 10 € in più hai l'Enterprise con 50 persone.
- **Da decidere:**
  1. Se un locale col Base tra 20 e 22 persone, che paga meno del Pro, va bene. Va bene se il Pro si vende per i reparti e non per le persone.
  2. Cosa dà l'Enterprise oltre alle persone. Proposta: più locali (idea 7) e costo del personale (idea 5).
- C'era anche una proposta precedente: Pro a 59,99 € con 25 persone.
- In ogni caso i piani si comprano **fuori dall'app** (Stripe). L'app mostra solo il piano attivo.

---

## 5. Proposta per domani

1. Decidere con il socio prezzi e limiti (sezione 4).
2. Fare il **capo reparto completo** (idea 1) e il **fabbisogno per reparto** (idea 2): sono le due cose che fanno sembrare il Pro "un'altra cosa".
3. Collegare il cambio piano a Stripe, così un cliente può passare al Pro da solo.
4. Sistemare le cose aperte della sezione 2.
