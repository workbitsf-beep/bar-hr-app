"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties } from "react";
import { removeListAction, saveSupplierProfileAction } from "./actions";

const input: CSSProperties = { minHeight: 46, padding: "0 12px", borderRadius: 12, border: "1px solid #ddd6fe", background: "#ffffff", fontSize: 16, width: "100%" };
const label: CSSProperties = { display: "grid", gap: 5, fontSize: 14, fontWeight: 600 };
const primary: CSSProperties = {
  minHeight: 48,
  padding: "0 20px",
  borderRadius: 999,
  border: 0,
  background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
};

function Message({ text, tone }: { text: string; tone: "ok" | "error" }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} style={{ margin: 0, padding: "10px 12px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: tone === "error" ? "#fff1f2" : "#ecfdf5", color: tone === "error" ? "#b3202f" : "#0f7a4f" }}>
      {text}
    </p>
  );
}

export type SupplierView = {
  companyName: string | null;
  vatNumber: string | null;
  zone: string | null;
  categories: string | null;
  phone: string | null;
  termsAccepted: boolean;
};

/** The company's details with the terms, then the list: upload, replace, remove. */
export function SupplierPanel({ supplier, termsUrl, hasList }: { supplier: SupplierView; termsUrl: string; hasList: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [profileMessage, setProfileMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [listMessage, setListMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [uploading, setUploading] = useState(false);
  const ready = Boolean(supplier.companyName && supplier.termsAccepted);

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    start(async () => {
      const result = await saveSupplierProfileAction(data);
      if ("ruleError" in result) setProfileMessage({ text: result.ruleError, tone: "error" });
      else {
        setProfileMessage({ text: "Dati salvati.", tone: "ok" });
        router.refresh();
      }
    });
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setUploading(true);
    setListMessage(null);
    try {
      const response = await fetch("/api/fornitori/listino", { method: "POST", body: new FormData(form) });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      setListMessage({ text: payload?.message ?? (response.ok ? "Listino pubblicato." : "Lettura non riuscita."), tone: response.ok && payload?.ok ? "ok" : "error" });
      if (response.ok && payload?.ok) {
        form.reset();
        router.refresh();
      }
    } catch {
      setListMessage({ text: "Caricamento non riuscito: controlla la connessione.", tone: "error" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section style={{ background: "#ffffff", border: "1px solid #ece9f7", borderRadius: 20, padding: "16px 18px" }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 17 }}>La tua azienda</h2>
        <form onSubmit={saveProfile} style={{ display: "grid", gap: 12 }}>
          <label style={label}>
            Ragione sociale
            <input name="companyName" defaultValue={supplier.companyName ?? ""} required style={input} />
          </label>
          <label style={label}>
            Partita IVA
            <input name="vatNumber" defaultValue={supplier.vatNumber ?? ""} required inputMode="numeric" style={input} />
          </label>
          <label style={label}>
            Zona servita
            <input name="zone" defaultValue={supplier.zone ?? ""} placeholder="Veneto, provincia di Padova, Nord Italia…" style={input} />
          </label>
          <label style={label}>
            Cosa vendi
            <input name="categories" defaultValue={supplier.categories ?? ""} placeholder="Acciai, viteria, bevande, caffè…" style={input} />
          </label>
          <label style={label}>
            Telefono
            <input name="phone" defaultValue={supplier.phone ?? ""} inputMode="tel" style={input} />
          </label>
          {supplier.termsAccepted ? (
            <p style={{ margin: 0, fontSize: 13.5, color: "#0f7a4f" }}>
              ✓ Condizioni per i fornitori accettate ·{" "}
              <a href={termsUrl} target="_blank" rel="noopener noreferrer">
                rileggile
              </a>
            </p>
          ) : (
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5, lineHeight: 1.45 }}>
              <input type="checkbox" name="acceptTerms" style={{ width: 20, height: 20, marginTop: 2 }} />
              <span>
                Ho letto e accetto le{" "}
                <a href={termsUrl} target="_blank" rel="noopener noreferrer">
                  condizioni per i fornitori
                </a>
                : autorizzo Workbit a mostrare i prezzi del mio listino alle attività che comprano gli stessi prodotti.
              </span>
            </label>
          )}
          <button type="submit" style={primary} disabled={pending}>
            {pending ? "Salvo…" : "Salva"}
          </button>
          {profileMessage ? <Message {...profileMessage} /> : null}
        </form>
      </section>

      <section style={{ background: "#ffffff", border: "1px solid #ece9f7", borderRadius: 20, padding: "16px 18px", opacity: ready ? 1 : 0.55 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>{hasList ? "Aggiorna il listino" : "Carica il listino"}</h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#4c4670", lineHeight: 1.5 }}>
          PDF, Excel o CSV, così come lo mandi ai clienti. Workbit lo legge da solo e porta ogni prodotto al suo prezzo per kg, litro o pezzo. Un nuovo listino sostituisce il precedente.
        </p>
        <form onSubmit={upload} style={{ display: "grid", gap: 12 }}>
          <label style={label}>
            Valido dal
            <input type="date" name="validFrom" style={input} disabled={!ready} />
          </label>
          <label style={label}>
            File del listino
            <input type="file" name="file" accept=".pdf,.xlsx,.xlsm,.csv,.txt" required disabled={!ready} />
          </label>
          <button type="submit" style={primary} disabled={!ready || uploading}>
            {uploading ? "Leggo il listino… (fino a un paio di minuti)" : "Pubblica il listino"}
          </button>
          {!ready ? <p style={{ margin: 0, fontSize: 13.5, color: "#7c7894" }}>Prima salva i dati dell&apos;azienda e accetta le condizioni.</p> : null}
          {listMessage ? <Message {...listMessage} /> : null}
        </form>
        {hasList ? (
          <button
            type="button"
            onClick={() =>
              start(async () => {
                const result = await removeListAction();
                if ("ruleError" in result) setListMessage({ text: result.ruleError, tone: "error" });
                else {
                  setListMessage({ text: "Listino tolto da Workbit.", tone: "ok" });
                  router.refresh();
                }
              })
            }
            style={{ marginTop: 10, border: 0, background: "none", color: "#b3202f", fontSize: 14, fontWeight: 650, cursor: "pointer" }}
          >
            Togli il listino da Workbit
          </button>
        ) : null}
      </section>
    </div>
  );
}
