"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createOwnerAndBarBySuperAdminAction } from "../../actions";
import { Field, FieldGrid, Note, Section } from "../console-ui";
import { fullName, type PersonShape } from "../console-data";

function Submit() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="wbc-btn wbc-btn-primary wbc-btn-block" disabled={pending}>
      {pending ? "Creazione in corso…" : "Crea locale"}
    </button>
  );
}

export function NewVenueForm({
  owners,
  languageOptions,
}: {
  owners: PersonShape[];
  languageOptions: Array<{ value: string; label: string }>;
}) {
  const [mode, setMode] = useState<"new" | "existing">(owners.length > 0 ? "existing" : "new");
  const [primary, setPrimary] = useState(owners[0]?.id ?? "");
  const [extra, setExtra] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  const excluded = mode === "existing" ? primary : "";
  const visible = extra.filter((id) => id !== excluded);
  const selectable = owners.filter((owner) => owner.id !== excluded && !extra.includes(owner.id));

  return (
    <form action={createOwnerAndBarBySuperAdminAction} style={{ display: "grid", gap: 4 }}>
      <input type="hidden" name="ownerMode" value={mode} />

      <Section title="Titolare">
        <div className="wbc-chips">
          <button
            type="button"
            className="wbc-chip"
            data-on={mode === "existing" ? "1" : "0"}
            onClick={() => setMode("existing")}
            disabled={owners.length === 0}
          >
            Titolare esistente
          </button>
          <button type="button" className="wbc-chip" data-on={mode === "new" ? "1" : "0"} onClick={() => setMode("new")}>
            Nuovo titolare
          </button>
        </div>

        {mode === "existing" ? (
          owners.length === 0 ? (
            <Note tone="warning">Non ci sono ancora titolari registrati: creane uno nuovo.</Note>
          ) : (
            <Field label="Scegli il titolare">
              <select
                name="existingOwnerId"
                value={primary}
                onChange={(event) => setPrimary(event.target.value)}
                required
              >
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {fullName(owner)} · {owner.email}
                  </option>
                ))}
              </select>
            </Field>
          )
        ) : (
          <>
            <FieldGrid>
              <Field label="Nome">
                <input name="firstName" required autoComplete="off" />
              </Field>
              <Field label="Cognome">
                <input name="lastName" required autoComplete="off" />
              </Field>
              <Field label="Email" span>
                <input name="email_owner" type="email" required autoComplete="off" />
              </Field>
              <Field label="Lingua">
                <select name="language" defaultValue={languageOptions[0]?.value}>
                  {languageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </FieldGrid>
            <Note>Riceverà per email le credenziali di accesso con una password temporanea.</Note>
          </>
        )}
      </Section>

      <Section title="Locale">
        <FieldGrid>
          <Field label="Nome locale" span>
            <input name="name" required autoComplete="off" />
          </Field>
          <Field label="Categoria">
            <select name="activityType" defaultValue="RESTAURANT">
              <option value="RESTAURANT">Ristorazione</option>
              <option value="COMPANY">Azienda</option>
            </select>
          </Field>
          <Field label="Email locale">
            <input name="email" type="email" autoComplete="off" />
          </Field>
          <Field label="Telefono">
            <input name="phone" type="tel" autoComplete="off" />
          </Field>
          <Field label="Indirizzo">
            <input name="addressLine1" autoComplete="off" />
          </Field>
          <Field label="Città">
            <input name="city" autoComplete="off" />
          </Field>
          <Field label="CAP">
            <input name="postalCode" inputMode="numeric" autoComplete="off" />
          </Field>
        </FieldGrid>
      </Section>

      {owners.length > 0 ? (
        <Section title={`Titolari aggiuntivi · ${visible.length}`}>
          <div style={{ display: "flex", gap: 9 }}>
            <select value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Aggiungi titolare">
              <option value="">Aggiungi titolare…</option>
              {selectable.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {fullName(owner)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="wbc-btn wbc-btn-ghost"
              disabled={!draft}
              onClick={() => {
                if (draft && !extra.includes(draft)) {
                  setExtra([...extra, draft]);
                  setDraft("");
                }
              }}
              style={{ flex: "0 0 auto" }}
            >
              Aggiungi
            </button>
          </div>

          {visible.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {visible.map((id) => {
                const owner = owners.find((item) => item.id === id);

                if (!owner) {
                  return null;
                }

                return (
                  <span key={id} className="wbc-chip" style={{ gap: 8 }}>
                    <input type="hidden" name="additionalOwnerIds" value={id} />
                    {fullName(owner)}
                    <button
                      type="button"
                      onClick={() => setExtra(extra.filter((item) => item !== id))}
                      aria-label={`Rimuovi ${fullName(owner)}`}
                      style={{
                        border: 0,
                        background: "transparent",
                        color: "inherit",
                        cursor: "pointer",
                        fontSize: 15,
                        lineHeight: 1,
                        padding: 0,
                        marginLeft: 2,
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          ) : null}
        </Section>
      ) : null}

      <div style={{ marginTop: 26 }}>
        <Submit />
      </div>
    </form>
  );
}
