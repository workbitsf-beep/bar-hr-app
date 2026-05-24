import "server-only";

import { prisma } from "@/lib/prisma";
import { getOrSetRuntimeCache, invalidateRuntimeCache } from "@/lib/runtime-cache";

export const DEFAULT_GLOBAL_GPS_RADIUS = 90;

function normalizeGpsRadius(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_GLOBAL_GPS_RADIUS;
  }

  return Math.min(1000, Math.max(0, Math.round(value)));
}

export async function getGlobalGpsRadius() {
  return getOrSetRuntimeCache("global-gps-radius", 60_000, async () => {
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

    if (settings?.gpsRadius !== null && settings?.gpsRadius !== undefined) {
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
  });
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

  invalidateRuntimeCache("global-gps-radius");

  return gpsRadius;
}
