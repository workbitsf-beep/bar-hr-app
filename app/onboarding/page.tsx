import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { RoundingMode, Role } from "@prisma/client";
import { GpsLocationField } from "@/app/components/gps-location-field";
import { PendingButton } from "@/app/components/pending-button";
import { getSession } from "@/lib/auth";
import { sendEmployeeWelcomeEmail } from "@/lib/email/notifications";
import { getGlobalGpsRadius } from "@/lib/gps-settings";
import { prisma } from "@/lib/prisma";
import {
  MIN_TEMPORARY_PASSWORD_LENGTH,
  readTemporaryPasswordFromFormData,
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

function parseInteger(value: FormDataEntryValue | null): number | null {
  const parsed = parseNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
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
    where: { ownerId: session.user.id },
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

  if (
    !activeBar.settings ||
    activeBar.settings.gpsLatitude === null ||
    activeBar.settings.gpsLongitude === null ||
    activeBar.settings.gpsRadius === null
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
  const roundingMinutes = parseInteger(formData.get("roundingMinutes"));
  const roundingModeRaw = String(formData.get("roundingMode") ?? "");
  const roundingMode =
    roundingModeRaw === "UP" ||
    roundingModeRaw === "DOWN" ||
    roundingModeRaw === "NEAREST"
      ? roundingModeRaw
      : null;

  if (roundingEnabled && (roundingMinutes === null || roundingMode === null)) {
    redirect("/onboarding?step=3&error=invalid-rounding");
  }

  await prisma.$transaction([
    prisma.bar.update({
      where: { id: activeBar.id },
      data: {
        roundingEnabled,
        roundingStepMin: roundingEnabled && roundingMinutes ? roundingMinutes : 15,
      },
    }),
    prisma.barSettings.upsert({
      where: { barId: activeBar.id },
      update: {
        roundingEnabled,
        roundingMinutes: roundingMinutes ?? 15,
        roundingMode: (roundingMode as RoundingMode | null) ?? RoundingMode.NEAREST,
      },
      create: {
        barId: activeBar.id,
        roundingEnabled,
        roundingMinutes: roundingMinutes ?? 15,
        roundingMode: (roundingMode as RoundingMode | null) ?? RoundingMode.NEAREST,
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
  let temporaryPassword: string;

  try {
    temporaryPassword = readTemporaryPasswordFromFormData(formData);
  } catch {
    redirect("/onboarding?step=4&error=invalid-temporary-password");
  }

  const roleRaw = String(formData.get("role") ?? "");
  const memberRole = roleRaw === "MANAGER" ? Role.MANAGER : Role.EMPLOYEE;

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
      await sendEmployeeWelcomeEmail(
        email,
        `${firstName} ${lastName}`.trim(),
        activeBar.name,
        email,
        temporaryPassword
      );
    } catch (error) {
      console.error("[welcome-email] employee failed", {
        recipient: email,
        error: "Unexpected welcome email error.",
      });
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
  children,
}: {
  currentStep: StepNumber;
  children: ReactNode;
}) {
  const steps = [
    { id: 1, title: "Create Bar" },
    { id: 2, title: "Set GPS" },
    { id: 3, title: "Rounding Rules" },
    { id: 4, title: "Invite Employees" },
  ] as const;

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background:
          "linear-gradient(180deg, #f8f2e6 0%, #efe5d3 45%, #f7f4ec 100%)",
      }}
    >
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
            padding: 28,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              opacity: 0.75,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            SaaS onboarding
          </p>
          <h1 style={{ margin: "10px 0 8px", fontSize: 34 }}>
            Set up your bar workspace
          </h1>
          <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.6 }}>
            Move step by step. Every section saves directly to the database so
            you can leave and continue later.
          </p>
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
                    fontSize: 12,
                    opacity: 0.75,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Step {step.id}
                </div>
                <div style={{ marginTop: 8, fontWeight: 700 }}>{step.title}</div>
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
  const invitedMembers =
    activeBar?.memberships.filter((membership) => membership.role !== Role.OWNER) ?? [];
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
    <StepShell currentStep={currentStep}>
      {currentStep === 1 ? (
        <Card
          title="Create your first bar"
          subtitle="Start by creating the main bar profile. You can add more bars later from the owner dashboard."
        >
          <form action={createBarAction} style={{ display: "grid", gap: 16 }}>
            <Input
              name="name"
              label="Bar name"
              placeholder="Nome del locale"
            />
            <div>
              <SubmitButton label="Save and continue" />
            </div>
          </form>
        </Card>
      ) : null}

      {currentStep === 2 && activeBar ? (
        <Card
          title="Set GPS location"
          subtitle="Employees will use this location when clocking in and clocking out."
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
              <SubmitButton label="Save GPS and continue" />
            </div>
          </form>
        </Card>
      ) : null}

      {currentStep === 3 && activeBar ? (
        <Card
          title="Set rounding rules"
          subtitle="This step is optional. You can enable it now or leave it disabled and configure it later."
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
              Enable rounding
            </label>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontWeight: 600 }}>Rounding minutes</span>
                <select
                  name="roundingMinutes"
                  defaultValue={String(activeBar.settings?.roundingMinutes ?? 15)}
                  style={{
                    borderRadius: 14,
                    border: "1px solid #d9cdb8",
                    padding: "12px 14px",
                    fontSize: 15,
                    background: "#fff",
                  }}
                >
                  <option value="5">5 minutes</option>
                  <option value="10">10 minutes</option>
                  <option value="15">15 minutes</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontWeight: 600 }}>Rounding mode</span>
                <select
                  name="roundingMode"
                  defaultValue={activeBar.settings?.roundingMode ?? "NEAREST"}
                  style={{
                    borderRadius: 14,
                    border: "1px solid #d9cdb8",
                    padding: "12px 14px",
                    fontSize: 15,
                    background: "#fff",
                  }}
                >
                  <option value="NEAREST">Nearest</option>
                  <option value="UP">Up</option>
                  <option value="DOWN">Down</option>
                </select>
              </label>
            </div>

            <div>
              <SubmitButton label="Save rules and continue" />
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
            title="Invite first employees"
            subtitle="Create the first employee accounts now. They will be asked to change password at first sign-in."
          >
            <form action={inviteEmployeeAction} style={{ display: "grid", gap: 18 }}>
              <div
                style={{
                  padding: 14,
                  borderRadius: 18,
                  background: "#f7f2e9",
                  border: "1px solid #eadfc9",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                Inserisci i primi account del team. Potrai aggiungerne altri anche piu tardi dalla
                dashboard.
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 16,
                }}
              >
                <Input name="firstName" label="First name" />
                <Input name="lastName" label="Last name" />
                <Input
                  name="email"
                  label="Email"
                  type="email"
                  required
                  placeholder="nome@locale.it"
                />
                <Input
                  name="temporaryPassword"
                  label="Password temporanea"
                  type="text"
                  required
                  minLength={MIN_TEMPORARY_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  placeholder="Imposta una password temporanea"
                />
                <label style={{ display: "grid", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>Role</span>
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
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                  </select>
                </label>
              </div>
              <div>
                <SubmitButton label="Invite employee" />
              </div>
            </form>
          </Card>

          <Card
            title="Current team"
            subtitle={
              invitedMembers.length > 0
                ? "These employees are already linked to the bar."
                : "No employees invited yet. You can still finish and add them later."
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
                    Invitati
                  </div>
                  <strong style={{ fontSize: 22, color: "#1f2937" }}>{invitedMembers.length}</strong>
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
                    Titolare
                  </div>
                  <strong style={{ fontSize: 16, color: "#1f2937" }}>
                    {activeBar.ownerId ? "Gia collegato" : "Da collegare"}
                  </strong>
                </div>
              </div>

              {invitedMembers.length > 0 ? (
                invitedMembers.map((membership) => (
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
                          background: membership.role === Role.MANAGER ? "#dbeafe" : "#ede9fe",
                          color: membership.role === Role.MANAGER ? "#1d4ed8" : "#6d28d9",
                        }}
                      >
                        {membership.role === Role.MANAGER ? "Manager" : "Employee"}
                      </span>
                    </div>
                    <div style={{ color: "#6b7280" }}>{membership.user.email}</div>
                  </div>
                ))
              ) : (
                <p style={{ margin: 0, color: "#6b7280", lineHeight: 1.6 }}>
                  Finish onboarding now if you prefer to invite employees later
                  from the dashboard.
                </p>
              )}
            </div>

            <form action={finishOnboardingAction} style={{ marginTop: 20 }}>
              <SubmitButton label="Finish onboarding" />
            </form>
          </Card>
        </div>
      ) : null}
    </StepShell>
  );
}
