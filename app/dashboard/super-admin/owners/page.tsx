import { Role, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";
import { OwnersManager } from "./owners-manager";

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getOwnerWhere(query: string): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = [{ role: Role.OWNER }];

  if (query) {
    conditions.push({
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        {
          ownedBars: {
            some: {
              name: { contains: query, mode: "insensitive" },
            },
          },
        },
        {
          ownedBars: {
            some: {
              legalName: { contains: query, mode: "insensitive" },
            },
          },
        },
        {
          ownedBars: {
            some: {
              city: { contains: query, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  return { AND: conditions };
}

export default async function SuperAdminOwnersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const query = normalizeParam(params.q).trim();
  const error = normalizeParam(params.error);
  const success = normalizeParam(params.success);
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  const owners = await prisma.user.findMany({
    where: getOwnerWhere(query),
    orderBy: [
      {
        firstName: "asc",
      },
      {
        lastName: "asc",
      },
    ],
    take: 12,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      ownedBars: {
        orderBy: {
          createdAt: "desc",
        },
        take: 3,
        select: {
          id: true,
          name: true,
          activityType: true,
        },
      },
    },
  });

  return (
    <SuperAdminFrame
      title="Titolari"
      description="Crea, cerca e aggiorna i responsabili in modo rapido."
    >
      <OwnersManager owners={owners} query={query} error={error} success={success} />
    </SuperAdminFrame>
  );
}
