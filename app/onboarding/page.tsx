import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ActivityType, RoundingMode, Role } from "@prisma/client";
import { GpsLocationField } from "@/app/components/gps-location-field";
import { PendingButton } from "@/app/components/pending-button";
import { SessionKeepAlive } from "@/app/components/session-keepalive";
import { getSession } from "@/lib/auth";
import {
  sendEmployeeWelcomeEmail,
  sendOwnerWelcomeEmail,
} from "@/lib/email/notifications";
import { getGlobalGpsRadius } from "@/lib/gps-settings";
import { prisma } from "@/lib/prisma";
import {
  createTemporaryPassword,
} from "@/lib/temporary-password";

type StepNumber = 1 | 2 | 3 | 4;

function hasCompletedRoundingSetup(
  settings:
    | Awaited<ReturnType<typeof getOwnerContext>>["activeBar"]["settings"]
    | null
    | undefined
) {
  return Boolean(
    settings &&
      settings.roundingMinutes !== null &&
      settings.roundingMode !== null
  );
}

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getOwnerContext() {
  const session = await getSession();

  if (!session) {
    redirect("/dashboard");
  }

  if (session.user.role !== Role.OWNER) {
    redirect("/dashboard");
  }

  const ownedBars = await prisma.bar.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        {
          memberships: {
            some: {
              userId: session.user.id,
              role: Role.OWNER,
              isActive: true,
            },
          },
        },
      ],
    },
    include: {
      settings: true,
      memberships: {
        where: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const activeBar =
    ownedBars.find((bar) => bar.id === session.activeBarId) ?? ownedBars[0] ?? null;

  return { session, ownedBars, activeBar };
}

function getCurrentStep(activeBar: Awaited<ReturnType<typeof getOwnerContext>>["activeBar"]): StepNumber {
  if (!activeBar) {
    return 1;
  }

  const requiresGps = activeBar.activityType === ActivityType.RESTAURANT;

  if (
    requiresGps &&
    (!activeBar.settings ||
      activeBar.settings.gpsLatitude === null ||
      activeBar.settings.gpsLongitude === null ||
      activeBar.settings.gpsRadius === null)
  ) {
    return 2;
  }

  if (!hasCompletedRoundingSetup(activeBar.settings)) {
    return 3;
  }

  return 4;
}

async function createBarAction(formData: FormData) {
  "use server";

  const session = await getSession();

  if (!session || session.user.role !== Role.OWNER) {
    redirect("/dashboard");
  }

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    redirect("/onboarding?error=missing-bar-name");
  }

  const globalGpsRadius = await getGlobalGpsRadius();

  const bar = await prisma.bar.create({
    data: {
      name,
      latitude: 0,
      longitude: 0,
      radiusMeters: globalGpsRadius,
      roundingEnabled: false,
      entryToleranceMin: 5,
      roundingStepMin: 15,
      exitToleranceMin: 13,
      ownerId: session.user.id,
      settings: {
        create: {
          gpsRadius: globalGpsRadius,
        },
      },
      memberships: {
        create: {
          userId: session.user.id,
          role: Role.OWNER,
          isActive: true,
        },
      },
    },
    select: { id: true },
  });

  await prisma.session.update({
    where: { id: session.id },
    data: { activeBarId: bar.id },
  });

  revalidatePath("/onboarding");
  redirect("/onboarding?step=2");
}

async function saveGpsAction(formData: FormData) {
  "use server";

  const { session, activeBar } = await getOwnerContext();

  if (!activeBar) {
    redirect("/onboarding");
  }

  if (activeBar.activityType !== ActivityType.RESTAURANT) {
    redirect("/onboarding?step=3");
  }

  const gpsLatitude = parseNumber(formData.get("gpsLatitude"));
  const gpsLongitude = parseNumber(formData.get("gpsLongitude"));
  const gpsRadius = await getGlobalGpsRadius();

  if (gpsLatitude === null || gpsLongitude === null) {
    redirect("/onboarding?step=2&error=invalid-gps");
  }

  await prisma.$transaction([
    prisma.bar.update({
      where: { id: activeBar.id },
      data: {
        latitude: gpsLatitude,
        longitude: gpsLongitude,
        radiusMeters: gpsRadius,
      },
    }),
    prisma.barSettings.upsert({
      where: { barId: activeBar.id },
      update: {
        gpsLatitude,
        gpsLongitude,
        gpsRadius,
      },
      create: {
        barId: activeBar.id,
        gpsLatitude,
        gpsLongitude,
        gpsRadius,
      },
    }),
    prisma.session.update({
      where: { id: session.id },
      data: { activeBarId: activeBar.id },
    }),
  ]);

  revalidatePath("/onboarding");
  redirect("/onboarding?step=3");
}

