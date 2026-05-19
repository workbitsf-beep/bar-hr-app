import "server-only";

import { prisma } from "@/lib/prisma";

export const DEFAULT_GLOBAL_GPS_RADIUS = 90;

function normalizeGpsRadius(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_GLOBAL_GPS_RADIUS;
  }

  return Math.min(1000, Math.max(20, Math.round(value)));
}

export async function getGlobalGpsRadius() {
  const settings = await prisma.barSettings.findFirst({
    where: {
      gpsRadius: {
        not: null,
      },
    },
    orderBy: {
      barId: "asc",
    },
    select: {
      gpsRadius: true,
    },
  });

  if (settings?.gpsRadius) {
    return normalizeGpsRadius(settings.gpsRadius);
  }

  const bar = await prisma.bar.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      radiusMeters: true,
    },
  });

  return normalizeGpsRadius(bar?.radiusMeters ?? DEFAULT_GLOBAL_GPS_RADIUS);
}

export async function applyGlobalGpsRadius(nextRadius: number) {
  const gpsRadius = normalizeGpsRadius(nextRadius);

  await prisma.$transaction([
    prisma.bar.updateMany({
      data: {
        radiusMeters: gpsRadius,
      },
    }),
    prisma.barSettings.updateMany({
      data: {
        gpsRadius,
      },
    }),
  ]);

  return gpsRadius;
}
