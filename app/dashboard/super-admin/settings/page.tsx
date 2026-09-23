import { Role } from "@prisma/client";
import Link from "next/link";
import { WebAuthnRegistrationPanel } from "@/app/components/webauthn-registration-panel";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { PasswordChangePanel } from "../../settings/password-change-panel";
import { Empty, Forbidden, Note, Row, Section } from "../console-ui";
import { fullName, readParam } from "../console-data";
import { PromoteSuperAdminForm } from "./promote-super-admin-form";

async function getPasskeyCount(userId: string) {
  try {
    return await prisma.webAuthnCredential.count({ where: { userId } });
  } catch {
    return 0;
  }
}

export default async function ConsoleSecurityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role, session } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <Forbidden />;
  }

  const params = searchParams ? await searchParams : {};
  const success = readParam(params.success);
  const error = readParam(params.error);

  const [passkeyCount, superAdmins] = await Promise.all([
    getPasskeyCount(session.user.id),
    prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ]);

  return (
    <div className="wbc-page">
      <Link href="/dashboard/super-admin/system" className="wbc-back">
        ← Sistema
      </Link>

      <div className="wbc-page-head">
        <h1 className="wbc-title">Sicurezza</h1>
        <p className="wbc-desc">Password, accesso biometrico e gestione degli altri account super admin.</p>
      </div>

      <Section title="Password">
        <PasswordChangePanel />
      </Section>

      <Section title="Impronta e Face ID">
        <WebAuthnRegistrationPanel initialPasskeyCount={passkeyCount} />
      </Section>

      <Section title={`Super admin · ${superAdmins.length}`}>
        {success === "super-admin-added" ? <Note tone="positive">Account promosso a super admin.</Note> : null}
        {error === "super-admin-user-not-found" ? (
          <Note tone="negative">Nessun account trovato con questa email.</Note>
        ) : null}

        <div>
          {superAdmins.length === 0 ? (
            <Empty>Nessun super admin registrato.</Empty>
          ) : (
            superAdmins.map((admin) => (
              <Row
                key={admin.id}
                title={fullName(admin)}
                meta={admin.email}
                valueMeta={admin.id === session.user.id ? "tu" : undefined}
              />
            ))
          )}
        </div>

        <PromoteSuperAdminForm />
      </Section>
    </div>
  );
}
