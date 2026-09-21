import { Role } from "@prisma/client";
import { WebAuthnRegistrationPanel } from "@/app/components/webauthn-registration-panel";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { PasswordChangePanel } from "../../settings/password-change-panel";
import { Panel, Stack } from "../../ui";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";
import { PromoteSuperAdminForm } from "./promote-super-admin-form";

async function getPasskeyCount(userId: string) {
  try {
    return await prisma.webAuthnCredential.count({ where: { userId } });
  } catch {
    return 0;
  }
}

export default async function SuperAdminSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role, session } = await getDashboardContext();

  if (role !== Role.SUPER_ADMIN) {
    return <SuperAdminForbidden />;
  }

  const params = searchParams ? await searchParams : {};
  const success = Array.isArray(params.success) ? params.success[0] : params.success;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const passkeyCount = await getPasskeyCount(session.user.id);

  return (
    <SuperAdminFrame
      title="Impostazioni"
      description="Sicurezza dell'account Super Admin e gestione degli accessi futuri."
      section="settings"
    >
      <Stack columns="minmax(0, 1fr)">
        <PasswordChangePanel />

        <Panel title="Accesso biometrico">
          <WebAuthnRegistrationPanel initialPasskeyCount={passkeyCount} />
        </Panel>

        <Panel title="Altri super admin">
          <div style={{ display: "grid", gap: 12 }}>
            <p style={{ margin: 0, color: "#9296b8", fontSize: 13.5, lineHeight: 1.5 }}>
              Rendi super admin un account già esistente in Workbit (cerca per email).
            </p>
            {success === "super-admin-added" ? (
              <p style={{ margin: 0, color: "#34d399", fontSize: 13.5, fontWeight: 600 }}>
                Account promosso a super admin.
              </p>
            ) : null}
            {error === "super-admin-user-not-found" ? (
              <p style={{ margin: 0, color: "#f87171", fontSize: 13.5, fontWeight: 600 }}>
                Nessun account trovato con questa email.
              </p>
            ) : null}
            <PromoteSuperAdminForm />
          </div>
        </Panel>
      </Stack>
    </SuperAdminFrame>
  );
}
