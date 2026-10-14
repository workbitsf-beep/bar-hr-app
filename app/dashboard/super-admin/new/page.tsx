import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getLanguageOptions } from "@/lib/i18n";
import { getDashboardContext } from "../../context";
import { Forbidden, Note } from "../console-ui";
import { NewVenueForm } from "./new-venue-form";

export default async function ConsoleNewVenuePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role } = await getDashboardContext();
  const params = searchParams ? await searchParams : {};
  const wantedOwner = Array.isArray(params.owner) ? params.owner[0] : params.owner;

  if (String(role) !== "SUPER_ADMIN") {
    return <Forbidden />;
  }

  const owners = await prisma.user.findMany({
    // Anyone with an account can be made the owner, an employee included.
    where: { retiredAt: null },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  // Sent here from "Nuovo titolare" with an email that already had an account.
  const preselected = owners.find((owner) => owner.id === wantedOwner) ?? null;

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

      {preselected ? (
        <Note tone="positive">
          {preselected.firstName} {preselected.lastName} ha già un account ({preselected.email}): crea qui il suo
          locale e ne diventa titolare, con la password di sempre.
        </Note>
      ) : null}

      <NewVenueForm owners={owners} languageOptions={languageOptions} preselectedOwnerId={preselected?.id ?? null} />
    </div>
  );
}