async function saveRoundingAction(formData: FormData) {
  "use server";

  const { activeBar } = await getOwnerContext();

  if (!activeBar) {
    redirect("/onboarding");
  }

  const roundingEnabled = formData.get("roundingEnabled") === "on";
  const roundingMinutes = 15;
  const roundingMode = RoundingMode.NEAREST;

  await prisma.$transaction([
    prisma.bar.update({
      where: { id: activeBar.id },
      data: {
        roundingEnabled,
        roundingStepMin: roundingMinutes,
      },
    }),
    prisma.barSettings.upsert({
      where: { barId: activeBar.id },
      update: {
        roundingEnabled,
        roundingMinutes,
        roundingMode,
      },
      create: {
        barId: activeBar.id,
        roundingEnabled,
        roundingMinutes,
        roundingMode,
      },
    }),
  ]);

  revalidatePath("/onboarding");
  redirect("/onboarding?step=4");
}

async function inviteEmployeeAction(formData: FormData) {
  "use server";

  const { activeBar } = await getOwnerContext();

  if (!activeBar) {
    redirect("/onboarding");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "");
  const memberRole =
    roleRaw === "OWNER"
      ? Role.OWNER
      : roleRaw === "MANAGER"
        ? Role.MANAGER
        : Role.EMPLOYEE;

  if (!email || !firstName || !lastName) {
    redirect("/onboarding?step=4&error=missing-employee");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    await prisma.employeeBar.upsert({
      where: {
        userId_barId: {
          userId: existingUser.id,
          barId: activeBar.id,
        },
      },
      update: {
        role: memberRole,
        isActive: true,
        endedAt: null,
      },
      create: {
        userId: existingUser.id,
        barId: activeBar.id,
        role: memberRole,
        isActive: true,
      },
    });

    revalidatePath("/onboarding");
    redirect("/onboarding?step=4");
  }

  const temporaryPassword = createTemporaryPassword();
  const passwordHash = await import("bcrypt").then((module) =>
    module.default.hash(temporaryPassword, 10)
  );

  let createdUser = false;

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        firstName,
        lastName,
        role: memberRole,
        mustChangePwd: true,
        passwordHash,
      },
      select: { id: true },
    });

    createdUser = true;

    await tx.employeeBar.create({
      data: {
        userId: user.id,
        barId: activeBar.id,
        role: memberRole,
        isActive: true,
      },
    });
  });

  if (createdUser) {
    try {
      if (memberRole === Role.OWNER) {
        await sendOwnerWelcomeEmail(
          email,
          `${firstName} ${lastName}`.trim(),
          activeBar.name,
          email,
          temporaryPassword
        );
      } else {
        await sendEmployeeWelcomeEmail(
          email,
          `${firstName} ${lastName}`.trim(),
          activeBar.name,
          email,
          temporaryPassword
        );
      }
    } catch (error) {
      console.error(
        memberRole === Role.OWNER
          ? "[welcome-email] owner failed"
          : "[welcome-email] employee failed",
        {
        recipient: email,
        error: error instanceof Error ? error.message : "Unexpected welcome email error.",
      }
      );
    }
  }

  revalidatePath("/onboarding");
  redirect("/onboarding?step=4");
}

async function finishOnboardingAction() {
  "use server";

  const { activeBar } = await getOwnerContext();

  if (!activeBar) {
    redirect("/onboarding");
  }

  redirect("/dashboard/calendar");
}

