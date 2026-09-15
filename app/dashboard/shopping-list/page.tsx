import { prisma } from "@/lib/prisma";
import { createShoppingListItemAction } from "../actions";
import { getDashboardContext } from "../context";
import {
  BillingRequiredState,
  EmptyState,
  FormField,
  Panel,
  PrimaryButton,
  Stack,
  TextInput,
} from "../ui";
import { ShoppingListChecklist } from "./shopping-list-checklist";

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
    return <BillingRequiredState role={String(role)} />;
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
    <Stack className="workbit-shopping-list-page">
      <Panel title="Aggiungi articolo">
        <form action={createShoppingListItemAction} style={{ display: "grid", gap: 12 }}>
          <div
            className="dashboard-inline-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}
          >
            <FormField label="Articolo">
              <TextInput name="name" placeholder="Es. Bottiglie gin" required />
            </FormField>
            <FormField label="Quantità (opzionale)">
              <TextInput name="quantity" placeholder="Es. 6 casse" />
            </FormField>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <PrimaryButton type="submit">Aggiungi</PrimaryButton>
          </div>
        </form>
      </Panel>

      <Panel title="Lista ordini" className="workbit-shopping-list-panel">
        {items.length === 0 ? (
          <EmptyState message="Nessun articolo in lista." />
        ) : (
          <ShoppingListChecklist
            items={items.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              createdByName: `${item.createdBy.firstName} ${item.createdBy.lastName}`,
            }))}
          />
        )}
      </Panel>
    </Stack>
  );
}
