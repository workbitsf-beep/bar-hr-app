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
import { featureToggleDefinitions, getFeatureFlags, parseFeatureFlags, type FeatureSettingsInput } from "@/lib/features";
import { getGlobalGpsRadius } from "@/lib/gps-settings";
import { prisma } from "@/lib/prisma";
import { BrandLogo } from "@/components/brand-logo";
import { normalizeRoundingStep } from "@/lib/rounding";
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

/** The colour each feature answers to elsewhere in the app. */
const FEATURE_DOTS: Record<string, string> = {
  timeTracking: "#0ea5e9",
  shifts: "#6d5ce7",
  requests: "#10b981",
  availability: "#94a3b8",
  overtime: "#a855f7",
  tasks: "#f59e0b",
  noticeBoard: "#f59e0b",
  courses: "#0284c7",
  documents: "#64748b",
  reports: "#7e22ce",
};

/**
 * One row per feature, each saying what it is for.
 *
 * They were tiles in a two-column grid, which on a phone stacked into a
 * column of boxes anyway - so they are a list, and the list can be read.
 */
function FeatureToggleGrid({
  settings,
  activityType,
}: {
  settings?: FeatureSettingsInput | null;
  activityType?: ActivityType | null;
}) {
  const features = getFeatureFlags(settings);
  const visibleFeatureDefinitions = featureToggleDefinitions.filter(
    (feature) => activityType !== ActivityType.COMPANY || feature.key !== "timeTracking"
  );

  return (
    <div style={{ display: "grid" }}>
      {visibleFeatureDefinitions.map((feature, index) => (
        <label
          key={feature.key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "11px 0",
            borderTop: index === 0 ? undefined : "1px solid #f4f2fb",
            cursor: "pointer",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 9,
              height: 9,
              flex: "0 0 auto",
              borderRadius: 999,
              background: FEATURE_DOTS[feature.key] ?? "#94a3b8",
            }}
          />
          <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
            <strong style={{ fontSize: 13.5, fontWeight: 740, color: "#17161f" }}>
              {feature.shortLabel}
            </strong>
            <span style={{ fontSize: 11.5, fontWeight: 520, color: "#a3a0b8" }}>
              {feature.description}
            </span>
          </span>
          <span className="workbit-switch">
            <input
              type="checkbox"
              name={feature.field}
              defaultChecked={features[feature.key]}
            />
            <i aria-hidden="true" />
          </span>
        </label>
      ))}
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
    availabilityEnabled?: boolean | null;
    overtimeEnabled?: boolean | null;
    tasksEnabled?: boolean | null;
    noticeBoardEnabled?: boolean | null;
    coursesEnabled?: boolean | null;
    documentsEnabled?: boolean | null;
    reportsEnabled?: boolean | null;
    roundingMinutes: number | null;
    roundingMode: RoundingMode | null;
  } | null;
} | null;

