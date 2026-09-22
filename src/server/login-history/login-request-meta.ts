import type { IncomingHttpHeaders } from 'node:http';

export type LoginRequestMeta = {
  ipAddress: string;
  country: string | null;
  region: string | null;
  city: string | null;
  userAgent: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
};

function headerValue(
  headers: IncomingHttpHeaders,
  name: string,
): string | null {
  const raw = headers[name];
  if (Array.isArray(raw)) {
    return raw[0]?.trim() || null;
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return null;
}

export function clientIpAddress(
  headers: IncomingHttpHeaders,
  remoteAddress?: string | null,
): string {
  const forwarded = headerValue(headers, 'x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]!.trim();
  }
  return (
    headerValue(headers, 'cf-connecting-ip') ||
    headerValue(headers, 'x-real-ip') ||
    headerValue(headers, 'x-vercel-forwarded-for') ||
    remoteAddress ||
    'unknown'
  );
}

export function parseUserAgent(userAgent: string | null): {
  device: string | null;
  browser: string | null;
  os: string | null;
} {
  if (!userAgent) {
    return { device: null, browser: null, os: null };
  }
  const ua = userAgent;

  let browser = 'Browser';
  if (/Edg\//.test(ua)) {
    browser = 'Edge';
  } else if (/OPR\/|Opera/.test(ua)) {
    browser = 'Opera';
  } else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) {
    browser = 'Chrome';
  } else if (/Firefox\//.test(ua)) {
    browser = 'Firefox';
  } else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) {
    browser = 'Safari';
  }

  let os = 'Unknown';
  if (/Windows NT/.test(ua)) {
    os = 'Windows';
  } else if (/Android/.test(ua)) {
    os = 'Android';
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    os = 'iOS';
  } else if (/Mac OS X/.test(ua)) {
    os = 'macOS';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }

  const device = /Mobile|Android|iPhone|iPad|iPod/.test(ua)
    ? 'Mobile'
    : 'Desktop';

  return { device, browser, os };
}

export function loginRequestMeta(
  headers: IncomingHttpHeaders,
  remoteAddress?: string | null,
): LoginRequestMeta {
  const userAgent = headerValue(headers, 'user-agent');
  const parsed = parseUserAgent(userAgent);
  const city = decodeUriComponentSafe(headerValue(headers, 'x-vercel-ip-city'));
  return {
    ipAddress: clientIpAddress(headers, remoteAddress),
    country: headerValue(headers, 'x-vercel-ip-country'),
    region: headerValue(headers, 'x-vercel-ip-country-region'),
    city,
    userAgent: userAgent ? userAgent.slice(0, 512) : null,
    device: parsed.device,
    browser: parsed.browser,
    os: parsed.os,
  };
}

function decodeUriComponentSafe(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function formatLocation(parts: {
  city?: string | null;
  region?: string | null;
  country?: string | null;
}): string {
  const bits = [parts.city, parts.region, parts.country].filter(Boolean);
  return bits.length > 0 ? bits.join(', ') : 'Unknown location';
}
