import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLanguageOptions } from "@/lib/i18n";
import { getDashboardContext } from "../../context";
import { createOwnerBySuperAdminAction } from "../../actions";
import { Empty, Field, FieldGrid, Figure, FigureBand, Forbidden, Note, Row, Section } from "../console-ui";
import { fullName, readParam, roleLabel } from "../console-data";

const FEEDBACK: Record<string, string> = {
  "owner-created": "Titolare creato: ha ricevuto le credenziali via email.",
  "owner-created-email-failed": "Titolare creato, ma l'email di benvenuto non è partita.",
  "owner-exists": "Esiste già un account con questa email.",
};

export default async function ConsolePeoplePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <Forbidden />;
  }

  const params = searchParams ? await searchParams : {};
  const query = readParam(params.q).trim();
  const success = readParam(params.success);
  const error = readParam(params.error);

  const staffWhere = query
    ? {
        isActive: true,
        user: {
          is: {
            OR: [
              { firstName: { contains: query, mode: "insensitive" as const } },
              { lastName: { contains: query, mode: "insensitive" as const } },
              { email: { contains: query, mode: "insensitive" as const } },
            ],
          },
        },
      }
    : { isActive: true };

  const [owners, staff, staffTotal, venues] = await Promise.all([
    prisma.user.findMany({
      where: { role: Role.OWNER },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        mustChangePwd: true,
        _count: { select: { ownedBars: true } },
      },
    }),
    prisma.employeeBar.findMany({
      where: staffWhere,
      orderBy: [{ role: "asc" }, { hiredAt: "desc" }],
      take: 60,
      select: {
        id: true,
        role: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        bar: { select: { id: true, name: true } },
      },
    }),
    prisma.employeeBar.count({ where: { isActive: true } }),
    // The staff live on their venue's page; here each venue is one line.
    prisma.bar.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        city: true,
        memberships: { where: { isActive: true }, select: { role: true } },
      },
    }),
  ]);

  const languageOptions = getLanguageOptions();

  return (
    <div className="wbc-page">
      <div className="wbc-page-head">
        <h1 className="wbc-title">Persone</h1>
        <p className="wbc-desc">
          I titolari della rete e, per ogni locale, le sue persone. Si aprono dal locale, dove si aggiungono e si
          tolgono.
        </p>
      </div>

      <FigureBand>
        <Figure label="Titolari" value={owners.length} meta="account proprietari" />
        <Figure label="Collegamenti" value={staffTotal} meta="persone nei locali" />
        <Figure
          label="Da attivare"
          value={owners.filter((owner) => owner.mustChangePwd).length}
          meta="password iniziale"
          tone={owners.some((owner) => owner.mustChangePwd) ? "warning" : "neutral"}
        />
      </FigureBand>

      {success ? (
        <div style={{ marginTop: 16 }}>
          <Note tone="positive">{FEEDBACK[success] ?? "Operazione completata."}</Note>
        </div>
      ) : null}
      {error ? (
        <div style={{ marginTop: 16 }}>
          <Note tone="negative">{FEEDBACK[error] ?? "Operazione non riuscita."}</Note>
        </div>
      ) : null}

      <Section title="Nuovo titolare">
        <form action={createOwnerBySuperAdminAction} style={{ display: "grid", gap: 15 }}>
          <FieldGrid>
            <Field label="Nome">
              <input name="firstName" required autoComplete="off" />
            </Field>
            <Field label="Cognome">
              <input name="lastName" required autoComplete="off" />
            </Field>
            <Field label="Email" span>
              <input name="email" type="email" required autoComplete="off" />
            </Field>
            <Field label="Lingua">
              <select name="language" defaultValue={languageOptions[0]?.value}>
                {languageOptions.map((option) => (
                  <option key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </FieldGrid>

          <button type="submit" className="wbc-btn wbc-btn-ghost">
            Crea titolare
          </button>
        </form>
      </Section>

      <Section title={`Titolari · ${owners.length}`}>
        <div>
          {owners.length === 0 ? (
            <Empty>Nessun titolare registrato.</Empty>
          ) : (
            owners.map((owner) => (
              <Row
                key={owner.id}
                title={fullName(owner)}
                meta={owner.email}
                valueMeta={`${owner._count.ownedBars} ${owner._count.ownedBars === 1 ? "locale" : "locali"}`}
              />
            ))
          )}
        </div>
      </Section>

      <Section title={query ? `Ricerca · ${staff.length}` : `Personale per locale · ${venues.length}`}>
        <form method="GET" className="wbc-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input type="search" name="q" defaultValue={query} placeholder="Cerca una persona per nome o email" />
        </form>

        {query ? (
          <div>
            {staff.length === 0 ? (
              <Empty>Nessuna persona trovata.</Empty>
            ) : (
              staff.map((member) => (
                <Row
                  key={member.id}
                  href={`/dashboard/super-admin/bar/${member.bar.id}`}
                  title={fullName(member.user)}
                  meta={`${member.user.email} · ${roleLabel(member.role)}`}
                  valueMeta={member.bar.name}
                />
              ))
            )}
          </div>
        ) : (
          <div>
            {venues.length === 0 ? (
              <Empty>Nessun locale.</Empty>
            ) : (
              venues.map((venue) => {
                const counts = new Map<string, number>();
                for (const membership of venue.memberships) {
                  const label = roleLabel(membership.role);
                  counts.set(label, (counts.get(label) ?? 0) + 1);
                }
                const breakdown = [...counts.entries()].map(([label, count]) => `${count} ${label.toLowerCase()}`).join(" · ");
                return (
                  <Row
                    key={venue.id}
                    href={`/dashboard/super-admin/bar/${venue.id}`}
                    title={venue.name}
                    meta={[venue.city, breakdown || "nessuna persona"].filter(Boolean).join(" · ")}
                    value={`${venue.memberships.length}`}
                    valueMeta={venue.memberships.length === 1 ? "persona" : "persone"}
                  />
                );
              })
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
