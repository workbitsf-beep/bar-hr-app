/**
 * Le regole del calendario che non disegnano niente.
 *
 * I due calendari - quello del titolare e quello del dipendente - sono lo
 * stesso file scritto due volte: diecimila righe in totale, di cui solo
 * duemila diverse. Ogni correzione va applicata due volte a mano, e il
 * 30 settembre 2026 e successo sei volte in una mattina.
 *
 * Questo file e il primo pezzo che smette di essere doppio: le tre funzioni
 * che decidono qualcosa senza disegnare nulla. Sono pure - stessi dati,
 * stessa risposta, nessun React - quindi si possono provare da sole, e i
 * test stanno in tests/calendar-rules.test.ts.
 *
 * I tipi qui sotto descrivono solo il minimo che serve, invece di importarli
 * dai calendari: cosi il modulo non dipende da loro, e sono loro a passare i
 * propri oggetti, che soddisfano questa forma.
 */

export type RuleAssignment = {
  id: string;
  firstName: string;
  lastName: string;
  isCurrentUser?: boolean;
};

export type RuleShift = {
  id: string;
  startTime: string;
  endTime: string;
  assignments: RuleAssignment[];
};

/** Due intervalli si toccano se ognuno inizia prima che l'altro finisca. */
export function hasTimeOverlap(
  rangeStart: string,
  rangeEnd: string,
  shiftStart: string,
  shiftEnd: string
) {
  return new Date(rangeStart) < new Date(shiftEnd) && new Date(rangeEnd) > new Date(shiftStart);
}

/**
 * Come si chiama una persona su una riga stretta.
 *
 * Chi guarda e sempre "Tu". Gli altri sono il solo nome, che basta quasi
 * sempre; diventa "Anna S." solo quando in quel locale c'e un'altra Anna,
 * altrimenti l'iniziale e rumore.
 */
export function shortNameFor(assignment: RuleAssignment, sharedFirstNames: Set<string>) {
  if (assignment.isCurrentUser) {
    return "Tu";
  }

  const first = assignment.firstName.trim();
  const initial = assignment.lastName.trim()[0];

  if (!first) {
    return assignment.lastName.trim() || "—";
  }

  return sharedFirstNames.has(first.toLowerCase()) && initial
    ? `${first} ${initial.toUpperCase()}.`
    : first;
}

/**
 * I nomi che in questo locale porta piu di una persona.
 *
 * Si guarda tutto il calendario, non il singolo giorno: se lunedi c'e Anna
 * Rossi e giovedi Anna Bianchi, lunedi deve gia dire "Anna R.", altrimenti
 * lo stesso nome vuol dire due persone diverse a seconda del giorno.
 */
export function collectSharedFirstNames(days: Array<{ shifts: RuleShift[] }>) {
  const seen = new Map<string, Set<string>>();

  for (const day of days) {
    for (const shift of day.shifts) {
      for (const assignment of shift.assignments) {
        const key = assignment.firstName.trim().toLowerCase();

        if (!key) {
          continue;
        }

        const owners = seen.get(key) ?? new Set<string>();
        owners.add(assignment.id);
        seen.set(key, owners);
      }
    }
  }

  return new Set(
    Array.from(seen.entries())
      .filter(([, owners]) => owners.size > 1)
      .map(([key]) => key)
  );
}

/**
 * Chi e in due posti nello stesso momento.
 *
 * Restituisce quali turni sono in conflitto, per poterli segnare, e una frase
 * da mostrare. Guarda solo le persone: due turni che si accavallano ma con
 * gente diversa non sono un problema, sono un locale pieno.
 */
export function buildShiftOverlaps(shifts: RuleShift[]) {
  const clashing = new Set<string>();
  const byPerson = new Map<string, { name: string; shiftIds: Set<string> }>();

  for (let index = 0; index < shifts.length; index += 1) {
    for (let other = index + 1; other < shifts.length; other += 1) {
      const left = shifts[index];
      const right = shifts[other];

      if (!hasTimeOverlap(left.startTime, left.endTime, right.startTime, right.endTime)) {
        continue;
      }

      for (const assignment of left.assignments) {
        if (!right.assignments.some((entry) => entry.id === assignment.id)) {
          continue;
        }

        clashing.add(left.id);
        clashing.add(right.id);

        const person = byPerson.get(assignment.id) ?? {
          name: `${assignment.firstName} ${assignment.lastName}`.trim(),
          shiftIds: new Set<string>(),
        };
        person.shiftIds.add(left.id);
        person.shiftIds.add(right.id);
        byPerson.set(assignment.id, person);
      }
    }
  }

  const people = Array.from(byPerson.values());
  const message =
    people.length === 0
      ? null
      : people.length === 1
        ? `${people[0].name} è in ${people[0].shiftIds.size} turni che si accavallano`
        : `${people.map((person) => person.name).join(", ")} hanno turni che si accavallano`;

  return { clashing, message };
}
