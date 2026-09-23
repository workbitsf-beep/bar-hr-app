"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toDateInputValueInTimeZone } from "@/lib/time-zone";
import { deleteBarBySuperAdminAction, updateBarSubscriptionAction } from "../../actions";
import { getDefaultStatus } from "../subscription-helpers";
import { useOverlayLock } from "../../use-overlay-lock";
import { getAdditionalOwnersForBar, type BarItem, type OwnerOption } from "./bars-helpers";

// Both modals are hidden by default (URL-driven: only rendered once a
// ?open=<barId> or ?new=1 param is present), so keeping them lazy-loaded
// means this controller costs almost nothing until one is actually needed.
const CreateBarModal = dynamic(() => import("./create-bar-modal"), { ssr: false });
const BarDetailModal = dynamic(() => import("./bar-detail-modal"), { ssr: false });

function formatDateInput(value: Date | string | null) {
  if (!value) {
    return "";
  }

  return toDateInputValueInTimeZone(value);
}

export function BarsModalsController({
  bars,
  owners,
  openBarId,
  showCreate,
  closeHref,
}: {
  bars: BarItem[];
  owners: OwnerOption[];
  openBarId: string | null;
  showCreate: boolean;
  closeHref: string;
}) {
  const router = useRouter();
  const todayKey = toDateInputValueInTimeZone(new Date());
  const [isPending, startTransition] = useTransition();
  const [ownerId, setOwnerId] = useState("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [planType, setPlanType] = useState<"FREE" | "TRIAL" | "PAID" | "LIFETIME">("PAID");
  const [status, setStatus] = useState<
    "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INACTIVE"
  >("INACTIVE");
  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "YEARLY" | "">("");
  const [monthlyDiscountPercent, setMonthlyDiscountPercent] = useState("0");
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState("");
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [additionalOwnerIds, setAdditionalOwnerIds] = useState<string[]>([]);
  const [newAdditionalOwnerIds, setNewAdditionalOwnerIds] = useState<string[]>([]);
  const [additionalOwnerDraftId, setAdditionalOwnerDraftId] = useState("");
  const [newAdditionalOwnerDraftId, setNewAdditionalOwnerDraftId] = useState("");
  const nowMs = useMemo(() => Date.now(), []);
  useOverlayLock(showCreate || Boolean(openBarId));

  useEffect(() => {
    if (!showCreate) {
      return;
    }

    setNewOwnerId("");
    setNewAdditionalOwnerIds([]);
    setNewAdditionalOwnerDraftId("");
  }, [showCreate]);

  const selectedBar = useMemo(() => bars.find((bar) => bar.id === openBarId) ?? null, [bars, openBarId]);
  const selectedSubscription = useMemo(
    () =>
      selectedBar?.subscription ?? {
        planType: "PAID" as const,
        status: "INACTIVE" as const,
        billingInterval: null,
        monthlyDiscountPercent: 0,
        currentPeriodEnd: null,
        trialEndsAt: null,
      },
    [selectedBar]
  );
  const selectedAccessUnlocked = Boolean(
    selectedSubscription.planType === "FREE" ||
      selectedSubscription.planType === "LIFETIME" ||
      (selectedSubscription.planType === "TRIAL" &&
        selectedSubscription.trialEndsAt &&
        new Date(selectedSubscription.trialEndsAt).getTime() > nowMs) ||
      (selectedSubscription.planType === "PAID" &&
        (selectedSubscription.status === "ACTIVE" || selectedSubscription.status === "TRIALING"))
  );

  useEffect(() => {
    if (!selectedBar) {
      return;
    }

    setOwnerId(selectedBar.owner.id);
    setPlanType(selectedSubscription.planType);
    setStatus(selectedSubscription.status);
    setBillingInterval(selectedSubscription.billingInterval ?? "");
    setMonthlyDiscountPercent(String(selectedSubscription.monthlyDiscountPercent ?? 0));
    setCurrentPeriodEnd(formatDateInput(selectedSubscription.currentPeriodEnd));
    setTrialEndsAt(formatDateInput(selectedSubscription.trialEndsAt));
    setAdditionalOwnerIds(getAdditionalOwnersForBar(selectedBar).map((owner) => owner.id));
    setAdditionalOwnerDraftId("");
  }, [selectedBar, selectedSubscription]);

  const hasOwners = owners.length > 0;

  function close() {
    if (isPending) {
      return;
    }

    router.push(closeHref);
  }

  function applyPlan(nextPlan: "FREE" | "TRIAL" | "PAID" | "LIFETIME") {
    setPlanType(nextPlan);
    setStatus(getDefaultStatus(nextPlan));

    if (nextPlan !== "PAID") {
      setBillingInterval("");
      setCurrentPeriodEnd("");
    }

    if (nextPlan !== "TRIAL") {
      setTrialEndsAt("");
    }
  }

  async function saveSubscription() {
    if (!selectedBar) {
      return;
    }

    const formData = new FormData();
    formData.set("barId", selectedBar.id);
    formData.set("ownerId", ownerId);
    formData.set("planType", planType);
    formData.set("status", status);
    formData.set("monthlyDiscountPercent", monthlyDiscountPercent || "0");

    Array.from(new Set(additionalOwnerIds.filter((additionalOwnerId) => additionalOwnerId !== ownerId))).forEach(
      (additionalOwnerId) => {
        formData.append("additionalOwnerIds", additionalOwnerId);
      }
    );

    if (billingInterval) {
      formData.set("billingInterval", billingInterval);
    }

    if (currentPeriodEnd) {
      formData.set("currentPeriodEnd", currentPeriodEnd);
    }

    if (trialEndsAt) {
      formData.set("trialEndsAt", trialEndsAt);
    }

    startTransition(async () => {
      await updateBarSubscriptionAction(formData);
      router.push(closeHref);
      router.refresh();
    });
  }

  async function deleteBar() {
    if (!selectedBar) {
      return;
    }

    const confirmed = window.confirm(
      `Vuoi eliminare definitivamente ${selectedBar.name}? Questa azione rimuove la struttura e i dati collegati.`
    );

    if (!confirmed) {
      return;
    }

    const formData = new FormData();
    formData.set("barId", selectedBar.id);

    startTransition(async () => {
      try {
        await deleteBarBySuperAdminAction(formData);
        router.push(closeHref);
        router.refresh();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Eliminazione non riuscita.");
      }
    });
  }

  return (
    <>
      <CreateBarModal
        open={showCreate}
        onClose={close}
        owners={owners}
        hasOwners={hasOwners}
        newOwnerId={newOwnerId}
        setNewOwnerId={setNewOwnerId}
        newAdditionalOwnerIds={newAdditionalOwnerIds}
        setNewAdditionalOwnerIds={setNewAdditionalOwnerIds}
        newAdditionalOwnerDraftId={newAdditionalOwnerDraftId}
        setNewAdditionalOwnerDraftId={setNewAdditionalOwnerDraftId}
      />

      {selectedBar ? (
        <BarDetailModal
          bar={selectedBar}
          owners={owners}
          isPending={isPending}
          onClose={close}
          ownerId={ownerId}
          setOwnerId={setOwnerId}
          additionalOwnerIds={additionalOwnerIds}
          setAdditionalOwnerIds={setAdditionalOwnerIds}
          additionalOwnerDraftId={additionalOwnerDraftId}
          setAdditionalOwnerDraftId={setAdditionalOwnerDraftId}
          planType={planType}
          status={status}
          billingInterval={billingInterval}
          monthlyDiscountPercent={monthlyDiscountPercent}
          currentPeriodEnd={currentPeriodEnd}
          trialEndsAt={trialEndsAt}
          todayKey={todayKey}
          applyPlan={applyPlan}
          setStatus={setStatus}
          setBillingInterval={setBillingInterval}
          setMonthlyDiscountPercent={setMonthlyDiscountPercent}
          setCurrentPeriodEnd={setCurrentPeriodEnd}
          setTrialEndsAt={setTrialEndsAt}
          selectedSubscription={selectedSubscription}
          selectedAccessUnlocked={selectedAccessUnlocked}
          onSave={() => void saveSubscription()}
          onDelete={() => void deleteBar()}
        />
      ) : null}
    </>
  );
}
