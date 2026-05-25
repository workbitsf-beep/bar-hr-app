"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/app/dashboard/ui";

type IntervalValue = "MONTHLY" | "YEARLY";

export function BillingCheckoutClient({
  canActivate,
  canCancel,
  trialSetupRequired,
  monthlyDiscountPercent,
}: {
  canActivate: boolean;
  canCancel: boolean;
  trialSetupRequired: boolean;
  monthlyDiscountPercent: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function startCheckout(interval: IntervalValue) {
    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ interval }),
        });

        const result = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              url?: string;
              message?: string;
            }
          | null;

        if (!response.ok || !result?.ok || !result.url) {
          setError(result?.message || "Impossibile avviare il checkout Stripe.");
          return;
        }

        window.location.href = result.url;
      } catch {
        setError("Impossibile avviare il checkout Stripe.");
      }
    });
  }

  function cancelSubscription() {
    const confirmed = window.confirm(
      "Vuoi davvero disattivare l'abbonamento? Il locale verra bloccato subito."
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/billing/cancel", {
          method: "POST",
        });

        const result = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              message?: string;
            }
          | null;

        if (!response.ok || !result?.ok) {
          setError(result?.message || "Impossibile disattivare l'abbonamento.");
          return;
        }

        setSuccessMessage("Abbonamento disattivato.");
        router.refresh();
      } catch {
        setError("Impossibile disattivare l'abbonamento.");
      }
    });
  }

  if (!canActivate && !canCancel) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {monthlyDiscountPercent > 0 ? (
        <div style={{ color: "#166534", fontSize: 14, lineHeight: 1.6 }}>
          Sconto mensile attivo: {monthlyDiscountPercent}% sul piano mensile di questo locale.
        </div>
      ) : null}

      <div className="dashboard-action-row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {canActivate ? (
          <>
            <PrimaryButton
              type="button"
              onClick={() => startCheckout("MONTHLY")}
              disabled={isPending}
            >
              {isPending
                ? "Apertura checkout..."
                : trialSetupRequired
                  ? "Avvia la prova e poi rinnovo mensile"
                  : "Attiva abbonamento mensile"}
            </PrimaryButton>
            <PrimaryButton
              type="button"
              tone="sand"
              onClick={() => startCheckout("YEARLY")}
              disabled={isPending}
            >
              {isPending
                ? "Apertura checkout..."
                : trialSetupRequired
                  ? "Avvia la prova e poi rinnovo annuale"
                  : "Attiva abbonamento annuale"}
            </PrimaryButton>
          </>
        ) : null}

        {canCancel ? (
          <PrimaryButton
            type="button"
            tone="red"
            onClick={cancelSubscription}
            disabled={isPending}
          >
            {isPending ? "Disattivazione..." : "Disattiva abbonamento"}
          </PrimaryButton>
        ) : null}
      </div>

      {error ? <div style={{ color: "#991b1b", fontSize: 14 }}>{error}</div> : null}
      {successMessage ? (
        <div style={{ color: "#166534", fontSize: 14 }}>{successMessage}</div>
      ) : null}
    </div>
  );
}