function StepShell({
  currentStep,
  steps,
  children,
}: {
  currentStep: StepNumber;
  steps: Array<{ id: StepNumber; title: string }>;
  children: ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background:
          "linear-gradient(180deg, #f8f2e6 0%, #efe5d3 45%, #f7f4ec 100%)",
      }}
    >
      <SessionKeepAlive />
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          display: "grid",
          gap: 24,
        }}
      >
        <header
          style={{
            background: "#1f2937",
            color: "#f8fafc",
            borderRadius: 24,
            padding: 24,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 32 }}>Configurazione iniziale</h1>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {steps.map((step) => {
            const isActive = currentStep === step.id;
            const isDone = currentStep > step.id;

            return (
              <div
                key={step.id}
                style={{
                  borderRadius: 18,
                  padding: 16,
                  background: isActive
                    ? "#1f2937"
                    : isDone
                      ? "#d8efe0"
                      : "#fffdf8",
                  color: isActive ? "#fff" : "#1f2937",
                  border: "1px solid #e8dec9",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                  }}
                >
                  {step.title}
                </div>
              </div>
            );
          })}
        </section>

        {children}
      </div>
    </main>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        background: "#fffdf8",
        border: "1px solid #eadfc9",
        borderRadius: 24,
        padding: 24,
        boxShadow: "0 10px 30px rgba(74, 58, 27, 0.08)",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 24 }}>{title}</h2>
      {subtitle ? (
        <p style={{ margin: "10px 0 0", color: "#6b7280", lineHeight: 1.6 }}>
          {subtitle}
        </p>
      ) : null}
      <div style={{ marginTop: 20 }}>{children}</div>
    </section>
  );
}

