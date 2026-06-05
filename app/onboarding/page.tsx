import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ActivityType, RoundingMode, Role } from "@prisma/client";
import { GpsLocationField } from "@/app/components/gps-location-field";
import { PendingButton } from "@/app/components/pending-button";
import { SessionKeepAlive } from "@/app/components/session-keepalive";
import { AutoSubmitSelectForm } from "@/app/dashboard/auto-submit-select-form";
import { updateSettingsAction } from "@/app/dashboard/actions";
import { getSession } from "@/lib/auth";
import { barNeedsSubscriptionActivation } from "@/lib/billing";
import {
  sendEmployeeWelcomeEmail,
  sendOwnerWelcomeEmail,
} from "@/lib/email/notifications";
import { featureDefinitions, getFeatureFlags, parseFeatureFlags, type FeatureSettingsInput } from "@/lib/features";
import { getGlobalGpsRadius } from "@/lib/gps-settings";
import { prisma } from "@/lib/prisma";
import {
  createTemporaryPassword,
} from "@/lib/temporary-password";

type StepNumber = 1 | 2 | 3 | 4;

function hasCompletedRoundingSetup(
  settings: {
    roundingMinutes: number | null;
    roundingMode: RoundingMode | null;
  } | null | undefined
) {
  return Boolean(
    settings &&
      settings.roundingMinutes !== null &&
      settings.roundingMode !== null
  );
}

