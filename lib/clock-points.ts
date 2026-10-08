import { ActivityType, type Department } from "@prisma/client";
import { isSiteSlot } from "@/lib/departments";
import { isWithinRadius } from "@/lib/gps";
import { entitlementsOf } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

/**
 * Where someone may clock in or out.
 *
 * A venue has one point. A company with sites (Pro, or the Sedi extra) has
 * one per site: the shift's site when the shift has one, otherwise the
 * person's site, otherwise any of its sites. Without sites with a point, the
 * venue's own point, as always.
 */

type Point = { latitude: number; longitude: number };

export type ClockPlace = {
  points: Point[];
  radius: number | null;
  /** A company that does not plan shifts: clock-ins need no shift. */
  shiftOptional: boolean;
};

export async function clockPlaceFor(input: { barId: string; userId: string; shiftDepartment?: Department | null }): Promise<ClockPlace> {
  const [bar, settings, membership] = await Promise.all([
    prisma.bar.findUnique({
      where: { id: input.barId },
      select: {
        activityType: true,
        plan: true,
        departmentsAddon: true,
        extraSeatPacks: true,
        brandingAddon: true,
        sites: { where: { latitude: { not: null }, longitude: { not: null } }, select: { slot: true, latitude: true, longitude: true } },
      },
    }),
    prisma.barSettings.findUnique({
      where: { barId: input.barId },
      select: { gpsLatitude: true, gpsLongitude: true, gpsRadius: true, shiftsEnabled: true, companyShiftsEnabled: true },
    }),
    prisma.employeeBar.findFirst({
      where: { barId: input.barId, userId: input.userId, isActive: true },
      select: { department: true },
    }),
  ]);

  const company = bar?.activityType === ActivityType.COMPANY;
  const shiftOptional = Boolean(company && (settings?.companyShiftsEnabled === false || settings?.shiftsEnabled === false));
  const venuePoint: Point[] =
    settings?.gpsLatitude != null && settings.gpsLongitude != null
      ? [{ latitude: settings.gpsLatitude, longitude: settings.gpsLongitude }]
      : [];

  const sites = company && bar && entitlementsOf(bar).departments ? bar.sites : [];
  if (sites.length === 0) {
    return { points: venuePoint, radius: settings?.gpsRadius ?? null, shiftOptional };
  }

  const sitePoints = (slot: Department | null | undefined) =>
    sites
      .filter((site) => !slot || site.slot === slot)
      .map((site) => ({ latitude: site.latitude as number, longitude: site.longitude as number }));

  const wanted = isSiteSlot(input.shiftDepartment)
    ? input.shiftDepartment
    : isSiteSlot(membership?.department)
      ? membership?.department
      : null;
  const ownPoints = wanted ? sitePoints(wanted) : [];

  return {
    points: ownPoints.length ? ownPoints : sitePoints(null),
    radius: settings?.gpsRadius ?? null,
    shiftOptional,
  };
}

export function isAtClockPlace(place: ClockPlace, latitude: number, longitude: number) {
  if (place.radius === null) return false;
  return place.points.some((point) => isWithinRadius(latitude, longitude, point.latitude, point.longitude, place.radius as number));
}
