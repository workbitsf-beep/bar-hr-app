type BillingProfileInput = {
  businessName?: string | null;
  vatNumber?: string | null;
  taxCode?: string | null;
  billingEmail?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
};

export function getMissingBillingProfileFields(profile: BillingProfileInput | null | undefined) {
  if (!profile) {
    return [
      "businessName",
      "vatNumberOrTaxCode",
      "billingEmail",
      "addressLine1",
      "city",
      "postalCode",
      "countryCode",
    ];
  }

  const missing: string[] = [];

  if (!profile.businessName?.trim()) missing.push("businessName");
  if (!profile.vatNumber?.trim() && !profile.taxCode?.trim()) missing.push("vatNumberOrTaxCode");
  if (!profile.billingEmail?.trim()) missing.push("billingEmail");
  if (!profile.addressLine1?.trim()) missing.push("addressLine1");
  if (!profile.city?.trim()) missing.push("city");
  if (!profile.postalCode?.trim()) missing.push("postalCode");
  if (!profile.countryCode?.trim()) missing.push("countryCode");

  return missing;
}

export function isBillingProfileComplete(profile: BillingProfileInput | null | undefined) {
  return getMissingBillingProfileFields(profile).length === 0;
}
