"use client";

import { useState } from "react";
import { ConsoleButton, ConsoleForm } from "../console-form";
import { Field, FieldGrid } from "../console-ui";
import { deleteLedgerEntryAction, saveLedgerEntryAction } from "./ledger-actions";

export type LedgerFormEntry = {
  id: string;
  kind: "COST" | "EXPENSE" | "DEBT" | "INCOME";
  name: string;
  note: string | null;
  amount: string;
  period: "MONTHLY" | "YEARLY" | "ONCE";
  startsOn: string;
  endsOn: string;
  installment: string;
  dueOn: string;
};

const KINDS = [
  { value: "COST", label: "Costo fisso", lead: "Si ripete: server, commercialista" },
  { value: "EXPENSE", label: "Spesa", lead: "Una volta, in un giorno" },
  { value: "DEBT", label: "Debito", lead: "Prestito a rate o fattura da saldare" },
  { value: "INCOME", label: "Entrata", lead: "Fuori dagli abbonamenti" },
] as const;

/** Add or change one entry; the fields follow the kind. */
export function LedgerEntryForm({ entry, todayKey }: { entry?: LedgerFormEntry; todayKey: string }) {
  const [kind, setKind] = useState<LedgerFormEntry["kind"]>(entry?.kind ?? "COST");
  const running = kind === "COST" || kind === "INCOME";

  return (
    <ConsoleForm
      action={saveLedgerEntryAction}
      label={entry ? "Salva" : "Aggiungi"}
      pendingLabel="Salvo…"
      resetOnSuccess={!entry}
      style={{ gap: 14 }}
    >
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
      <input type="hidden" name="kind" value={kind} />
      {entry ? null : (
        <div className="wbc-choice" role="radiogroup" aria-label="Che voce è">
          {KINDS.map((option) => (
            <label key={option.value}>
              <input
                type="radio"
                name="kindPick"
                value={option.value}
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
              />
              <strong>{option.label}</strong>
              <span>{option.lead}</span>
            </label>
          ))}
        </div>
      )}
      <FieldGrid>
        <Field label="Nome" span>
          <input name="name" defaultValue={entry?.name ?? ""} required maxLength={80} placeholder={kind === "DEBT" ? "es. Prestito avvio" : "es. Railway"} />
        </Field>
        <Field label={kind === "DEBT" ? "Totale dovuto (€)" : "Importo (€)"}>
          <input name="amount" inputMode="decimal" defaultValue={entry?.amount ?? ""} required placeholder="es. 20 o 1.250,50" />
        </Field>
        {running ? (
          <Field label="Ogni">
            <select name="period" defaultValue={entry?.period ?? "MONTHLY"}>
              <option value="MONTHLY">mese</option>
              <option value="YEARLY">anno</option>
              <option value="ONCE">una volta sola</option>
            </select>
          </Field>
        ) : null}
        <Field label={kind === "EXPENSE" ? "Data" : kind === "DEBT" ? "Dal" : "Da quando"}>
          <input name="startsOn" type="date" defaultValue={entry?.startsOn ?? todayKey} required />
        </Field>
        {running ? (
          <Field label="Fino a" hint="Vuoto se continua">
            <input name="endsOn" type="date" defaultValue={entry?.endsOn ?? ""} />
          </Field>
        ) : null}
        {kind === "DEBT" ? (
          <>
            <Field label="Rata al mese (€)" hint="Per un prestito">
              <input name="installment" inputMode="decimal" defaultValue={entry?.installment ?? ""} placeholder="es. 200" />
            </Field>
            <Field label="Scadenza" hint="Per una fattura da saldare">
              <input name="dueOn" type="date" defaultValue={entry?.dueOn ?? ""} />
            </Field>
          </>
        ) : null}
        <Field label="Nota" span>
          <input name="note" defaultValue={entry?.note ?? ""} maxLength={200} placeholder="facoltativa" />
        </Field>
      </FieldGrid>
      {entry ? (
        <ConsoleButton
          action={deleteLedgerEntryAction}
          fields={{ id: entry.id }}
          label="Elimina la voce"
          pendingLabel="Elimino…"
          confirm={`Eliminare ${entry.name}${entry.kind === "DEBT" ? " con i suoi pagamenti" : ""}?`}
        />
      ) : null}
    </ConsoleForm>
  );
}
