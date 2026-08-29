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
