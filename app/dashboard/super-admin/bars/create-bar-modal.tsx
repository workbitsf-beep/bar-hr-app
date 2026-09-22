"use client";

import { createBarBySuperAdminAction } from "../../actions";
import { AdditionalOwnersPicker } from "../additional-owners-picker";
import { ModalShell } from "../../modal-shell";
import { PrimaryButton, Select, StatusBanner, TextInput } from "../light-ui";
import type { OwnerOption } from "./bars-helpers";

export default function CreateBarModal({
  open,
  onClose,
  owners,
  hasOwners,
  newOwnerId,
  setNewOwnerId,
  newAdditionalOwnerIds,
  setNewAdditionalOwnerIds,
  newAdditionalOwnerDraftId,
  setNewAdditionalOwnerDraftId,
}: {
  open: boolean;
  onClose: () => void;
  owners: OwnerOption[];
  hasOwners: boolean;
  newOwnerId: string;
  setNewOwnerId: (id: string) => void;
  newAdditionalOwnerIds: string[];
  setNewAdditionalOwnerIds: (ids: string[]) => void;
  newAdditionalOwnerDraftId: string;
  setNewAdditionalOwnerDraftId: (id: string) => void;
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Nuova struttura"
      width="min(92vw, 560px)"
      wrapClassName="sa-modal-wrap"
      panelClassName="sa-modal-panel"
    >
      <form action={createBarBySuperAdminAction} style={{ display: "grid", gap: 14 }}>
        {hasOwners ? null : (
          <StatusBanner kind="warning" text="Crea prima almeno un titolare per poter aggiungere una struttura." />
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Nome struttura</span>
            <TextInput name="name" required />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Email struttura</span>
            <TextInput name="email" type="email" />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Telefono</span>
            <TextInput name="phone" />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Indirizzo</span>
            <TextInput name="addressLine1" />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Citta</span>
            <TextInput name="city" />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>CAP</span>
            <TextInput name="postalCode" />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Categoria attivita</span>
            <Select name="activityType" defaultValue="RESTAURANT">
              <option value="RESTAURANT">Ristorazione</option>
              <option value="COMPANY">Azienda</option>
            </Select>
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Responsabile</span>
            <Select
              name="ownerId"
              required
              value={newOwnerId}
              onChange={(event) => {
                const nextOwnerId = event.target.value;
                setNewOwnerId(nextOwnerId);
                setNewAdditionalOwnerDraftId(newAdditionalOwnerDraftId === nextOwnerId ? "" : newAdditionalOwnerDraftId);
                setNewAdditionalOwnerIds(newAdditionalOwnerIds.filter((ownerId) => ownerId !== nextOwnerId));
              }}
            >
              <option value="" disabled>
                Seleziona responsabile
              </option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.firstName} {owner.lastName}
                </option>
              ))}
            </Select>
          </label>

          <AdditionalOwnersPicker
            owners={owners}
            excludeOwnerId={newOwnerId}
            selectedIds={newAdditionalOwnerIds}
            onChange={setNewAdditionalOwnerIds}
            draftId={newAdditionalOwnerDraftId}
            onDraftChange={setNewAdditionalOwnerDraftId}
            emitHiddenInputs
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <PrimaryButton type="button" tone="sand" onClick={onClose}>
            Annulla
          </PrimaryButton>
          <PrimaryButton type="submit" disabled={!hasOwners}>
            Crea struttura
          </PrimaryButton>
        </div>
      </form>
    </ModalShell>
  );
}
