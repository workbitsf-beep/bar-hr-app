/**
 * La partita IVA italiana: undici cifre, l'ultima di controllo.
 *
 * Il controllo scarta i numeri inventati o scritti male (11111111111,
 * 12345678901): non dice che l'attivita esiste, ma un numero che lo passa e
 * un numero che qualcuno ha davvero. Il VIES europeo non si usa come filtro
 * perche molte partite IVA italiane in regola - le forfettarie, per esempio -
 * non ci sono iscritte, e verrebbero respinte.
 */

/** "IT 01234567890" -> "01234567890"; null if it is not eleven digits. */
export function normalizeItalianVat(value: unknown) {
  const digits = String(value ?? "")
    .toUpperCase()
    .replace(/^IT/, "")
    .replace(/[\s.\-]/g, "");

  return /^\d{11}$/.test(digits) ? digits : null;
}

export function isValidItalianVat(digits: string) {
  if (!/^\d{11}$/.test(digits) || /^0{7}/.test(digits) || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  let sum = 0;

  for (let index = 0; index < 10; index += 1) {
    const digit = Number(digits[index]);

    if (index % 2 === 0) {
      sum += digit;
    } else {
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }

  return (10 - (sum % 10)) % 10 === Number(digits[10]);
}
