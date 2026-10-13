"use client";

import { ActionForm } from "@/app/components/action-form";
import { FormField, PrimaryButton, TextInput } from "../ui";
import { saveBillingProfileAction } from "./billing-profile-actions";

export type BillingProfileValues = {
  businessName: string;
  vatNumber: string;
  taxCode: string;
  recipientCode: string;
  certifiedEmail: string;
  billingEmail: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  province: string;
  countryCode: string;
};

const grid = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 } as const;

/**
 * Settings → Dati per la fattura: who Workbit invoices, and where the SDI
 * delivers it. `missing` says, in words, what the invoice still lacks.
 */
export function BillingProfileForm({ values, missing }: { values: BillingProfileValues; missing: string[] }) {
  return (
    <ActionForm action={saveBillingProfileAction} success="Dati di fatturazione salvati." style={{ display: "grid", gap: 14 }}>
      <p
        role="status"
        style={{
          margin: 0,
          padding: "10px 12px",
          borderRadius: 14,
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1.45,
          background: missing.length ? "#fffbeb" : "#f0fdf4",
          color: missing.length ? "#92400e" : "#15803d",
          border: `1px solid ${missing.length ? "#fde68a" : "#bbf7d0"}`,
        }}
      >
        {missing.length
          ? `Per la fattura elettronica manca: ${missing.join(", ")}.`
          : "Tutto pronto: le fatture elettroniche arrivano qui ogni mese."}
      </p>

      <FormField label="Ragione sociale">
        <TextInput name="businessName" defaultValue={values.businessName} autoComplete="organization" />
      </FormField>
      <div style={grid}>
        <FormField label="Partita IVA">
          <TextInput name="vatNumber" defaultValue={values.vatNumber} inputMode="numeric" />
        </FormField>
        <FormField label="Codice fiscale" hint="se diverso">
          <TextInput name="taxCode" defaultValue={values.taxCode} autoCapitalize="characters" />
        </FormField>
      </div>

      <FormField label="Indirizzo">
        <TextInput name="addressLine1" defaultValue={values.addressLine1} autoComplete="street-address" />
      </FormField>
      <div style={{ ...grid, gridTemplateColumns: "1fr 2fr" }}>
        <FormField label="CAP">
          <TextInput name="postalCode" defaultValue={values.postalCode} inputMode="numeric" maxLength={5} />
        </FormField>
        <FormField label="Comune">
          <TextInput name="city" defaultValue={values.city} />
        </FormField>
      </div>
      <div style={grid}>
        <FormField label="Provincia" hint="sigla, es. MI">
          <TextInput name="province" defaultValue={values.province} maxLength={2} autoCapitalize="characters" />
        </FormField>
        <FormField label="Paese">
          <TextInput name="countryCode" defaultValue={values.countryCode || "IT"} maxLength={2} autoCapitalize="characters" />
        </FormField>
      </div>

      <div style={grid}>
        <FormField label="Codice SDI" hint="7 caratteri">
          <TextInput name="recipientCode" defaultValue={values.recipientCode} maxLength={7} autoCapitalize="characters" />
        </FormField>
        <FormField label="PEC" hint="se non hai il codice">
          <TextInput name="certifiedEmail" type="email" defaultValue={values.certifiedEmail} />
        </FormField>
      </div>
      <FormField label="Email amministrativa" hint="facoltativa">
        <TextInput name="billingEmail" type="email" defaultValue={values.billingEmail} />
      </FormField>

      <PrimaryButton type="submit" pendingLabel="Salvo..." style={{ minHeight: 48 }}>
        Salva i dati di fatturazione
      </PrimaryButton>
    </ActionForm>
  );
}
