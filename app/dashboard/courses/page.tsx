import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createCourseAction, deleteCourseAction } from "../actions";
import { getDashboardContext } from "../context";
import {
  BillingRequiredState,
  EmptyState,
  FormField,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Select,
  Stack,
  TextArea,
  TextInput,
  formatDateTime,
} from "../ui";

export default async function DashboardCoursesPage() {
  const { session, role, activeBarId, billingStatus } =
    await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Corsi">
        <EmptyState message="Seleziona un locale attivo per gestire i corsi." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  const canManage = role === Role.OWNER || role === Role.MANAGER;
  const [courses, members] = await Promise.all([
    prisma.course.findMany({
      where: {
        barId: activeBarId,
        ...(canManage
          ? {}
          : {
              OR: [{ assignedToAll: true }, { assignedToId: session.user.id }],
            }),
      },
      orderBy: {
        startsAt: "asc",
      },
      include: {
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    canManage
      ? prisma.employeeBar.findMany({
          where: {
            barId: activeBarId,
            isActive: true,
            role: {
              not: Role.OWNER,
            },
          },
          orderBy: [{ role: "asc" }, { hiredAt: "asc" }],
          select: {
            role: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <Stack>
      {canManage ? (
        <Panel title="Nuovo corso">
          <form action={createCourseAction} style={{ display: "grid", gap: 16 }}>
            <FormField label="Titolo corso">
              <TextInput name="title" required placeholder="Sicurezza sul lavoro" />
            </FormField>

            <FormField label="Informazioni">
              <TextArea
                name="description"
                placeholder="Dettagli, materiale richiesto, note operative"
              />
            </FormField>

            <div
              className="dashboard-inline-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <FormField label="Inizio">
                <TextInput name="startsAt" type="datetime-local" required />
              </FormField>

              <FormField label="Fine">
                <TextInput name="endsAt" type="datetime-local" required />
              </FormField>

              <FormField label="Luogo">
                <TextInput name="location" placeholder="Aula, sede o link" />
              </FormField>

              <FormField label="Assegna a">
                <Select name="assignedToId" defaultValue="">
                  <option value="">Nessun singolo assegnatario</option>
                  {members.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.firstName} {member.user.lastName} - {member.role}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="assignedToAll" />
              Assegna a tutto il team
            </label>

            <div className="dashboard-form-actions">
              <PrimaryButton type="submit">Salva corso</PrimaryButton>
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel title="Corsi pianificati" action={`${courses.length} corsi`}>
        {courses.length === 0 ? (
          <EmptyState message="Nessun corso pianificato." />
        ) : (
          <ItemList scrollable>
            {courses.map((course) => (
              <ItemCard
                key={course.id}
                title={course.title}
                subtitle={`${formatDateTime(course.startsAt)} - ${formatDateTime(course.endsAt)}`}
                meta={
                  <>
                    {course.assignedToAll
                      ? "Assegnato a tutto il team"
                      : course.assignedTo
                        ? `Assegnato a ${course.assignedTo.firstName} ${course.assignedTo.lastName}`
                        : "Non assegnato"}
                    <br />
                    Creato da {course.createdBy.firstName} {course.createdBy.lastName}
                    {course.location ? (
                      <>
                        <br />
                        Luogo: {course.location}
                      </>
                    ) : null}
                  </>
                }
                footer={
                  <div style={{ display: "grid", gap: 12 }}>
                    {course.description ? (
                      <div style={{ color: "#334155", lineHeight: 1.6 }}>
                        {course.description}
                      </div>
                    ) : null}
                    {canManage ? (
                      <form action={deleteCourseAction}>
                        <input type="hidden" name="courseId" value={course.id} />
                        <PrimaryButton type="submit" tone="red">
                          Elimina corso
                        </PrimaryButton>
                      </form>
                    ) : null}
                  </div>
                }
              />
            ))}
          </ItemList>
        )}
      </Panel>
    </Stack>
  );
}
