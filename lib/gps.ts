const EARTH_RADIUS_METERS = 6371000;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

export function isWithinRadius(
  userLat: number,
  userLon: number,
  barLat: number,
  barLon: number,
  radius: number
): boolean {
  return calculateDistance(userLat, userLon, barLat, barLon) <= radius;
}

export function isWithinRadiusWithAccuracy(
  userLat: number,
  userLon: number,
  barLat: number,
  barLon: number,
  radius: number,
  accuracy: number
): boolean {
  return calculateDistance(userLat, userLon, barLat, barLon) <= radius + Math.max(0, accuracy);
}
