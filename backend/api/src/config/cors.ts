export function parseCorsOrigin(value: string): boolean | string | string[] {
  const trimmed = value.trim();
  if (trimmed === '*') {
    return true;
  }

  const origins = trimmed
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return false;
  }

  return origins.length === 1 ? origins[0] : origins;
}

const PRIVATE_LAN =
  /^https?:\/\/(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?::\d+)?$/i;

export function isPrivateLanOrigin(origin: string): boolean {
  return PRIVATE_LAN.test(origin);
}

export function isAllowedCorsOrigin(
  origin: string | undefined,
  configured: boolean | string | string[],
  allowPrivateLan: boolean,
): boolean {
  if (!origin) {
    return true;
  }
  if (configured === true) {
    return true;
  }
  if (configured === false) {
    return allowPrivateLan && isPrivateLanOrigin(origin);
  }
  const allowed = Array.isArray(configured) ? configured : [configured];
  if (allowed.includes(origin)) {
    return true;
  }
  return allowPrivateLan && isPrivateLanOrigin(origin);
}
