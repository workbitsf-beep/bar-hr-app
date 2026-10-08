import type { Department } from "@prisma/client";
import { calculateDistance } from "@/lib/gps";

/**
 * A company's sites that look like separate businesses sharing one
 * subscription. Nothing is blocked: the console shows it, and the owner of
 * Workbit decides whether to ask for the company registration (visura).
 *
 * The signs: no employee works in more than one site, each site has its own
 * lead, and the sites are far apart. The office staff - owner, managers,
 * administration - may well be shared by two separate businesses, so they
 * do not count as a link between sites. One sign alone is normal for a real
 * company; together they deserve a look.
 */

const FAR_APART_METERS = 100_000;

export function checkSiteIndependence(input: {
  sites: Array<{ slot: Department; name: string; latitude: number | null; longitude: number | null }>;
  members: Array<{ role: string; department: Department | null; helpsIn: Department[]; isDepartmentLead: boolean }>;
}) {
  const { sites, members } = input;
  if (sites.length < 2) return { suspicious: false, reasons: [] as string[] };

  const slots = new Set(sites.map((site) => site.slot));
  const shared = members.some(
    (member) =>
      member.role === "EMPLOYEE" &&
      member.department && slots.has(member.department) && member.helpsIn.some((slot) => slot !== member.department && slots.has(slot))
  );
  const staffed = sites.filter((site) => members.some((member) => member.department === site.slot));
  const ledEverywhere = sites.every((site) => members.some((member) => member.department === site.slot && member.isDepartmentLead));

  let farthest = 0;
  for (const a of sites) {
    for (const b of sites) {
      if (a === b || a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) continue;
      farthest = Math.max(farthest, calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude));
    }
  }

  const reasons: string[] = [];
  if (!shared && staffed.length === sites.length) reasons.push("nessun dipendente lavora in più di una sede");
  if (ledEverywhere) reasons.push("ogni sede ha un suo responsabile");
  if (farthest > FAR_APART_METERS) reasons.push(`sedi lontane fino a ${Math.round(farthest / 1000)} km`);

  return { suspicious: reasons.length >= 2, reasons };
}
