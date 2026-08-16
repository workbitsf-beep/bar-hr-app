export type FiscalCustomer = {
  businessName: string;
  vatNumber: string | null;
  taxCode: string | null;
  recipientCode: string | null;
  certifiedEmail: string | null;
  billingEmail: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string | null;
  postalCode: string;
  countryCode: string;
};

export type FiscalInvoiceLine = {
  description: string;
  quantity: number;
  unitAmount: number;
  vatRate: number;
};

export type FiscalInvoiceDraft = {
  sourceInvoiceId: string;
  currency: string;
  issueDate: Date;
  customer: FiscalCustomer;
  lines: FiscalInvoiceLine[];
};

export type IssuedFiscalInvoice = {
  providerId: string;
  number: string;
  pdfUrl: string | null;
};

/** Adapter contract for the future Italian e-invoicing provider. */
export interface FiscalInvoiceProvider {
  validateCustomer(customer: FiscalCustomer): Promise<{ valid: boolean; errors: string[] }>;
  issueInvoice(draft: FiscalInvoiceDraft): Promise<IssuedFiscalInvoice>;
  getInvoice(providerId: string): Promise<IssuedFiscalInvoice | null>;
  cancelInvoice(providerId: string): Promise<void>;
}
