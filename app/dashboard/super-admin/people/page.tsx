import { ActivityType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { removeEmployeeBySuperAdminAction } from "../../actions";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";
import { BarPicker } from "./bar-picker";
import { AddEmployeeForm } from "./add-employee-form";

function formatRoleLabel(role: Role) {
  if (role === Role.OWNER) return "Titolare";
  if (role === Role.MANAGER) return "Responsabile";
  if (role === Role.AMMINISTRAZIONE) return "Amministrazione";
  return "Dipendente";
}

export default async function SuperAdminPeoplePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  const params = searchParams ? await searchParams : {};
  const barId = Array.isArray(params.barId) ? params.barId[0] : params.barId ?? "";

  const bars = await prisma.bar.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, activityType: true },
  });

  const activeBar = bars.find((bar) => bar.id === barId) ?? null;

  const members = activeBar
    ? await prisma.employeeBar.findMany({
        where: { barId: activeBar.id, isActive: true },
        orderBy: [{ role: "asc" }, { hiredAt: "asc" }],
        select: {
          id: true,
          role: true,
          user: { select: { firstName: true, lastName: true, email: true, mustChangePwd: true } },
        },
      })
    : [];

  return (
    <SuperAdminFrame
      title="Dipendenti"
      description="Gestisci il personale di qualsiasi locale: crea, collega o rimuovi account senza dover accedere come titolare."
      section="people"
    >
      <div style={{ display: "grid", gap: 18 }}>
        <BarPicker bars={bars} activeBarId={activeBar?.id ?? ""} />

        {!activeBar ? (
          <div style={{ color: "#9296b8", fontSize: 14 }}>Seleziona un locale per vedere il suo personale.</div>
        ) : (
          <>
            <div className="dashboard-panel" style={{ display: "grid", gap: 14, padding: 18, borderRadius: 18 }}>
              <strong style={{ fontSize: 15 }}>Aggiungi persona a {activeBar.name}</strong>
              <AddEmployeeForm barId={activeBar.id} isCompany={activeBar.activityType === ActivityType.COMPANY} />
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {members.length === 0 ? (
                <div style={{ color: "#9296b8", fontSize: 14 }}>Nessuna persona collegata a questo locale.</div>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="dashboard-item-card"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
                  >
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong>{member.user.firstName} {member.user.lastName}</strong>
                      <span>{member.user.email}</span>
                      <span>
                        {formatRoleLabel(member.role)} · {member.user.mustChangePwd ? "Password iniziale da cambiare" : "Password aggiornata"}
                      </span>
                    </div>
                    {member.role !== Role.OWNER ? (
                      <form action={removeEmployeeBySuperAdminAction}>
                        <input type="hidden" name="membershipId" value={member.id} />
                        <button
                          type="submit"
                          style={{
                            borderRadius: 999,
                            border: "1px solid rgba(248, 113, 113, 0.4)",
                            background: "rgba(248, 113, 113, 0.12)",
                            color: "#fca5a5",
                            padding: "9px 16px",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Rimuovi dal locale
                        </button>
                      </form>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </SuperAdminFrame>
  );
}
