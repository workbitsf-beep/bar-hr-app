import type { ReactNode } from "react";
import { TaskStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ShiftSummary = {
  id: string;
  title: string | null;
  startTime: Date;
  endTime: Date;
  assignedTo?: {
    firstName: string;
    lastName: string;
    email?: string;
  } | null;
};

type TaskSummary = {
  id: string;
  title: string;
  dueDate: Date;
  status: string;
  assignedTo?: {
    firstName: string;
    lastName: string;
  } | null;
};

type EmployeeSummary = {
  id: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
};

type NavItem = {
  label: string;
  href: string;
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
  }).format(value);
}

function formatTimeRange(start: Date, end: Date): string {
  return `${new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(start)} - ${new Intl.DateTimeFormat("it-IT", {
    timeStyle: "short",
  }).format(end)}`;
}

function Shell({
  userName,
  role,
  barName,
  navItems,
  children,
}: {
  userName: string;
  role: string;
  barName: string;
  navItems: NavItem[];
  children: ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f6f0e4 0%, #efe3cf 46%, #f7f4ec 100%)",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "260px minmax(0, 1fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        <aside
          style={{
            position: "sticky",
            top: 24,
            background: "#1f2937",
            color: "#f8fafc",
            borderRadius: 24,
            padding: 24,
            boxShadow: "0 18px 48px rgba(31, 41, 55, 0.22)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: 0.75,
            }}
          >
            Workforce Hub
          </p>
          <h1 style={{ margin: "12px 0 8px", fontSize: 28, lineHeight: 1.1 }}>
            Dashboard
          </h1>
          <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.5 }}>
            {userName}
            <br />
            {role} at {barName}
          </p>

          <nav style={{ marginTop: 28, display: "grid", gap: 10 }}>
            {navItems.map((item, index) => (
              <a
                key={item.label}
                href={item.href}
                style={{
                  textDecoration: "none",
                  color: "#f8fafc",
                  background:
                    index === 0 ? "rgba(255,255,255,0.14)" : "transparent",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 16,
                  padding: "12px 14px",
                  fontWeight: 600,
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <div style={{ display: "grid", gap: 20 }}>{children}</div>
      </div>
    </main>
  );
}

function Hero({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: string;
}) {
  return (
    <section
      style={{
        background: "#fffdf8",
        border: "1px solid #e9decb",
        borderRadius: 24,
        padding: 28,
        boxShadow: "0 14px 40px rgba(107, 70, 26, 0.08)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            color: "#8a6f48",
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Role overview
        </p>
        <h2 style={{ margin: "8px 0 6px", fontSize: 32 }}>{title}</h2>
        <p style={{ margin: 0, color: "#6b7280", lineHeight: 1.6 }}>
          {subtitle}
        </p>
      </div>
      {action ? (
        <button
          type="button"
          style={{
            background: "#1f2937",
            color: "#fff",
            border: 0,
            borderRadius: 999,
            padding: "12px 18px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {action}
        </button>
      ) : null}
    </section>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        background: "#fffdf8",
        border: "1px solid #e9decb",
        borderRadius: 20,
        padding: 20,
        boxShadow: "0 10px 28px rgba(74, 58, 27, 0.07)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 20 }}>{title}</h3>
        {action ? (
          <span
            style={{
              color: "#8a6f48",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {action}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p style={{ margin: 0, color: "#6b7280", lineHeight: 1.6 }}>{message}</p>
  );
}

function ItemList({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gap: 12 }}>{children}</div>;
}

function ItemCard({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: "#f7f2e9",
        border: "1px solid #eadfc9",
      }}
    >
      <strong style={{ display: "block", marginBottom: 6 }}>{title}</strong>
      {subtitle ? (
        <div style={{ color: "#4b5563", marginBottom: meta ? 4 : 0 }}>
          {subtitle}
        </div>
      ) : null}
      {meta ? <div style={{ color: "#8b95a1", fontSize: 14 }}>{meta}</div> : null}
    </div>
  );
}

function ActionButton({
  label,
  tone,
}: {
  label: string;
  tone: "dark" | "green" | "red";
}) {
  const backgrounds = {
    dark: "#1f2937",
    green: "#166534",
    red: "#991b1b",
  };

  return (
    <button
      type="button"
      style={{
        background: backgrounds[tone],
        color: "#fff",
        border: 0,
        borderRadius: 999,
        padding: "12px 18px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    return (
      <main style={{ padding: 32 }}>
        <Panel title="Dashboard">
          <EmptyState message="You need to sign in before using the dashboard." />
        </Panel>
      </main>
    );
  }

  const role = session.user.role as string;

  if (!session.activeBarId) {
    return (
      <main style={{ padding: 32 }}>
        <Panel title="Dashboard">
          <EmptyState message="No active bar selected yet. Select a bar first to load dashboard data." />
        </Panel>
      </main>
    );
  }

  const activeBar = await prisma.bar.findUnique({
    where: { id: session.activeBarId },
    select: { name: true },
  });

  const navItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Tasks", href: "/dashboard/tasks" },
    { label: "Shifts", href: "/dashboard/shifts" },
    { label: "Time Logs", href: "/dashboard/timelogs" },
  ];

  if (role === "OWNER") {
    navItems.push({ label: "Export", href: "/dashboard/export" });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  let ownerShifts: ShiftSummary[] = [];
  let ownerTasks: TaskSummary[] = [];
  let employeeShift: ShiftSummary | null = null;
  let employeeTasks: TaskSummary[] = [];
  let managerShifts: ShiftSummary[] = [];
  let managerTasks: TaskSummary[] = [];
  let managerEmployees: EmployeeSummary[] = [];

  if (role === "OWNER") {
    const [shifts, tasks] = await Promise.all([
      prisma.shift.findMany({
        where: { barId: session.activeBarId },
        include: {
          assignedTo: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { startTime: "asc" },
        take: 6,
      }),
      prisma.task.findMany({
        where: { barId: session.activeBarId },
        include: {
          assignedTo: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [{ isUrgent: "desc" }, { dueDate: "asc" }],
        take: 6,
      }),
    ]);

    ownerShifts = shifts;
    ownerTasks = tasks;
  } else if (role === "MANAGER") {
    const [shifts, tasks, employees] = await Promise.all([
      prisma.shift.findMany({
        where: { barId: session.activeBarId },
        include: {
          assignedTo: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { startTime: "asc" },
        take: 6,
      }),
      prisma.task.findMany({
        where: { barId: session.activeBarId },
        include: {
          assignedTo: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [{ isUrgent: "desc" }, { dueDate: "asc" }],
        take: 6,
      }),
      prisma.employeeBar.findMany({
        where: {
          barId: session.activeBarId,
          isActive: true,
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { hiredAt: "desc" },
        take: 8,
      }),
    ]);

    managerShifts = shifts;
    managerTasks = tasks;
    managerEmployees = employees;
  } else {
    const [shift, tasks] = await Promise.all([
      prisma.shift.findFirst({
        where: {
          barId: session.activeBarId,
          assignedToId: session.user.id,
          startTime: { lt: todayEnd },
          endTime: { gte: todayStart },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.task.findMany({
        where: {
          barId: session.activeBarId,
          assignedToId: session.user.id,
          status: { not: TaskStatus.DONE },
        },
        orderBy: [{ isUrgent: "desc" }, { dueDate: "asc" }],
        take: 4,
      }),
    ]);

    employeeShift = shift;
    employeeTasks = tasks;
  }

  return (
    <Shell
      userName={`${session.user.firstName} ${session.user.lastName}`}
      role={role}
      barName={activeBar?.name ?? "Selected bar"}
      navItems={navItems}
    >
      {role === "OWNER" ? (
        <>
          <Hero
            title="Owner overview"
            subtitle="Track scheduling, task load, and monthly reporting from one clean control surface."
            action="Monthly export"
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 20,
            }}
          >
            <Panel title="Shifts" action="Manage">
              {ownerShifts.length === 0 ? (
                <EmptyState message="No shifts scheduled for this bar yet." />
              ) : (
                <ItemList>
                  {ownerShifts.map((shift) => (
                    <ItemCard
                      key={shift.id}
                      title={shift.title || "Open shift"}
                      subtitle={formatTimeRange(shift.startTime, shift.endTime)}
                      meta={
                        shift.assignedTo
                          ? `${shift.assignedTo.firstName} ${shift.assignedTo.lastName}`
                          : "Unassigned"
                      }
                    />
                  ))}
                </ItemList>
              )}
            </Panel>

            <Panel title="Tasks" action="Create">
              {ownerTasks.length === 0 ? (
                <EmptyState message="No tasks created yet for this bar." />
              ) : (
                <ItemList>
                  {ownerTasks.map((task) => (
                    <ItemCard
                      key={task.id}
                      title={task.title}
                      subtitle={`Due ${formatDate(task.dueDate)}`}
                      meta={`Status: ${task.status}`}
                    />
                  ))}
                </ItemList>
              )}
            </Panel>

            <Panel title="Export" action="Open">
              <EmptyState message="Generate monthly attendance exports and review rounded versus real working hours." />
            </Panel>
          </div>
        </>
      ) : null}

      {role === "MANAGER" ? (
        <>
          <Hero
            title="Manager workspace"
            subtitle="Create tasks, adjust shifts, and keep the team list visible without extra clutter."
            action="New task"
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 20,
            }}
          >
            <Panel title="Create tasks" action="Quick access">
              {managerTasks.length === 0 ? (
                <EmptyState message="No tasks available yet." />
              ) : (
                <ItemList>
                  {managerTasks.map((task) => (
                    <ItemCard
                      key={task.id}
                      title={task.title}
                      subtitle={`Due ${formatDate(task.dueDate)}`}
                      meta={`Status: ${task.status}`}
                    />
                  ))}
                </ItemList>
              )}
            </Panel>

            <Panel title="Manage shifts" action="Today">
              {managerShifts.length === 0 ? (
                <EmptyState message="No shifts scheduled right now." />
              ) : (
                <ItemList>
                  {managerShifts.map((shift) => (
                    <ItemCard
                      key={shift.id}
                      title={shift.title || "Shift"}
                      subtitle={formatTimeRange(shift.startTime, shift.endTime)}
                      meta={
                        shift.assignedTo
                          ? `${shift.assignedTo.firstName} ${shift.assignedTo.lastName}`
                          : "Unassigned"
                      }
                    />
                  ))}
                </ItemList>
              )}
            </Panel>

            <Panel title="View employees" action="Roster">
              {managerEmployees.length === 0 ? (
                <EmptyState message="No employees linked to this bar." />
              ) : (
                <ItemList>
                  {managerEmployees.map((employee) => (
                    <ItemCard
                      key={employee.id}
                      title={`${employee.user.firstName} ${employee.user.lastName}`}
                      meta={employee.user.email}
                    />
                  ))}
                </ItemList>
              )}
            </Panel>
          </div>
        </>
      ) : null}

      {role !== "OWNER" && role !== "MANAGER" ? (
        <>
          <Hero
            title="Your shift today"
            subtitle="Keep the employee dashboard minimal: check your shift, punch in or out, and review assigned tasks."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            <Panel title="Today">
              {!employeeShift ? (
                <EmptyState message="No shift scheduled for today." />
              ) : (
                <ItemCard
                  title={employeeShift.title || "Scheduled shift"}
                  subtitle={formatTimeRange(
                    employeeShift.startTime,
                    employeeShift.endTime
                  )}
                />
              )}
            </Panel>

            <Panel title="Time actions">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <ActionButton label="Clock in" tone="green" />
                <ActionButton label="Clock out" tone="red" />
              </div>
            </Panel>

            <Panel title="Assigned tasks">
              {employeeTasks.length === 0 ? (
                <EmptyState message="No assigned tasks right now." />
              ) : (
                <ItemList>
                  {employeeTasks.map((task) => (
                    <ItemCard
                      key={task.id}
                      title={task.title}
                      subtitle={`Due ${formatDate(task.dueDate)}`}
                      meta={`Status: ${task.status}`}
                    />
                  ))}
                </ItemList>
              )}
            </Panel>
          </div>
        </>
      ) : null}
    </Shell>
  );
}
