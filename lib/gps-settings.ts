import "server-only";

import { prisma } from "@/lib/prisma";
import { getOrSetRuntimeCache, invalidateRuntimeCache } from "@/lib/runtime-cache";

export const DEFAULT_GLOBAL_GPS_RADIUS = 90;
/**
 * The widest radius a venue gets from the global setting. A venue above it was
 * set wider on purpose - the App Review demo accepts clock-ins from anywhere -
 * and keeps its own: the global change, or the owner saving the clock-in
 * point, brought the demo back to 25 m and reviewers could not clock in.
 */
export const MAX_GLOBAL_GPS_RADIUS = 1000;
const followsGlobal = { lte: MAX_GLOBAL_GPS_RADIUS };

function normalizeGpsRadius(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_GLOBAL_GPS_RADIUS;
  }

  return Math.min(MAX_GLOBAL_GPS_RADIUS, Math.max(0, Math.round(value)));
}

export async function getGlobalGpsRadius() {
  return getOrSetRuntimeCache("global-gps-radius", 60_000, async () => {
    const settings = await prisma.barSettings.findFirst({
      where: {
        gpsRadius: followsGlobal,
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
      where: { radiusMeters: followsGlobal },
      data: {
        radiusMeters: gpsRadius,
      },
    }),
    prisma.barSettings.updateMany({
      where: { OR: [{ gpsRadius: null }, { gpsRadius: followsGlobal }] },
      data: {
        gpsRadius,
      },
    }),
  ]);

  invalidateRuntimeCache("global-gps-radius");

  return gpsRadius;
}
