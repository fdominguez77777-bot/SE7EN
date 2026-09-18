import { parseScaled, roundScaledToCents, formatUsdFromCents } from '../compensation/compensation-money';

export const WalletTransactionType = {
  RECEIVED: 'RECEIVED',
  PAYMENT: 'PAYMENT',
  BILLING: 'BILLING',
  PAYROLL: 'PAYROLL',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export const WalletDirection = {
  IN: 'IN',
  OUT: 'OUT',
} as const;

export const WalletMethod = {
  BANK: 'BANK',
  WIRE: 'WIRE',
  CASH: 'CASH',
  CARD: 'CARD',
  CHECK: 'CHECK',
  OTHER: 'OTHER',
} as const;

export const WalletStatus = {
  POSTED: 'POSTED',
  VOID: 'VOID',
} as const;

export const WALLET_MESSAGES = {
  adminOnly: 'Only signed-in members can use their own wallet.',
  invalidType: 'Choose received, payment, billing, payroll, or adjustment.',
  invalidDirection: 'Adjustments need an in or out direction.',
  invalidAmount: 'Enter an amount greater than zero, up to two decimal places.',
  invalidDate: 'Provide a valid transaction date.',
  invalidMethod: 'Choose a payment method.',
  counterpartyRequired: 'Enter who paid or who was paid.',
  alreadyVoid: 'This transaction is already voided.',
  notFound: 'Wallet transaction not found.',
};

const TYPES = new Set(Object.values(WalletTransactionType));
const METHODS = new Set(Object.values(WalletMethod));
const DIRECTIONS = new Set(Object.values(WalletDirection));

export const WALLET_MEMBER_ROLES = ['ADMIN', 'BID_MANAGER', 'BIDDER'] as const;

export function isWalletMember(role: string) {
  return (WALLET_MEMBER_ROLES as readonly string[]).includes(role);
}

export function isWalletType(value: string) {
  return TYPES.has(value as (typeof WalletTransactionType)[keyof typeof WalletTransactionType]);
}

export function isWalletMethod(value: string) {
  return METHODS.has(value as (typeof WalletMethod)[keyof typeof WalletMethod]);
}

export function directionForType(type: string, adjustmentDirection?: string | null) {
  if (type === WalletTransactionType.RECEIVED) {
    return WalletDirection.IN;
  }
  if (
    type === WalletTransactionType.PAYMENT ||
    type === WalletTransactionType.BILLING ||
    type === WalletTransactionType.PAYROLL
  ) {
    return WalletDirection.OUT;
  }
  if (type === WalletTransactionType.ADJUSTMENT) {
    if (adjustmentDirection && DIRECTIONS.has(adjustmentDirection as 'IN' | 'OUT')) {
      return adjustmentDirection as 'IN' | 'OUT';
    }
    throw new Error(WALLET_MESSAGES.invalidDirection);
  }
  throw new Error(WALLET_MESSAGES.invalidType);
}

export function parseWalletAmountCents(amount: string | number) {
  try {
    const cents = roundScaledToCents(parseScaled(amount, 4));
    if (cents <= 0n) {
      throw new Error(WALLET_MESSAGES.invalidAmount);
    }
    return cents;
  } catch (error) {
    if (error instanceof Error && error.message === WALLET_MESSAGES.invalidAmount) {
      throw error;
    }
    throw new Error(WALLET_MESSAGES.invalidAmount);
  }
}

export function signedCents(direction: string, amount: string | number) {
  const cents = parseWalletAmountCents(amount);
  return direction === WalletDirection.OUT ? -cents : cents;
}

export function parseOccurredOn(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function walletCreateBlockReason(params: {
  type: string;
  amount: string;
  occurredOn: string;
  counterparty: string;
  method: string;
  direction?: string | null;
}) {
  if (!isWalletType(params.type)) {
    return WALLET_MESSAGES.invalidType;
  }
  if (!isWalletMethod(params.method)) {
    return WALLET_MESSAGES.invalidMethod;
  }
  if (!parseOccurredOn(params.occurredOn)) {
    return WALLET_MESSAGES.invalidDate;
  }
  if (!params.counterparty.trim()) {
    return WALLET_MESSAGES.counterpartyRequired;
  }
  try {
    directionForType(params.type, params.direction);
    parseWalletAmountCents(params.amount);
  } catch (error) {
    return error instanceof Error ? error.message : WALLET_MESSAGES.invalidAmount;
  }
  return null;
}

export function withRunningBalances<T extends { signedCents: bigint }>(
  chronological: T[],
) {
  let balance = 0n;
  return chronological.map((row) => {
    balance += row.signedCents;
    return {
      ...row,
      balanceAfter: formatUsdFromCents(balance),
      balanceAfterCents: balance,
    };
  });
}

export function summarizeWallet(
  rows: Array<{
    status: string;
    type: string;
    signedCents: bigint;
    occurredOn: string;
  }>,
  period?: { from: string; to: string },
) {
  const posted = rows.filter((row) => row.status === WalletStatus.POSTED);
  const inPeriod = period
    ? posted.filter(
        (row) => row.occurredOn >= period.from && row.occurredOn <= period.to,
      )
    : posted;
  const inflow = inPeriod
    .filter((row) => row.signedCents > 0n)
    .reduce((sum, row) => sum + row.signedCents, 0n);
  const outflow = inPeriod
    .filter((row) => row.signedCents < 0n)
    .reduce((sum, row) => sum + -row.signedCents, 0n);
  const byType = {
    received: 0n,
    payment: 0n,
    billing: 0n,
    payroll: 0n,
    adjustment: 0n,
  };
  for (const row of inPeriod) {
    if (row.type === WalletTransactionType.RECEIVED) {
      byType.received += row.signedCents;
    } else if (row.type === WalletTransactionType.PAYMENT) {
      byType.payment += -row.signedCents;
    } else if (row.type === WalletTransactionType.BILLING) {
      byType.billing += -row.signedCents;
    } else if (row.type === WalletTransactionType.PAYROLL) {
      byType.payroll += -row.signedCents;
    } else {
      byType.adjustment += row.signedCents;
    }
  }
  const balance = posted.reduce((sum, row) => sum + row.signedCents, 0n);
  return {
    balance: formatUsdFromCents(balance),
    postedCount: posted.length,
    periodCount: inPeriod.length,
    periodIn: formatUsdFromCents(inflow),
    periodOut: formatUsdFromCents(outflow),
    periodNet: formatUsdFromCents(inflow - outflow),
    received: formatUsdFromCents(byType.received),
    payment: formatUsdFromCents(byType.payment),
    billing: formatUsdFromCents(byType.billing),
    payroll: formatUsdFromCents(byType.payroll),
    adjustment: formatUsdFromCents(byType.adjustment),
  };
}

export function addIsoDays(value: string, days: number) {
  const parsed = parseOccurredOn(value);
  if (!parsed) {
    return null;
  }
  const [year, month, day] = parsed.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isoDaysBack(endIso: string, count: number) {
  const end = parseOccurredOn(endIso);
  if (!end || count <= 0) {
    return [];
  }
  return Array.from({ length: count }, (_, index) => addIsoDays(end, -(count - 1 - index))!);
}

export function isoMonthWindow(endYm: string, count = 12) {
  const match = /^(\d{4})-(\d{2})$/.exec(endYm.trim());
  if (!match || count <= 0) {
    return [];
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (count - 1 - index), 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

export function previousWindow(from: string, to: string) {
  const start = parseOccurredOn(from);
  const end = parseOccurredOn(to);
  if (!start || !end || start > end) {
    return null;
  }
  const [year, month, day] = start.split('-').map(Number);
  const lastOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDay = Number(end.slice(8, 10));
  if (
    day === 1 &&
    end.startsWith(start.slice(0, 7)) &&
    endDay === lastOfMonth
  ) {
    const prevLast = new Date(Date.UTC(year, month - 1, 0));
    const prevYm = `${prevLast.getUTCFullYear()}-${String(prevLast.getUTCMonth() + 1).padStart(2, '0')}`;
    return {
      from: `${prevYm}-01`,
      to: `${prevYm}-${String(prevLast.getUTCDate()).padStart(2, '0')}`,
    };
  }
  const span =
    Math.round(
      (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
        86_400_000,
    ) + 1;
  const prevTo = addIsoDays(start, -1);
  const prevFrom = addIsoDays(prevTo!, -(span - 1));
  if (!prevTo || !prevFrom) {
    return null;
  }
  return { from: prevFrom, to: prevTo };
}

export function dailyNetSeries(
  rows: Array<{ status: string; signedCents: bigint; occurredOn: string }>,
  days: string[],
) {
  const posted = rows.filter((row) => row.status === WalletStatus.POSTED);
  return days.map((date) => {
    const net = posted
      .filter((row) => row.occurredOn === date)
      .reduce((sum, row) => sum + row.signedCents, 0n);
    return {
      date,
      net: formatUsdFromCents(net),
      netCents: Number(net),
    };
  });
}

export function monthlyNetSeries(
  rows: Array<{ status: string; signedCents: bigint; occurredOn: string }>,
  months: string[],
) {
  const posted = rows.filter((row) => row.status === WalletStatus.POSTED);
  return months.map((ym) => {
    const inMonth = posted.filter((row) => row.occurredOn.startsWith(ym));
    const inflow = inMonth
      .filter((row) => row.signedCents > 0n)
      .reduce((sum, row) => sum + row.signedCents, 0n);
    const outflow = inMonth
      .filter((row) => row.signedCents < 0n)
      .reduce((sum, row) => sum + -row.signedCents, 0n);
    const net = inflow - outflow;
    return {
      ym,
      in: formatUsdFromCents(inflow),
      out: formatUsdFromCents(outflow),
      net: formatUsdFromCents(net),
      netCents: Number(net),
      count: inMonth.length,
    };
  });
}