function FeatureToggleGrid({ settings }: { settings?: FeatureSettingsInput | null }) {
  const features = getFeatureFlags(settings);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <strong style={{ color: "#0f172a", fontSize: 18 }}>Scegli cosa usare</strong>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
        }}
      >
        {featureDefinitions.map((feature) => (
          <label
            key={feature.key}
            style={{
              display: "grid",
              gap: 8,
              padding: 14,
              borderRadius: 18,
              border: features[feature.key]
                ? "1px solid rgba(124, 58, 237, 0.28)"
                : "1px solid rgba(148, 163, 184, 0.22)",
              background: features[feature.key]
                ? "linear-gradient(135deg, rgba(237,233,254,0.82), rgba(255,255,255,0.96))"
                : "#f8fafc",
            }}
          >
            <span style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 700 }}>
              <input
                type="checkbox"
                name={feature.field}
                defaultChecked={features[feature.key]}
              />
              <span aria-hidden="true">{feature.emoji}</span>
              {feature.shortLabel}
            </span>
            <span style={{ color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
              {feature.description}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

type OnboardingBar = {
  activityType: ActivityType;
  settings: {
    gpsLatitude: number | null;
    gpsLongitude: number | null;
    gpsRadius: number | null;
    companyShiftsEnabled: boolean | null;
    timeTrackingEnabled?: boolean | null;
    shiftsEnabled?: boolean | null;
    requestsEnabled?: boolean | null;
    tasksEnabled?: boolean | null;
    noticeBoardEnabled?: boolean | null;
    coursesEnabled?: boolean | null;
    reportsEnabled?: boolean | null;
    roundingMinutes: number | null;
    roundingMode: RoundingMode | null;
  } | null;
} | null;

function barNeedsSetup(bar: OnboardingBar) {
  if (!bar) {
    return false;
  }

  if (bar.activityType === ActivityType.COMPANY) {
    return bar.settings?.companyShiftsEnabled === null;
  }

  const needsGps =
    bar.activityType === ActivityType.RESTAURANT &&
    (!bar.settings ||
      bar.settings.gpsLatitude === null ||
      bar.settings.gpsLongitude === null ||
      bar.settings.gpsRadius === null);

  return Boolean(
    !bar.settings ||
      needsGps ||
      bar.settings.roundingMinutes === null ||
      bar.settings.roundingMode === null
  );
}

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseActivityType(value: FormDataEntryValue | null) {
  return value === "COMPANY" ? ActivityType.COMPANY : ActivityType.RESTAURANT;
}

async function getOwnerContext() {
  const session = await getSession();

  if (!session) {
    redirect("/dashboard");
  }

  if (session.user.role !== Role.OWNER) {
    redirect("/dashboard");
  }

  const ownershipFilter = {
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
  };

  const [ownedBars, activeBarCandidate] = await Promise.all([
    prisma.bar.findMany({
      where: ownershipFilter,
      select: {
        id: true,
        name: true,
        activityType: true,
      },
      orderBy: { name: "asc" },
    }),
    session.activeBarId
      ? prisma.bar.findFirst({
          where: {
            id: session.activeBarId,
            ...ownershipFilter,
          },
          select: {
            id: true,
            name: true,
            activityType: true,
              settings: {
                select: {
                  gpsLatitude: true,
                  gpsLongitude: true,
                  gpsRadius: true,
                  companyShiftsEnabled: true,
                  roundingMinutes: true,
                  roundingMode: true,
                  roundingEnabled: true,
                  timeTrackingEnabled: true,
                  shiftsEnabled: true,
                  requestsEnabled: true,
                  tasksEnabled: true,
                  noticeBoardEnabled: true,
                  coursesEnabled: true,
                  reportsEnabled: true,
                },
            },
            memberships: {
              where: { isActive: true },
              select: {
                id: true,
                role: true,
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
        })
      : Promise.resolve(null),
  ]);

  const activeBar =
    activeBarCandidate ??
    (ownedBars[0]
      ? await prisma.bar.findFirst({
          where: {
            id: ownedBars[0].id,
            ...ownershipFilter,
          },
          select: {
            id: true,
            name: true,
            activityType: true,
            settings: {
              select: {
                gpsLatitude: true,
                gpsLongitude: true,
                gpsRadius: true,
                companyShiftsEnabled: true,
                roundingMinutes: true,
                roundingMode: true,
                roundingEnabled: true,
                timeTrackingEnabled: true,
                shiftsEnabled: true,
                requestsEnabled: true,
                tasksEnabled: true,
                noticeBoardEnabled: true,
                coursesEnabled: true,
                reportsEnabled: true,
              },
            },
            memberships: {
              where: { isActive: true },
              select: {
                id: true,
                role: true,
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
        })
      : null);

  return { session, ownedBars, activeBar };
}

function getCurrentStep(activeBar: Awaited<ReturnType<typeof getOwnerContext>>["activeBar"]): StepNumber {
  if (!activeBar) {
    return 1;
  }

  if (
    activeBar.activityType === ActivityType.RESTAURANT &&
    (!activeBar.settings ||
      activeBar.settings.gpsLatitude === null ||
      activeBar.settings.gpsLongitude === null ||
      activeBar.settings.gpsRadius === null)
  ) {
    return 2;
  }

  if (
    activeBar.activityType === ActivityType.COMPANY &&
    activeBar.settings?.companyShiftsEnabled === null
  ) {
    return 2;
  }

  if (
    activeBar.activityType === ActivityType.RESTAURANT &&
    !hasCompletedRoundingSetup(activeBar.settings)
  ) {
    return 3;
  }

  return activeBar.activityType === ActivityType.RESTAURANT ? 4 : 3;
}

async function createBarAction(formData: FormData) {
  "use server";

  const session = await getSession();

  if (!session || session.user.role !== Role.OWNER) {
    redirect("/dashboard");
  }

  const name = String(formData.get("name") ?? "").trim();
  const activityType = parseActivityType(formData.get("activityType"));

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
      activityType,
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

async function switchBarAction(formData: FormData) {
  "use server";

  const session = await getSession();

  if (!session || session.user.role !== Role.OWNER) {
    redirect("/dashboard");
  }

  const barId = String(formData.get("barId") ?? "").trim();

  if (!barId) {
    redirect("/onboarding");
  }

  const selectedBar = await prisma.bar.findFirst({
    where: {
      id: barId,
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
    select: {
      activityType: true,
            settings: {
              select: {
                gpsLatitude: true,
                gpsLongitude: true,
                gpsRadius: true,
                companyShiftsEnabled: true,
                timeTrackingEnabled: true,
                shiftsEnabled: true,
                requestsEnabled: true,
                tasksEnabled: true,
                noticeBoardEnabled: true,
                coursesEnabled: true,
                reportsEnabled: true,
                roundingMinutes: true,
                roundingMode: true,
              },
            },
    },
  });

  if (!selectedBar) {
    redirect("/onboarding");
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { activeBarId: barId },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/onboarding");

  if (await barNeedsSubscriptionActivation(barId)) {
    redirect("/dashboard/settings");
  }

  if (barNeedsSetup(selectedBar)) {
    redirect("/onboarding");
  }

  redirect("/dashboard/calendar");
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
  const featureFlags = parseFeatureFlags(formData);

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
        ...featureFlags,
      },
      create: {
        barId: activeBar.id,
        roundingEnabled,
        roundingMinutes,
        roundingMode,
        ...featureFlags,
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
  const { activeBar, ownedBars } = await getOwnerContext();
  const globalGpsRadius = await getGlobalGpsRadius();
  const showGpsStep = activeBar?.activityType !== ActivityType.COMPANY;
  const onboardingSteps = showGpsStep
    ? ([
        { id: 1 as StepNumber, title: "Locale" },
        { id: 2 as StepNumber, title: "Posizione" },
        { id: 3 as StepNumber, title: "Funzioni" },
        { id: 4 as StepNumber, title: "Team" },
      ] as const)
    : ([
        { id: 1 as StepNumber, title: "Locale" },
        { id: 2 as StepNumber, title: "Funzioni" },
        { id: 3 as StepNumber, title: "Team" },
      ] as const);
  const teamMembers = activeBar?.memberships ?? [];
  const featureSettings =
    activeBar?.activityType === ActivityType.COMPANY && activeBar.settings?.companyShiftsEnabled === false
      ? { ...activeBar.settings, shiftsEnabled: false }
      : activeBar?.settings;
  const invitedMembers =
    activeBar?.memberships.filter((membership) => membership.role !== Role.OWNER) ?? [];
  const ownerMembers = teamMembers.filter((membership) => membership.role === Role.OWNER);
  const alternateBar = activeBar
    ? ownedBars.find((bar) => bar.id !== activeBar.id) ?? null
    : null;
  const computedStep = getCurrentStep(activeBar);
  const finalStep = showGpsStep ? 4 : 3;
  const requestedStepRaw = Array.isArray(params.step) ? params.step[0] : params.step;
  const requestedStep = requestedStepRaw ? Number(requestedStepRaw) : computedStep;
  const currentStep =
    requestedStep >= computedStep && requestedStep <= finalStep
      ? (requestedStep as StepNumber)
      : computedStep;

  if (computedStep === finalStep && activeBar && invitedMembers.length > 0 && requestedStepRaw === "done") {
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
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Attività</span>
              <select
                name="activityType"
                defaultValue="RESTAURANT"
                style={{
                  borderRadius: 14,
                  border: "1px solid #d9cdb8",
                  padding: "12px 14px",
                  fontSize: 15,
                  background: "#fff",
                }}
              >
                <option value="RESTAURANT">Ristorazione</option>
                <option value="COMPANY">Azienda</option>
              </select>
            </label>
            <div>
              <SubmitButton label="Continua" />
            </div>
          </form>
        </Card>
      ) : null}

      {activeBar && ownedBars.length > 1 ? (
        <Card title="Cambia attivita">
          <AutoSubmitSelectForm
            action={switchBarAction}
            name="barId"
            defaultValue={activeBar.id}
            ariaLabel="Cambia attivita"
            label="Attivita attiva"
            options={ownedBars.map((bar) => ({
              value: bar.id,
              label: `${bar.name} - ${bar.activityType === ActivityType.COMPANY ? "Azienda" : "Ristorazione"}`,
            }))}
          />
          {alternateBar ? (
            <form action={switchBarAction} style={{ marginTop: 12 }}>
              <input type="hidden" name="barId" value={alternateBar.id} />
              <SubmitButton label={`Torna a ${alternateBar.name}`} />
            </form>
          ) : null}
          <div style={{ marginTop: 12, color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
            Puoi tornare all'altra attivita quando vuoi e riprendere la configurazione in seguito.
          </div>
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

      {currentStep === 2 && activeBar && !showGpsStep ? (
        <Card title="Personalizza Workbit">
          <form action={updateSettingsAction} style={{ display: "grid", gap: 16 }}>
            <FeatureToggleGrid settings={featureSettings} />

            <div>
              <SubmitButton label="Continua" />
            </div>
          </form>
        </Card>
      ) : null}

      {currentStep === 3 && activeBar && showGpsStep ? (
        <Card
          title="Personalizza Workbit"
        >
          <form action={saveRoundingAction} style={{ display: "grid", gap: 18 }}>
            <FeatureToggleGrid settings={featureSettings} />

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
              Abilita arrotondamento con tolleranza di 5 minuti
            </label>

            <input type="hidden" name="roundingMinutes" value="15" />
            <input type="hidden" name="roundingMode" value="NEAREST" />

            <div>
              <SubmitButton label="Continua" />
            </div>
          </form>
        </Card>
      ) : null}

      {currentStep === (showGpsStep ? 4 : 3) && activeBar ? (
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
