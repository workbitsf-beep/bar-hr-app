import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildFatturaXml,
  fatturaFileName,
  fatturaProgressive,
  isItalianVat,
  isTaxCode,
  missingIssuerFields,
  missingRecipientFields,
  type FatturaInput,
} from "../lib/invoicing/fattura-pa";

const issuer = {
  firstName: "Loris",
  lastName: "Rossi",
  legalName: "Workbit di Loris Rossi",
  vatNumber: "01234567897",
  taxCode: "RSSLRS90A01F205X",
  street: "Via Roma 1",
  postalCode: "20100",
  city: "Milano",
  province: "mi",
};

const recipient = {
  businessName: "Trattoria da Marco & Figli srl",
  vatNumber: "IT12345678903",
  taxCode: null,
  recipientCode: "abc1234",
  certifiedEmail: null,
  street: "Corso Italia 5",
  postalCode: "20122",
  city: "Milano",
  province: "MI",
  countryCode: "IT",
};

const base: FatturaInput = {
  issuer,
  recipient,
  number: "2026/1",
  progressive: fatturaProgressive(2026, 1),
  date: new Date("2026-10-15T10:00:00Z"),
  lines: [{ description: "Workbit Base · ottobre 2026", amountCents: 2999 }],
};

test("forfettario: no VAT, RF19, N2.2 and the law in words", () => {
  const xml = buildFatturaXml(base);
  assert.match(xml, /<RegimeFiscale>RF19<\/RegimeFiscale>/);
  assert.match(xml, /<AliquotaIVA>0.00<\/AliquotaIVA><Natura>N2.2<\/Natura>/);
  assert.match(xml, /<Imposta>0.00<\/Imposta>/);
  assert.match(xml, /<ImportoTotaleDocumento>29.99<\/ImportoTotaleDocumento>/);
  assert.match(xml, /<Causale>Operazione in franchigia da IVA/);
  assert.match(xml, /<Nome>Loris<\/Nome><Cognome>Rossi<\/Cognome>/);
  assert.match(xml, /<IdCodice>12345678903<\/IdCodice>/);
  assert.match(xml, /<CodiceDestinatario>ABC1234<\/CodiceDestinatario>/);
  assert.match(xml, /Trattoria da Marco &amp; Figli srl/);
  assert.match(xml, /<Data>2026-10-15<\/Data>/);
  assert.match(xml, /<Provincia>MI<\/Provincia>/);
  assert.doesNotMatch(xml, /DatiBollo/);
});

test("above 77,47 € the 2 € stamp duty is declared", () => {
  const xml = buildFatturaXml({ ...base, lines: [{ description: "Workbit Pro · anno", amountCents: 59990 }] });
  assert.match(xml, /<DatiBollo><BolloVirtuale>SI<\/BolloVirtuale><ImportoBollo>2.00<\/ImportoBollo><\/DatiBollo>/);
});

test("a discount line lowers the total", () => {
  const xml = buildFatturaXml({
    ...base,
    lines: [
      { description: "Workbit Base", amountCents: 2999 },
      { description: "Sconto stessa partita IVA", amountCents: -300 },
    ],
  });
  assert.match(xml, /<PrezzoTotale>-3.00<\/PrezzoTotale>/);
  assert.match(xml, /<ImportoTotaleDocumento>26.99<\/ImportoTotaleDocumento>/);
});

test("without an SDI code the invoice goes to the PEC", () => {
  const xml = buildFatturaXml({ ...base, recipient: { ...recipient, recipientCode: null, certifiedEmail: "marco@pec.it" } });
  assert.match(xml, /<CodiceDestinatario>0000000<\/CodiceDestinatario><PECDestinatario>marco@pec.it<\/PECDestinatario>/);
});

test("file name and progressive", () => {
  assert.equal(fatturaProgressive(2026, 1), "26001");
  assert.equal(fatturaProgressive(2026, 1295), "260ZZ");
  assert.equal(fatturaFileName(issuer, "26001"), "ITRSSLRS90A01F205X_26001.xml");
});

test("checks on VAT numbers, tax codes and missing data", () => {
  assert.equal(isItalianVat("01234567897"), true);
  assert.equal(isItalianVat("IT 12345678903"), true);
  assert.equal(isItalianVat("12345678901"), false);
  assert.equal(isTaxCode("rsslrs90a01f205x"), true);
  assert.deepEqual(missingRecipientFields(recipient), []);
  assert.deepEqual(missingRecipientFields({ ...recipient, recipientCode: "", province: "" }), [
    "provincia",
    "codice destinatario SDI o PEC",
  ]);
  assert.deepEqual(missingIssuerFields(issuer), []);
  assert.deepEqual(missingIssuerFields({ ...issuer, vatNumber: "" }), ["partita IVA"]);
});
