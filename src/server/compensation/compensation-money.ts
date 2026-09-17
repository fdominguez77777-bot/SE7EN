const RATE_SCALE = 4;

export function parseScaled(value: string | number, scale = RATE_SCALE): bigint {
  const raw = String(value).trim();
  if (!raw || raw === '-' || raw === '.') {
    throw new Error('Invalid decimal');
  }
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [wholePart, fractionPart = ''] = unsigned.split('.');
  if (!/^\d+$/.test(wholePart || '0') || !/^\d*$/.test(fractionPart)) {
    throw new Error('Invalid decimal');
  }
  const fraction = (fractionPart + '0'.repeat(scale)).slice(0, scale);
  const digits = `${wholePart || '0'}${fraction}`.replace(/^0+(?=\d)/, '');
  const scaled = BigInt(digits || '0');
  return negative ? -scaled : scaled;
}

export function roundScaledToCents(scaled: bigint): bigint {
  const sign = scaled < 0n ? -1n : 1n;
  const abs = scaled < 0n ? -scaled : scaled;
  return sign * ((abs + 50n) / 100n);
}

export function payCents(count: number, rate: string): bigint {
  return roundScaledToCents(BigInt(count) * parseScaled(rate));
}

export function formatUsdFromCents(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  const dollars = abs / 100n;
  const remainder = (abs % 100n).toString().padStart(2, '0');
  return `${sign}${dollars}.${remainder}`;
}

export function centsToNumeric(cents: bigint): string {
  return formatUsdFromCents(cents);
}

export function bidderPay(params: {
  applicationCount: number;
  interviewCount: number;
  applicationRate: string;
  interviewRate: string;
}) {
  const applicationPay = payCents(params.applicationCount, params.applicationRate);
  const interviewPay = payCents(params.interviewCount, params.interviewRate);
  const total = applicationPay + interviewPay;
  return {
    applicationPayAmount: centsToNumeric(applicationPay),
    interviewPayAmount: centsToNumeric(interviewPay),
    totalAmount: centsToNumeric(total),
    hasBasePay: false,
  };
}

export function managerPay(weeklySalary: string) {
  return {
    weeklySalaryRate: formatUsdFromCents(roundScaledToCents(parseScaled(weeklySalary, 4))),
    totalAmount: formatUsdFromCents(roundScaledToCents(parseScaled(weeklySalary, 4))),
  };
}

export function sumUsd(values: Array<string | number>) {
  const cents = values.reduce(
    (sum, value) => sum + roundScaledToCents(parseScaled(value, 4)),
    0n,
  );
  return formatUsdFromCents(cents);
}
