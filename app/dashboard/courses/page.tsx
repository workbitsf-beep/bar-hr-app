import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageTrainingAndDocuments } from "@/lib/permissions";
import { createCourseAction, deleteCourseAction } from "../actions";
import { getDashboardContext } from "../context";
import { CourseComposeForm } from "./course-compose-form";
import {
  BillingRequiredState,
  EmptyState,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Stack,
  SuccessCallout,
  formatDateTime,
} from "../ui";
import { PopupAction } from "../popup-action";

export default async function DashboardCoursesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const success = Array.isArray(params.success) ? params.success[0] : params.success;
  const { session, role, activeBarId, billingStatus, features } =
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

  if (!features.courses) {
    return (
      <Panel title="Corsi">
        <EmptyState message="Modulo corsi disattivato nelle impostazioni." />
      </Panel>
    );
  }

  const canManage = canManageTrainingAndDocuments(role as Role);
  const successMessage = success === "course-created" ? "Corso salvato correttamente." : null;
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
      {successMessage ? <SuccessCallout>{successMessage}</SuccessCallout> : null}

      <Panel
        title="Corsi pianificati"
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span>{courses.length} corsi</span>
            {canManage ? (
              <PopupAction title="Nuovo corso" ariaLabel="Aggiungi corso">
                <CourseComposeForm
                  action={createCourseAction}
                  members={members.map((member) => ({
                    id: member.user.id,
                    label: `${member.user.firstName} ${member.user.lastName} - ${member.role}`,
                  }))}
                />
              </PopupAction>
            ) : null}
          </div>
        }
      >
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
