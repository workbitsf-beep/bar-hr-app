"use client";

import { useState } from "react";
import { updateVenueDetailsBySuperAdminAction } from "../../../actions";
import { ConsoleForm } from "../../console-form";
import { Field, FieldGrid, Note } from "../../console-ui";

type Details = {
  barId: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  activityType: "RESTAURANT" | "COMPANY";
  admins: number;
};

const CATEGORIES = [
  { value: "RESTAURANT", title: "Ristorazione", lead: "Bar, ristoranti, locali: reparti banco, cucina e sala." },
  { value: "COMPANY", title: "Azienda", lead: "Uffici, negozi, magazzini: sedi con il loro punto di timbratura." },
] as const;

/** The venue's details and its category, saved together with one button. */
export function VenueDetailsForm({ details }: { details: Details }) {
  const [category, setCategory] = useState(details.activityType);
  const switching = category !== details.activityType;

  return (
    <ConsoleForm
      action={updateVenueDetailsBySuperAdminAction}
      label="Salva dati e categoria"
      confirm={(formData) =>
        String(formData.get("activityType")) !== details.activityType
          ? `Cambiare ${details.name} in ${formData.get("activityType") === "COMPANY" ? "Azienda" : "Ristorazione"}? Reparti o sedi assegnati alle persone e ai turni da oggi in poi vengono tolti.`
          : null
      }
    >
      <input type="hidden" name="barId" value={details.barId} />

      <div className="wbc-choice" role="radiogroup" aria-label="Categoria">
        {CATEGORIES.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name="activityType"
              value={option.value}
              checked={category === option.value}
              onChange={() => setCategory(option.value)}
            />
            <strong>
              {option.title}
              {option.value === details.activityType ? " · attuale" : ""}
            </strong>
            <span>{option.lead}</span>
          </label>
        ))}
      </div>

      {switching ? (
        <Note tone="warning">
          {category === "COMPANY"
            ? "Diventa un'azienda: i reparti (banco, cucina, sala) delle persone e dei turni da oggi in poi vengono tolti, e al loro posto ci sono le sedi. I turni e le timbrature passate restano."
            : `Diventa ristorazione: le sedi delle persone e dei turni da oggi in poi vengono tolte (le sedi restano salvate se torni ad Azienda).${
                details.admins
                  ? ` ${details.admins} ${details.admins === 1 ? "persona in Amministrazione diventa Responsabile" : "persone in Amministrazione diventano Responsabili"}.`
                  : ""
              }`}
        </Note>
      ) : null}

      <FieldGrid>
        <Field label="Nome" span>
          <input name="name" defaultValue={details.name} required maxLength={80} autoComplete="off" />
        </Field>
        <Field label="Ragione sociale">
          <input name="legalName" defaultValue={details.legalName ?? ""} maxLength={120} autoComplete="off" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" defaultValue={details.email ?? ""} maxLength={120} autoComplete="off" />
        </Field>
        <Field label="Telefono">
          <input name="phone" type="tel" defaultValue={details.phone ?? ""} maxLength={40} autoComplete="off" />
        </Field>
        <Field label="Indirizzo">
          <input name="addressLine1" defaultValue={details.addressLine1 ?? ""} maxLength={160} autoComplete="off" />
        </Field>
        <Field label="Città">
          <input name="city" defaultValue={details.city ?? ""} maxLength={80} autoComplete="off" />
        </Field>
        <Field label="CAP">
          <input name="postalCode" inputMode="numeric" defaultValue={details.postalCode ?? ""} maxLength={12} autoComplete="off" />
        </Field>
      </FieldGrid>
    </ConsoleForm>
  );
}
