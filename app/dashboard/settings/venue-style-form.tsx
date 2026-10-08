"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { SIGN_FONTS, type SignFontId } from "@/lib/plans";
import { describeActionError, isActionFailure } from "@/lib/rule-error";
import { SIGN_FONT_CLASS, SIGN_FONT_KEEPS_CASE } from "../sign-fonts";
import { saveVenueStyleAction } from "../style-actions";

/** The logo is cropped square and shrunk on the phone: the header shows it at 40px. */
const LOGO_SIDE = 256;

async function squareLogo(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = LOGO_SIDE;
  canvas.height = LOGO_SIDE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    LOGO_SIDE,
    LOGO_SIDE
  );
  bitmap.close();
  const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (webp && webp.type === "image/webp") return webp;
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!png) throw new Error("png");
  return png;
}

export function VenueStyleForm({
  barName,
  currentFont,
  logoUrl,
}: {
  barName: string;
  currentFont: SignFontId | null;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [font, setFont] = useState<SignFontId>(currentFont ?? "classico");
  const [logo, setLogo] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section style={{ display: "grid", gap: 10 }}>
        <strong style={{ fontSize: 15 }}>Logo</strong>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              border: "1px solid #e9e6f5",
              background: "#f8f7fd",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              flex: "none",
            }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Logo del locale" width={64} height={64} style={{ objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 12, color: "#a39fb8", fontWeight: 700 }}>Nessuno</span>
            )}
          </span>
          <div style={{ display: "grid", gap: 6 }}>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const blob = await squareLogo(file);
                  setLogo(blob);
                  setRemoveLogo(false);
                  setPreview(URL.createObjectURL(blob));
                  setStatus(null);
                } catch {
                  setStatus({ tone: "error", text: "Non riesco a leggere questa immagine: prova con un PNG o un JPG." });
                }
              }}
            />
            <button type="button" className="wbstyle-btn" onClick={() => input.current?.click()}>
              {preview ? "Cambia logo" : "Carica il logo"}
            </button>
            {preview ? (
              <button
                type="button"
                className="wbstyle-link"
                onClick={() => {
                  setLogo(null);
                  setPreview(null);
                  setRemoveLogo(true);
                }}
              >
                Togli il logo
              </button>
            ) : null}
          </div>
        </div>
        <span style={{ fontSize: 12.5, color: "#8b88a3" }}>
          PNG, JPG o WebP. Lo ritagliamo quadrato: va al posto del logo Workbit in alto a sinistra.
        </span>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <strong style={{ fontSize: 15 }}>Font dell&apos;insegna</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {SIGN_FONTS.map((option) => {
            const on = option.id === font;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFont(option.id)}
                style={{
                  display: "grid",
                  gap: 4,
                  justifyItems: "center",
                  padding: "12px 8px",
                  borderRadius: 16,
                  border: on ? "1.5px solid #8b5cf6" : "1px solid #e9e6f5",
                  background: on ? "#f6f3ff" : "#ffffff",
                  cursor: "pointer",
                  minWidth: 0,
                }}
              >
                <span
                  className={SIGN_FONT_CLASS[option.id]}
                  style={{
                    fontSize: 15,
                    color: "#17183d",
                    textTransform: SIGN_FONT_KEEPS_CASE[option.id] ? "none" : "uppercase",
                    letterSpacing: SIGN_FONT_KEEPS_CASE[option.id] ? "0.01em" : "0.08em",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "100%",
                  }}
                >
                  {barName}
                </span>
                <small style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: on ? "#6d3df0" : "#a39fb8" }}>
                  {option.name}
                </small>
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 12.5, color: "#8b88a3" }}>
          Hai un font tuo? Scrivi all&apos;assistenza: controlliamo la licenza e lo aggiungiamo.
        </span>
      </section>

      {status ? (
        <div
          role="status"
          style={{
            padding: "10px 12px",
            borderRadius: 14,
            fontWeight: 800,
            ...(status.tone === "ok"
              ? { background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#166534" }
              : { background: "#fff1f2", border: "1px solid #fecdd3", color: "#b3202f" }),
          }}
        >
          {status.tone === "ok" ? "✓ " : ""}
          {status.text}
        </div>
      ) : null}

      <button
        type="button"
        className="wbstyle-save"
        disabled={pending}
        onClick={() => {
          const formData = new FormData();
          formData.set("signFont", font);
          if (removeLogo) formData.set("removeLogo", "1");
          if (logo) formData.set("logo", new File([logo], logo.type === "image/png" ? "logo.png" : "logo.webp", { type: logo.type }));
          setStatus(null);
          start(async () => {
            try {
              const result = await saveVenueStyleAction(formData);
              if (isActionFailure(result)) {
                setStatus({ tone: "error", text: result.ruleError });
                return;
              }
              setStatus({ tone: "ok", text: "Stile salvato." });
              setLogo(null);
              router.refresh();
            } catch (error) {
              setStatus({ tone: "error", text: describeActionError(error) });
            }
          });
        }}
      >
        {pending ? "Salvo…" : "Salva lo stile"}
      </button>

      <style>{`
        .wbstyle-btn { height: 38px; padding: 0 14px; border-radius: 999px; border: 0; background: #f1ecff; color: #4c1d95; font-weight: 850; font-size: 13.5px; cursor: pointer; font-family: inherit; }
        .wbstyle-link { border: 0; background: none; color: #b3202f; font-weight: 750; font-size: 13px; cursor: pointer; padding: 0; text-align: left; font-family: inherit; }
        .wbstyle-save { height: 50px; border: 0; border-radius: 18px; background: linear-gradient(160deg,#9b5cff,#6d3df0); color: #fff; font-size: 15.5px; font-weight: 850; cursor: pointer; font-family: inherit; }
        .wbstyle-save:disabled { opacity: .6; }
      `}</style>
    </div>
  );
}
