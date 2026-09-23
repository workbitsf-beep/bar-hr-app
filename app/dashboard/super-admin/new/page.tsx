import { Role } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getLanguageOptions } from "@/lib/i18n";
import { getDashboardContext } from "../../context";
import { Forbidden } from "../console-ui";
import { NewVenueForm } from "./new-venue-form";

export default async function ConsoleNewVenuePage() {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <Forbidden />;
  }

  const owners = await prisma.user.findMany({
    where: { role: Role.OWNER },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const languageOptions = getLanguageOptions().map((option) => ({
    value: String(option.value),
    label: option.label,
  }));

  return (
    <div className="wbc-page">
      <Link href="/dashboard/super-admin" className="wbc-back">
        ← Rete
      </Link>

      <div className="wbc-page-head">
        <h1 className="wbc-title">Nuovo locale</h1>
        <p className="wbc-desc">
          Collega il locale a un titolare esistente oppure crea insieme titolare e locale in un solo passaggio.
        </p>
      </div>

      <NewVenueForm owners={owners} languageOptions={languageOptions} />
    </div>
  );
}
