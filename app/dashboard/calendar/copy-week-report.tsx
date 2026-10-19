"use client";

/**
 * What "Copia la settimana scorsa" did, kept on screen until it is read: how
 * many shifts came across, and each one that did not, by day, person and
 * reason (holidays, a permit, unavailability, another shift, gone from the
 * venue). Copying used to skip those in silence and the week looked done.
 */
export type CopyWeekResult = { created: number; alreadyThere: number; left: string[] };

export function copyWeekResultOf(result: unknown): CopyWeekResult {
  const value = (result ?? {}) as { created?: number; alreadyThere?: number; left?: unknown };
  return {
    created: value.created ?? 0,
    alreadyThere: value.alreadyThere ?? 0,
    left: Array.isArray(value.left) ? value.left.map(String) : [],
  };
}

export function copyWeekSummary({ created, alreadyThere, left }: CopyWeekResult) {
  if (created === 0 && left.length === 0) {
    return alreadyThere > 0 ? "I turni della settimana scorsa ci sono già." : "Niente da copiare: la settimana prima è vuota.";
  }
  const done = created === 1 ? "1 turno copiato come bozza" : `${created} turni copiati come bozza`;
  return left.length
    ? `${done}. Alcuni non sono stati copiati: li trovi qui sotto.`
    : `${done}: controllali e pubblica la settimana.`;
}

export function CopyWeekReport({ result, onClose }: { result: CopyWeekResult; onClose: () => void }) {
  if (!result.left.length) return null;
  return (
    <div
      role="status"
      style={{
        display: "grid",
        gap: 8,
        padding: "12px 14px",
        borderRadius: 16,
        border: "1px solid #fcd9a5",
        background: "#fff8eb",
        color: "#7a4a06",
        lineHeight: 1.45,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <strong style={{ fontSize: 14.5 }}>
          {result.left.length === 1 ? "1 turno non copiato" : `${result.left.length} turni non copiati`}
          {result.created ? ` · ${result.created} copiati` : ""}
        </strong>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi l'avviso"
          style={{ border: 0, background: "transparent", color: "inherit", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: 0 }}
        >
          ×
        </button>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 3, fontSize: 13.5 }}>
        {result.left.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <span style={{ fontSize: 12.5 }}>Assegnali a qualcun altro o aggiungili a mano quando la persona è disponibile.</span>
    </div>
  );
}