function barNeedsSetup(bar: OnboardingBar) {
  if (!bar) {
    return false;
  }

  const timeTrackingEnabled = bar.settings?.timeTrackingEnabled !== false;

  if (bar.activityType === ActivityType.COMPANY) {
    return bar.settings?.companyShiftsEnabled === null;
  }

  const needsGps =
    timeTrackingEnabled &&
    bar.activityType === ActivityType.RESTAURANT &&
    (!bar.settings ||
      bar.settings.gpsLatitude === null ||
      bar.settings.gpsLongitude === null ||
      bar.settings.gpsRadius === null);

  return Boolean(
    !bar.settings ||
      needsGps ||
      (timeTrackingEnabled &&
        (bar.settings.roundingMinutes === null ||
          bar.settings.roundingMode === null))
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
                  availabilityEnabled: true,
                  overtimeEnabled: true,
                  tasksEnabled: true,
                  noticeBoardEnabled: true,
                  coursesEnabled: true,
                  documentsEnabled: true,
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
                availabilityEnabled: true,
                overtimeEnabled: true,
                tasksEnabled: true,
                noticeBoardEnabled: true,
                coursesEnabled: true,
                documentsEnabled: true,
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

  const timeTrackingEnabled = activeBar.settings?.timeTrackingEnabled !== false;

  if (
    timeTrackingEnabled &&
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
    timeTrackingEnabled &&
    activeBar.activityType === ActivityType.RESTAURANT &&
    !hasCompletedRoundingSetup(activeBar.settings)
  ) {
    return 3;
  }

  return activeBar.activityType === ActivityType.RESTAURANT && timeTrackingEnabled ? 4 : 3;
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
          // A company starts without clock-ins: turned on in the settings.
          timeTrackingEnabled: activityType !== ActivityType.COMPANY,
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
                availabilityEnabled: true,
                overtimeEnabled: true,
                tasksEnabled: true,
                noticeBoardEnabled: true,
                coursesEnabled: true,
                documentsEnabled: true,
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
  const roundingMinutes = normalizeRoundingStep(Number(formData.get("roundingMinutes") ?? 15));
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

/**
 * The frame every step sits in.
 *
 * A venue owner does this once, on a phone, minutes after being told Workbit
 * exists - so it is the first thing they ever see of it. It used to be cream
 * and sand with a black header, which is nothing like the app they were about
 * to use: the same lilac ground, the same white cards and the same violet
 * belong here more than anywhere.
 *
 * Where it stands is said once, in four strokes and a count, instead of a
 * progress bar, a "Passo 2 di 4" and a row of four named tiles all saying it
 * at the same time.
 */
function StepShell({
  currentStep,
  steps,
  children,
}: {
  currentStep: StepNumber;
  steps: Array<{ id: StepNumber; title: string; lead: string }>;
  children: ReactNode;
}) {
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === currentStep));
  const step = steps[currentIndex] ?? steps[0];
  const isLast = currentIndex === steps.length - 1;

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100dvh",
        padding: "18px 14px 26px",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 88% 4%, rgba(137, 92, 246, 0.14), transparent 30%), linear-gradient(180deg, #f8f6ff 0%, #efebfa 48%, #ebe6f8 100%)",
        color: "#17161f",
      }}
    >
      <SessionKeepAlive />

      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          width: "58vmin",
          height: "58vmin",
          top: "-18vmin",
          right: "-16vmin",
          borderRadius: 999,
          filter: "blur(54px)",
          background: "rgba(139, 92, 246, 0.22)",
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          width: "44vmin",
          height: "44vmin",
          bottom: "-14vmin",
          left: "-16vmin",
          borderRadius: 999,
          filter: "blur(54px)",
          background: "rgba(76, 29, 149, 0.12)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "min(100%, 520px)",
          margin: "0 auto",
          display: "grid",
          gap: 13,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <BrandLogo size={26} showIcon label="Workbit" style={{ gap: 9, flex: 1 }} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "#8b88a3",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {currentIndex + 1} / {steps.length}
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-label={`Passo ${currentIndex + 1} di ${steps.length}`}
          style={{ display: "flex", gap: 5 }}
        >
          {steps.map((entry, index) => (
            <span
              key={entry.id}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 999,
                background:
                  index <= currentIndex
                    ? "linear-gradient(90deg, #5e4ae3, #8b5cf6)"
                    : "#ddd8f2",
              }}
            />
          ))}
        </div>

        <div style={{ display: "grid", gap: 3, padding: "8px 3px 0" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#6d5ce7",
            }}
          >
            {isLast ? "Ultimo passo" : "Configurazione"}
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(26px, 7.4vw, 32px)",
              fontWeight: 850,
              letterSpacing: "-0.036em",
              lineHeight: 1.06,
            }}
          >
            {step?.title}
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 13.5, color: "#6b6880", lineHeight: 1.45 }}>
            {step?.lead}
          </p>
        </div>

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
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #e9e6f5",
        borderRadius: 20,
        padding: "15px 14px 16px",
        boxShadow: "0 12px 34px rgba(61, 42, 153, 0.08)",
        display: "grid",
        gap: 13,
      }}
    >
      {title ? (
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 830,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#a3a0b8",
          }}
        >
          {title}
        </span>
      ) : null}
      {subtitle ? (
        <p style={{ margin: 0, color: "#8b88a3", fontSize: 12.5, lineHeight: 1.5 }}>{subtitle}</p>
      ) : null}
      {children}
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
    <label style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 830,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#a3a0b8",
        }}
      >
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        minLength={minLength}
        required={required}
        autoComplete={autoComplete}
        style={{
          width: "100%",
          height: 46,
          padding: "0 13px",
          borderRadius: 14,
          border: "1.5px solid #e9e6f5",
          background: "#fbfaff",
          color: "#17161f",
          fontSize: 16,
          fontWeight: 600,
          outline: "none",
        }}
      />
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  return (
    <PendingButton
      type="submit"
      pendingLabel="Un momento…"
      style={{
        width: "100%",
        minHeight: 50,
        border: 0,
        borderRadius: 16,
        background: "linear-gradient(135deg, #3b1d8f 0%, #5e4ae3 55%, #8b5cf6 100%)",
        color: "#ffffff",
        fontSize: 15.5,
        fontWeight: 830,
        boxShadow: "0 10px 22px rgba(94, 74, 227, 0.26)",
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
  const timeTrackingEnabled = activeBar?.settings?.timeTrackingEnabled !== false;
  const showGpsStep = activeBar?.activityType !== ActivityType.COMPANY && timeTrackingEnabled;
  // The title of each step is what the screen is about, said the way someone
  // would say it out loud, with a line underneath for why it is being asked.
  const stepLocale = {
    id: 1 as StepNumber,
    title: "Il tuo locale",
    lead: "Come si chiama e che lavoro ci si fa.",
  };
  const stepPosizione = {
    id: 2 as StepNumber,
    title: "Dove si timbra",
    lead: "Il punto da cui il personale può entrare e uscire.",
  };
  const stepFunzioni = {
    title: "Cosa ti serve",
    lead: "Accendi solo quello che usi. Si cambia quando vuoi.",
  };
  const stepTeam = {
    title: "La tua squadra",
    lead: "Invitali ora o più avanti, non cambia niente.",
  };
  const onboardingSteps = showGpsStep
    ? [
        stepLocale,
        stepPosizione,
        { id: 3 as StepNumber, ...stepFunzioni },
        { id: 4 as StepNumber, ...stepTeam },
      ]
    : [
        stepLocale,
        { id: 2 as StepNumber, ...stepFunzioni },
        { id: 3 as StepNumber, ...stepTeam },
      ];
  const teamMembers = activeBar?.memberships ?? [];
  const featureSettings =
    activeBar?.activityType === ActivityType.COMPANY
      ? {
          ...activeBar.settings,
          shiftsEnabled: activeBar.settings?.companyShiftsEnabled === false ? false : activeBar.settings?.shiftsEnabled,
          timeTrackingEnabled: false,
        }
      : activeBar?.settings;
  const invitedMembers =
    activeBar?.memberships.filter((membership) => membership.role !== Role.OWNER) ?? [];
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
        <Card>
          <form action={createBarAction} style={{ display: "grid", gap: 14 }}>
            <Input
              name="name"
              label="Nome"
              placeholder="Nome del locale"
            />

            {/* Two choices in all, and they decide how many steps there even
                are: worth touching, not worth a dropdown. */}
            <div style={{ display: "grid", gap: 6 }}>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 830,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#a3a0b8",
                }}
              >
                Attività
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  {
                    value: "RESTAURANT",
                    title: "Ristorazione",
                    lead: "Bar, ristorante, pizzeria",
                  },
                  { value: "COMPANY", title: "Azienda", lead: "Uffici, negozi" },
                ].map((option, index) => (
                  <label
                    key={option.value}
                    className="workbit-onboarding-pick"
                    style={{
                      display: "grid",
                      gap: 3,
                      padding: "12px 11px",
                      borderRadius: 15,
                      border: "1.5px solid #e9e6f5",
                      background: "#fbfaff",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="activityType"
                      value={option.value}
                      defaultChecked={index === 0}
                      style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                    />
                    <strong style={{ fontSize: 13.5, fontWeight: 820, color: "#17161f" }}>
                      {option.title}
                    </strong>
                    <span style={{ fontSize: 11.5, fontWeight: 550, color: "#8b88a3", lineHeight: 1.35 }}>
                      {option.lead}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <SubmitButton label="Continua" />
          </form>
        </Card>
      ) : null}

      {activeBar && ownedBars.length > 1 ? (
        <Card title="Cambia attività">
          <AutoSubmitSelectForm
            action={switchBarAction}
            name="barId"
            defaultValue={activeBar.id}
            ariaLabel="Cambia attività"
            label="Attività attiva"
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
            Puoi tornare all&apos;altra attività quando vuoi e riprendere la configurazione in seguito.
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
            <SubmitButton label="Continua" />
          </form>
        </Card>
      ) : null}

      {currentStep === 2 && activeBar && !showGpsStep ? (
        <Card title="Personalizza Workbit">
          <form action={updateSettingsAction} style={{ display: "grid", gap: 16 }}>
            <input type="hidden" name="settingsSection" value="features" />
            <FeatureToggleGrid settings={featureSettings} activityType={activeBar.activityType} />

            <SubmitButton label="Continua" />
          </form>
        </Card>
      ) : null}

      {currentStep === 3 && activeBar && showGpsStep ? (
        <Card
          title="Personalizza Workbit"
        >
          <form action={saveRoundingAction} style={{ display: "grid", gap: 18 }}>
            <FeatureToggleGrid settings={featureSettings} activityType={activeBar.activityType} />

            {/* It belongs in the same list as everything else you are
                switching on, not in a checkbox of its own below it. */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 0",
                borderTop: "1px solid #f4f2fb",
                cursor: "pointer",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 9,
                  height: 9,
                  flex: "0 0 auto",
                  borderRadius: 999,
                  background: "#94a3b8",
                }}
              />
              <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                <strong style={{ fontSize: 13.5, fontWeight: 740, color: "#17161f" }}>
                  Arrotonda le ore
                </strong>
                <span style={{ fontSize: 11.5, fontWeight: 520, color: "#a3a0b8" }}>
                  Al quarto d&apos;ora più vicino.
                </span>
              </span>
              <span className="workbit-switch">
                <input
                  name="roundingEnabled"
                  type="checkbox"
                  defaultChecked={Boolean(activeBar.settings?.roundingEnabled)}
                />
                <i aria-hidden="true" />
              </span>
            </label>

            <input type="hidden" name="roundingMinutes" value="15" />
            <input type="hidden" name="roundingMode" value="NEAREST" />
            <input type="hidden" name="roundingAcknowledged" value="on" />

            <SubmitButton label="Continua" />
          </form>
        </Card>
      ) : null}

      {currentStep === (showGpsStep ? 4 : 3) && activeBar ? (
        <Card>
          {/* One card, not two side by side. The two tiles that counted
              people and owners are gone: the count is in the label, and how
              many owners there are is read off a list three rows long. */}
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 830,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#a3a0b8",
            }}
          >
            {teamMembers.length > 0 ? `Personale · ${teamMembers.length}` : "Personale"}
          </span>

          {teamMembers.length > 0 ? (
            <div style={{ display: "grid", gap: 6 }}>
              {teamMembers.map((membership) => (
                <div
                  key={membership.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "3px minmax(0, 1fr)",
                    borderRadius: 13,
                    overflow: "hidden",
                    border: "1px solid #f0eef9",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{ background: membership.role === Role.OWNER ? "#6d5ce7" : "#c9c4e8" }}
                  />
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 11px",
                      minWidth: 0,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 32,
                        height: 32,
                        flex: "0 0 auto",
                        borderRadius: 999,
                        display: "grid",
                        placeItems: "center",
                        background: "#f1effe",
                        color: "#4c1d95",
                        fontSize: 10.5,
                        fontWeight: 850,
                      }}
                    >
                      {`${membership.user.firstName?.[0] ?? ""}${membership.user.lastName?.[0] ?? ""}`.toUpperCase()}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                      <strong style={{ fontSize: 13.5, fontWeight: 780, color: "#17161f" }}>
                        {membership.user.firstName} {membership.user.lastName}
                      </strong>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 520,
                          color: "#a3a0b8",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {membership.user.email}
                      </span>
                    </span>
                    {/* The role in the app's own small capitals, instead of
                        the red, blue and lilac invented on this page alone. */}
                    <span
                      style={{
                        flex: "0 0 auto",
                        fontSize: 9,
                        fontWeight: 830,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#8b88a3",
                      }}
                    >
                      {membership.role === Role.OWNER
                        ? "Titolare"
                        : membership.role === Role.MANAGER
                          ? "Responsabile"
                          : "Dipendente"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: "#c2bfd4" }}>
              Nessuno ancora. Puoi finire adesso e invitarli quando vuoi.
            </p>
          )}

          {/* The invite form used to sit open above the list. It waits behind
              a summary now, because most of the time there is nothing to add. */}
          <details style={{ display: "grid", gap: 12 }}>
            <summary
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                minHeight: 44,
                padding: "0 13px",
                borderRadius: 14,
                border: "1.5px solid #ddd6fe",
                background: "#ffffff",
                color: "#4c1d95",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                listStyle: "none",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
                +
              </span>
              Invita una persona
            </summary>

            <form action={inviteEmployeeAction} style={{ display: "grid", gap: 12, paddingTop: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input name="firstName" label="Nome" />
                <Input name="lastName" label="Cognome" />
              </div>
              <Input
                name="email"
                label="Email"
                type="email"
                required
                placeholder="nome@locale.it"
              />
              <label style={{ display: "grid", gap: 6 }}>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 830,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "#a3a0b8",
                  }}
                >
                  Ruolo
                </span>
                <select
                  name="role"
                  defaultValue="EMPLOYEE"
                  style={{
                    height: 46,
                    borderRadius: 14,
                    border: "1.5px solid #e9e6f5",
                    background: "#fbfaff",
                    padding: "0 11px",
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#17161f",
                  }}
                >
                  <option value="EMPLOYEE">Dipendente</option>
                  <option value="MANAGER">Responsabile</option>
                  <option value="OWNER">Titolare</option>
                </select>
              </label>
              <SubmitButton label="Invita" />
            </form>
          </details>

          <form action={finishOnboardingAction}>
            <SubmitButton label="Completa configurazione" />
          </form>
        </Card>
      ) : null}
    </StepShell>
  );
}
