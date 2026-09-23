"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBarBySuperAdminAction } from "../../../actions";

export function DangerZone({ barId, barName }: { barId: string; barName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    const confirmed = window.confirm(
      `Eliminare definitivamente ${barName}? Vengono rimossi anche turni, timbrature e documenti collegati.`
    );

    if (!confirmed) {
      return;
    }

    const formData = new FormData();
    formData.set("barId", barId);

    startTransition(async () => {
      try {
        await deleteBarBySuperAdminAction(formData);
        router.replace("/dashboard/super-admin");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Eliminazione non riuscita.");
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <p className="wbc-note wbc-note-negative" style={{ justifySelf: "stretch" }}>
        L&apos;eliminazione è definitiva e rimuove tutti i dati collegati a questo locale.
      </p>

      {error ? <p className="wbc-note wbc-note-negative">{error}</p> : null}

      <button type="button" className="wbc-btn wbc-btn-danger" onClick={remove} disabled={isPending}>
        {isPending ? "Eliminazione…" : "Elimina definitivamente"}
      </button>
    </div>
  );
}
