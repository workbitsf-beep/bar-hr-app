import { Role } from "@prisma/client";
import { ActionForm } from "@/app/components/action-form";
import { prisma } from "@/lib/prisma";
import { ensurePins } from "@/lib/terminal/terminal";
import { getDashboardContext } from "../context";
import { MixCard, MixRows, mixPage, PageHead, Pill, Stacked } from "../mix-ui";
import { EmptyState, Panel } from "../ui";
import { revokeTerminalAction, setPersonPinAction, setTerminalPinRuleAction } from "./actions";
import { PairingCode } from "./pairing-code";

export const dynamic = "force-dynamic";

const seen = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

const smallButton = {
  minHeight: 36,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #dcd6f3",
  background: "#fbfaff",
  color: "#4c1d95",
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
} as const;

/**
 * The owner's side of the terminal: which devices are paired, whether notes
 * done there need a PIN, and everyone's PIN - the owner hands them out.
 */
export default async function TerminalSettingsPage() {
  const { role, activeBarId } = await getDashboardContext();
  if (!activeBarId || role !== Role.OWNER) {
    return (
      <Panel title="Terminale">
        <EmptyState message="Il terminale lo imposta il titolare." />
      </Panel>
    );
  }

  await ensurePins(activeBarId);
  const [terminals, settings, members] = await Promise.all([
    prisma.terminal.findMany({ where: { barId: activeBarId, revokedAt: null, tokenHash: { not: null } }, orderBy: { createdAt: "asc" } }),
    prisma.barSettings.findUnique({ where: { barId: activeBarId }, select: { terminalPinForTasks: true } }),
    prisma.employeeBar.findMany({
      where: { barId: activeBarId, isActive: true },
      orderBy: [{ role: "asc" }, { user: { firstName: "asc" } }],
      select: { userId: true, role: true, terminalPin: true, user: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  const pinForTasks = settings?.terminalPinForTasks ?? true;

  return (
    <div style={mixPage}>
      <PageHead title="Terminale" />
      <p style={{ margin: 0, color: "#667085", fontSize: 14.5, lineHeight: 1.5 }}>
        Un tablet o un PC nel locale che mostra a tutti le note da fare, gli avvisi e la lista della spesa, e dove si timbra con il PIN quando il telefono non
        c&apos;è. Turni, documenti e ore non si vedono mai.
      </p>

      <MixCard title="Dispositivi" aside={terminals.length ? String(terminals.length) : undefined}>
        <MixRows>
          {terminals.length ? (
            terminals.map((terminal) => (
              <div key={terminal.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
                <Stacked title={terminal.name} detail={terminal.lastSeenAt ? `Ultimo contatto ${seen.format(terminal.lastSeenAt)}` : "Collegato"} />
                <ActionForm action={revokeTerminalAction} success="Terminale scollegato.">
                  <input type="hidden" name="id" value={terminal.id} />
                  <button type="submit" style={smallButton}>
                    Scollega
                  </button>
                </ActionForm>
              </div>
            ))
          ) : (
            <p style={{ margin: "6px 0", color: "#667085", fontSize: 14 }}>Nessun terminale collegato.</p>
          )}
        </MixRows>
        <PairingCode />
        <p style={{ margin: "10px 0 2px", color: "#667085", fontSize: 13.5, lineHeight: 1.5 }}>
          Sul tablet o sul PC apri <b>app.workbit.it/terminale</b> (oppure l&apos;app Workbit › «Questo dispositivo è un terminale») e scrivi il codice.
        </p>
      </MixCard>

      <MixCard title="PIN per completare le note">
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
          <Stacked
            title={pinForTasks ? "Chiesto" : "Non chiesto"}
            detail={
              pinForTasks
                ? "Chi completa una nota o aggiunge alla spesa scrive il suo PIN: sai chi è stato."
                : "Chiunque completa senza PIN: la nota risulta fatta «dal terminale»."
            }
          />
          <ActionForm action={setTerminalPinRuleAction} success={pinForTasks ? "Il PIN non viene più chiesto per le note." : "Il PIN viene chiesto per le note."}>
            <input type="hidden" name="on" value={pinForTasks ? "0" : "1"} />
            <button type="submit" style={smallButton}>
              {pinForTasks ? "Non chiederlo" : "Chiedilo"}
            </button>
          </ActionForm>
        </div>
        <p style={{ margin: "2px 0 4px", color: "#667085", fontSize: 13.5 }}>Per timbrare il PIN serve sempre.</p>
      </MixCard>

      <MixCard title="PIN delle persone" aside="li dai tu">
        <MixRows>
          {members.map((member) => (
            <ActionForm
              key={member.userId}
              action={setPersonPinAction}
              success={`PIN di ${member.user.firstName} salvato.`}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", flexWrap: "wrap" }}
            >
              <input type="hidden" name="userId" value={member.userId} />
              <Stacked
                title={`${member.user.firstName} ${member.user.lastName}`}
                detail={member.role === Role.OWNER ? "Titolare: completa le note, non timbra" : undefined}
              />
              {member.terminalPin ? <Pill tone="violet">{member.terminalPin}</Pill> : <Pill>nessuno</Pill>}
              <input
                name="pin"
                inputMode="numeric"
                pattern="\d{4,6}"
                maxLength={6}
                placeholder="nuovo"
                aria-label={`Nuovo PIN di ${member.user.firstName}`}
                style={{ width: 84, minHeight: 36, borderRadius: 10, border: "1px solid #dcd6f3", padding: "0 10px", fontSize: 14 }}
              />
              <button type="submit" style={smallButton} title="Vuoto: ne sceglie uno Workbit">
                Salva
              </button>
            </ActionForm>
          ))}
        </MixRows>
        <p style={{ margin: "8px 0 4px", color: "#667085", fontSize: 13.5 }}>
          Da 4 a 6 cifre, diverso per ognuno. Lascia vuoto e premi Salva per farne scegliere uno nuovo a Workbit.
        </p>
      </MixCard>
    </div>
  );
}
