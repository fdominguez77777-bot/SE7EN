import {
  dailyNetSeries,
  directionForType,
  isWalletMember,
  monthlyNetSeries,
  parseOccurredOn,
  previousWindow,
  signedCents,
  summarizeWallet,
  WALLET_MESSAGES,
  WalletStatus,
  WalletTransactionType,
  walletCreateBlockReason,
  withRunningBalances,
} from './wallet.rules';
import { formatUsdFromCents } from '../compensation/compensation-money';

describe('wallet ledger', () => {
  it('lets every member role keep a private wallet', () => {
    expect(isWalletMember('ADMIN')).toBe(true);
    expect(isWalletMember('BID_MANAGER')).toBe(true);
    expect(isWalletMember('BIDDER')).toBe(true);
    expect(isWalletMember('GUEST')).toBe(false);
  });

  it('treats received as inflow and payments, billing, and payroll as outflow', () => {
    expect(directionForType(WalletTransactionType.RECEIVED)).toBe('IN');
    expect(directionForType(WalletTransactionType.PAYMENT)).toBe('OUT');
    expect(directionForType(WalletTransactionType.BILLING)).toBe('OUT');
    expect(directionForType(WalletTransactionType.PAYROLL)).toBe('OUT');
    expect(directionForType(WalletTransactionType.ADJUSTMENT, 'IN')).toBe('IN');
    expect(directionForType(WalletTransactionType.ADJUSTMENT, 'OUT')).toBe('OUT');
  });

  it('rejects adjustments without a direction', () => {
    expect(() => directionForType(WalletTransactionType.ADJUSTMENT)).toThrow(
      WALLET_MESSAGES.invalidDirection,
    );
  });

  it('builds a running cash balance in chronological order', () => {
    const rows = withRunningBalances([
      { signedCents: signedCents('IN', '1000.00') },
      { signedCents: signedCents('OUT', '250.50') },
      { signedCents: signedCents('OUT', '40.00') },
    ]);
    expect(rows.map((row) => row.balanceAfter)).toEqual([
      '1000.00',
      '749.50',
      '709.50',
    ]);
  });

  it('summarizes posted cash only and ignores voids', () => {
    const summary = summarizeWallet(
      [
        {
          status: WalletStatus.POSTED,
          type: WalletTransactionType.RECEIVED,
          signedCents: signedCents('IN', '500.00'),
          occurredOn: '2026-09-10',
        },
        {
          status: WalletStatus.POSTED,
          type: WalletTransactionType.BILLING,
          signedCents: signedCents('OUT', '80.00'),
          occurredOn: '2026-09-12',
        },
        {
          status: WalletStatus.VOID,
          type: WalletTransactionType.PAYMENT,
          signedCents: signedCents('OUT', '900.00'),
          occurredOn: '2026-09-12',
        },
      ],
      { from: '2026-09-01', to: '2026-09-30' },
    );
    expect(summary.balance).toBe('420.00');
    expect(summary.periodIn).toBe('500.00');
    expect(summary.periodOut).toBe('80.00');
    expect(summary.periodNet).toBe('420.00');
    expect(summary.billing).toBe('80.00');
    expect(summary.postedCount).toBe(2);
  });

  it('blocks incomplete ledger entries', () => {
    expect(
      walletCreateBlockReason({
        type: 'TIP',
        amount: '10',
        occurredOn: '2026-09-18',
        counterparty: 'Ada',
        method: 'BANK',
      }),
    ).toBe(WALLET_MESSAGES.invalidType);
    expect(
      walletCreateBlockReason({
        type: 'RECEIVED',
        amount: '0',
        occurredOn: '2026-09-18',
        counterparty: 'Ada',
        method: 'BANK',
      }),
    ).toBe(WALLET_MESSAGES.invalidAmount);
    expect(parseOccurredOn('2026-09-18')).toBe('2026-09-18');
    expect(parseOccurredOn('2026-13-40')).toBeNull();
    expect(formatUsdFromCents(signedCents('IN', '12.5'))).toBe('12.50');
  });

  it('uses the previous calendar month for a full-month window', () => {
    expect(previousWindow('2026-09-01', '2026-09-30')).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(previousWindow('2026-09-01', '2026-09-07')).toEqual({
      from: '2026-08-25',
      to: '2026-08-31',
    });
  });

  it('rolls monthly net for the year strip', () => {
    const series = monthlyNetSeries(
      [
        {
          status: WalletStatus.POSTED,
          signedCents: signedCents('IN', '200'),
          occurredOn: '2026-08-12',
        },
        {
          status: WalletStatus.POSTED,
          signedCents: signedCents('OUT', '50'),
          occurredOn: '2026-09-02',
        },
      ],
      ['2026-08', '2026-09'],
    );
    expect(series.map((row) => row.net)).toEqual(['200.00', '-50.00']);
  });

  it('rolls daily net for the cash strip', () => {
    const series = dailyNetSeries(
      [
        {
          status: WalletStatus.POSTED,
          signedCents: signedCents('IN', '100'),
          occurredOn: '2026-09-17',
        },
        {
          status: WalletStatus.POSTED,
          signedCents: signedCents('OUT', '30'),
          occurredOn: '2026-09-17',
        },
        {
          status: WalletStatus.POSTED,
          signedCents: signedCents('OUT', '10'),
          occurredOn: '2026-09-18',
        },
      ],
      ['2026-09-17', '2026-09-18', '2026-09-19'],
    );
    expect(series.map((row) => row.net)).toEqual(['70.00', '-10.00', '0.00']);
  });
});
