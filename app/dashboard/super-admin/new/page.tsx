import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";
import { OwnerBarWizard } from "./owner-bar-wizard";

export default async function SuperAdminNewOwnerBarPage() {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  const owners = await prisma.user.findMany({
    where: { role: Role.OWNER },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  return (
    <SuperAdminFrame
      title="Nuovo titolare e locale"
      description="Crea un titolare (o scegline uno esistente) e il suo primo locale in un'unica sequenza, con la possibilità di aggiungere subito altri titolari."
      section="new"
    >
      <OwnerBarWizard owners={owners} />
    </SuperAdminFrame>
  );
}
