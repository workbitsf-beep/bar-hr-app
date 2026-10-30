import { BillingRequired } from "../billing-required";
import { prisma } from "@/lib/prisma";
import { createShoppingListItemAction } from "../actions";
import { getDashboardContext } from "../context";
import { EmptyState, FormField, Panel, PrimaryButton, TextInput } from "../ui";
import { MixCard, mixPage, PageHead } from "../mix-ui";
import { PopupAction } from "../popup-action";
import { AddFace } from "../round-button";
import { ShoppingListChecklist } from "./shopping-list-checklist";
import { ActionForm } from "@/app/components/action-form";

export default async function DashboardShoppingListPage() {
  const { role, activeBarId, billingStatus, features } = await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Lista ordini">
        <EmptyState message="Seleziona un locale attivo per gestire la lista ordini." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequired role={String(role)} />;
  }

  if (!features.shoppingList) {
    return (
      <Panel title="Lista ordini">
        <EmptyState message="Modulo lista ordini disattivato nelle impostazioni." />
      </Panel>
    );
  }

  const items = await prisma.shoppingListItem.findMany({
    where: { barId: activeBarId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      quantity: true,
      createdBy: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  return (
    <div className="workbit-shopping-list-page" style={mixPage}>
      <PageHead
        title="Lista ordini"
        actions={
          <PopupAction title="Aggiungi articolo" ariaLabel="Aggiungi articolo" triggerRow={<AddFace />}>
            <ActionForm action={createShoppingListItemAction} success="Aggiunto alla lista della spesa." style={{ display: "grid", gap: 12 }}>
              <FormField label="Articolo">
                <TextInput name="name" placeholder="Es. Bottiglie gin" required />
              </FormField>
              <FormField label="Quantità (opzionale)">
                <TextInput name="quantity" placeholder="Es. 6 casse" />
              </FormField>
              <PrimaryButton type="submit">Aggiungi</PrimaryButton>
            </ActionForm>
          </PopupAction>
        }
      />

      <MixCard title="Da ordinare" aside={items.length || null}>
        {items.length === 0 ? (
          <p style={{ margin: "4px 0 6px", fontSize: 14.5, color: "#667085" }}>Nessun articolo in lista: aggiungilo col +.</p>
        ) : (
          <ShoppingListChecklist
            items={items.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              createdByName: item.createdBy ? `${item.createdBy.firstName} ${item.createdBy.lastName}` : "Terminale",
            }))}
          />
        )}
      </MixCard>
    </div>
  );
}
