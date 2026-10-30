/** The email a client gets, once a super admin has decided the alert is real. */
export function clientNoticeText(kind: string) {
  if (kind.startsWith("failed:")) {
    return {
      subject: "Workbit: tentativi di accesso al tuo account",
      body: "Abbiamo visto diversi tentativi di accesso sbagliati al tuo account Workbit in poco tempo. Se non eri tu, non serve fare altro: l'accesso è stato bloccato per qualche minuto. Per stare tranquillo cambia la password da Impostazioni › Accesso e attiva l'accesso con Face ID o impronta.\nSe hai dubbi rispondi a questa email.",
    };
  }
  if (kind.startsWith("temporary:") || kind.startsWith("admin-device:")) {
    return {
      subject: "Workbit: nuovo accesso al tuo account",
      body: "Il tuo account Workbit è stato usato da un dispositivo che non avevamo mai visto. Se eri tu, ignora questa email. Se non eri tu, cambia subito la password da Impostazioni › Accesso e chiudi le altre sessioni: ti aiutiamo noi, basta rispondere.",
    };
  }
  if (kind.startsWith("zip:")) {
    return {
      subject: "Workbit: molti scaricamenti delle tue fatture",
      body: "Il commercialista che ha accesso alle tue fatture ne ha scaricate molte in poco tempo. Di solito è normale a fine mese; se non ti torna, puoi togliergli l'accesso da Costi › Commercialista.",
    };
  }
  return {
    subject: "Workbit: un avviso sul tuo account",
    body: "Abbiamo notato un'attività insolita sul tuo account Workbit. Se hai dubbi rispondi a questa email e ti aiutiamo.",
  };
}