function Input({
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
  minLength,
  required,
  autoComplete,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  type?: string;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        minLength={minLength}
        required={required}
        autoComplete={autoComplete}
        style={{
          borderRadius: 14,
          border: "1px solid #d9cdb8",
          padding: "12px 14px",
          fontSize: 15,
          background: "#fff",
        }}
      />
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  return (
    <PendingButton
      type="submit"
      pendingLabel="Invio in corso..."
      style={{
        background: "#1f2937",
        color: "#fff",
        border: 0,
        borderRadius: 999,
        padding: "12px 18px",
        fontWeight: 700,
      }}
      idleStyle={{
        cursor: "pointer",
        opacity: 1,
      }}
      pendingStyle={{
        cursor: "default",
        opacity: 0.7,
      }}
    >
      {label}
    </PendingButton>
  );
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const { activeBar } = await getOwnerContext();
  const globalGpsRadius = await getGlobalGpsRadius();
  const showGpsStep = activeBar?.activityType !== ActivityType.COMPANY;
  const onboardingSteps = showGpsStep
    ? ([
        { id: 1 as StepNumber, title: "Locale" },
        { id: 2 as StepNumber, title: "Posizione" },
        { id: 3 as StepNumber, title: "Arrotondamento" },
        { id: 4 as StepNumber, title: "Team" },
      ] as const)
    : ([
        { id: 1 as StepNumber, title: "Locale" },
        { id: 3 as StepNumber, title: "Arrotondamento" },
        { id: 4 as StepNumber, title: "Team" },
      ] as const);
  const teamMembers = activeBar?.memberships ?? [];
  const invitedMembers =
    activeBar?.memberships.filter((membership) => membership.role !== Role.OWNER) ?? [];
  const ownerMembers = teamMembers.filter((membership) => membership.role === Role.OWNER);
  const computedStep = getCurrentStep(activeBar);
  const requestedStepRaw = Array.isArray(params.step) ? params.step[0] : params.step;
  const requestedStep = requestedStepRaw ? Number(requestedStepRaw) : computedStep;
  const currentStep =
    requestedStep >= computedStep && requestedStep <= 4
      ? (requestedStep as StepNumber)
      : computedStep;

  if (computedStep === 4 && activeBar && invitedMembers.length > 0 && requestedStepRaw === "done") {
    redirect("/dashboard");
  }

  return (
    <StepShell currentStep={currentStep} steps={[...onboardingSteps]}>
      {currentStep === 1 ? (
        <Card
          title="Crea il locale"
        >
          <form action={createBarAction} style={{ display: "grid", gap: 16 }}>
            <Input
              name="name"
              label="Nome locale"
              placeholder="Nome del locale"
            />
            <div>
              <SubmitButton label="Continua" />
            </div>
          </form>
        </Card>
      ) : null}

      {currentStep === 2 && activeBar && showGpsStep ? (
        <Card
          title="Imposta la posizione"
        >
          <form action={saveGpsAction} style={{ display: "grid", gap: 16 }}>
            <GpsLocationField
              latitudeName="gpsLatitude"
              longitudeName="gpsLongitude"
              initialLatitude={activeBar.settings?.gpsLatitude}
              initialLongitude={activeBar.settings?.gpsLongitude}
            />

            <input type="hidden" name="gpsRadius" value={String(globalGpsRadius)} />
            <div>
              <SubmitButton label="Continua" />
            </div>
          </form>
        </Card>
      ) : null}

      {currentStep === 3 && activeBar ? (
        <Card
          title="Imposta l'arrotondamento"
        >
          <form action={saveRoundingAction} style={{ display: "grid", gap: 18 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontWeight: 600,
              }}
            >
              <input
                name="roundingEnabled"
                type="checkbox"
                defaultChecked={Boolean(activeBar.settings?.roundingEnabled)}
              />
              Abilita arrotondamento al quarto d'ora
            </label>

            <input type="hidden" name="roundingMinutes" value="15" />
            <input type="hidden" name="roundingMode" value="NEAREST" />

            <div>
              <SubmitButton label="Continua" />
            </div>
          </form>
        </Card>
      ) : null}

      {currentStep === 4 && activeBar ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          <Card
            title="Invita il team"
          >
            <form action={inviteEmployeeAction} style={{ display: "grid", gap: 18 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 16,
                }}
              >
                <Input name="firstName" label="Nome" />
                <Input name="lastName" label="Cognome" />
                <Input
                  name="email"
                  label="Email"
                  type="email"
                  required
                  placeholder="nome@locale.it"
                />
                <label style={{ display: "grid", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>Ruolo</span>
                  <select
                    name="role"
                    defaultValue="EMPLOYEE"
                    style={{
                      borderRadius: 14,
                      border: "1px solid #d9cdb8",
                      padding: "12px 14px",
                      fontSize: 15,
                      background: "#fff",
                    }}
                  >
                    <option value="OWNER">Titolare</option>
                    <option value="EMPLOYEE">Dipendente</option>
                    <option value="MANAGER">Manager</option>
                  </select>
                </label>
              </div>
              <div>
                <SubmitButton label="Invita" />
              </div>
            </form>
          </Card>

          <Card
            title="Team attuale"
            subtitle={
              teamMembers.length > 0
                ? "Persone gia collegate al locale."
                : "Nessuna persona invitata."
            }
          >
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    background: "#f7f2e9",
                    border: "1px solid #eadfc9",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase" }}>
                    Persone collegate
                  </div>
                  <strong style={{ fontSize: 22, color: "#1f2937" }}>{teamMembers.length}</strong>
                </div>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    background: "#f7f2e9",
                    border: "1px solid #eadfc9",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase" }}>
                    Titolari
                  </div>
                  <strong style={{ fontSize: 16, color: "#1f2937" }}>
                    {ownerMembers.length}
                  </strong>
                </div>
              </div>

              {teamMembers.length > 0 ? (
                teamMembers.map((membership) => (
                  <div
                    key={membership.id}
                    style={{
                      padding: 16,
                      borderRadius: 18,
                      background: "#fff",
                      border: "1px solid #eadfc9",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong>
                        {membership.user.firstName} {membership.user.lastName}
                      </strong>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          borderRadius: 999,
                          padding: "6px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          background:
                            membership.role === Role.OWNER
                              ? "#fee2e2"
                              : membership.role === Role.MANAGER
                                ? "#dbeafe"
                                : "#ede9fe",
                          color:
                            membership.role === Role.OWNER
                              ? "#b91c1c"
                              : membership.role === Role.MANAGER
                                ? "#1d4ed8"
                                : "#6d28d9",
                        }}
                      >
                        {membership.role === Role.OWNER
                          ? "Titolare"
                          : membership.role === Role.MANAGER
                            ? "Manager"
                            : "Dipendente"}
                      </span>
                    </div>
                    <div style={{ color: "#6b7280" }}>{membership.user.email}</div>
                  </div>
                ))
              ) : (
                <p style={{ margin: 0, color: "#6b7280", lineHeight: 1.6 }}>
                  Puoi completare ora la configurazione e aggiungere persone in seguito.
                </p>
              )}
            </div>

            <form action={finishOnboardingAction} style={{ marginTop: 20 }}>
              <SubmitButton label="Completa configurazione" />
            </form>
          </Card>
        </div>
      ) : null}
    </StepShell>
  );
}
