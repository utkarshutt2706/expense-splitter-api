import { calculateNetBalances, simplifyDebts } from './balance-calculator';

describe('calculateNetBalances', () => {
    it('gives the payer credit for what everyone else owes on an expense', () => {
        const result = calculateNetBalances(
            ['a', 'b', 'c'],
            [
                {
                    paidByUserId: 'a',
                    splits: [
                        { userId: 'a', amount: 100 },
                        { userId: 'b', amount: 100 },
                        { userId: 'c', amount: 100 },
                    ],
                },
            ],
            [],
        );

        expect(result).toEqual(
            expect.arrayContaining([
                { userId: 'a', balance: 200 },
                { userId: 'b', balance: -100 },
                { userId: 'c', balance: -100 },
            ]),
        );
    });

    it('excludes the payer from their own share (no self-debt)', () => {
        const result = calculateNetBalances(
            ['a', 'b'],
            [
                {
                    paidByUserId: 'a',
                    splits: [
                        { userId: 'a', amount: 50 },
                        { userId: 'b', amount: 50 },
                    ],
                },
            ],
            [],
        );

        const a = result.find((r) => r.userId === 'a');
        expect(a?.balance).toBe(50);
    });

    it('handles an expense where the payer is excluded from the split', () => {
        const result = calculateNetBalances(
            ['a', 'b', 'c'],
            [
                {
                    paidByUserId: 'a',
                    splits: [
                        { userId: 'b', amount: 50 },
                        { userId: 'c', amount: 50 },
                    ],
                },
            ],
            [],
        );

        expect(result).toEqual(
            expect.arrayContaining([
                { userId: 'a', balance: 100 },
                { userId: 'b', balance: -50 },
                { userId: 'c', balance: -50 },
            ]),
        );
    });

    it('accumulates balances across multiple expenses', () => {
        const result = calculateNetBalances(
            ['a', 'b'],
            [
                {
                    paidByUserId: 'a',
                    splits: [
                        { userId: 'a', amount: 50 },
                        { userId: 'b', amount: 50 },
                    ],
                },
                {
                    paidByUserId: 'b',
                    splits: [
                        { userId: 'a', amount: 30 },
                        { userId: 'b', amount: 30 },
                    ],
                },
            ],
            [],
        );

        expect(result).toEqual(
            expect.arrayContaining([
                { userId: 'a', balance: 20 },
                { userId: 'b', balance: -20 },
            ]),
        );
    });

    it('moves the sender toward positive and the recipient toward negative on a payment', () => {
        const result = calculateNetBalances(
            ['a', 'b'],
            [],
            [{ fromUserId: 'a', toUserId: 'b', amount: 40 }],
        );

        expect(result).toEqual(
            expect.arrayContaining([
                { userId: 'a', balance: 40 },
                { userId: 'b', balance: -40 },
            ]),
        );
    });

    it('nets a payment against an equivalent expense debt to zero', () => {
        const result = calculateNetBalances(
            ['a', 'b'],
            [
                {
                    paidByUserId: 'b',
                    splits: [
                        { userId: 'a', amount: 40 },
                        { userId: 'b', amount: 40 },
                    ],
                },
            ],
            [{ fromUserId: 'a', toUserId: 'b', amount: 40 }],
        );

        expect(result).toEqual(
            expect.arrayContaining([
                { userId: 'a', balance: 0 },
                { userId: 'b', balance: 0 },
            ]),
        );
    });

    it('returns a zero balance for a member with no activity', () => {
        const result = calculateNetBalances(['a', 'b', 'c'], [], []);

        expect(result).toEqual(
            expect.arrayContaining([
                { userId: 'a', balance: 0 },
                { userId: 'b', balance: 0 },
                { userId: 'c', balance: 0 },
            ]),
        );
    });
});

describe('simplifyDebts', () => {
    it('returns no transactions when everyone is settled', () => {
        const result = simplifyDebts([
            { userId: 'a', balance: 0 },
            { userId: 'b', balance: 0 },
        ]);

        expect(result).toEqual([]);
    });

    it('produces a single transaction for a simple two-person debt', () => {
        const result = simplifyDebts([
            { userId: 'a', balance: -100 },
            { userId: 'b', balance: 100 },
        ]);

        expect(result).toEqual([{ fromUserId: 'a', toUserId: 'b', amount: 100 }]);
    });

    it('collapses a chain: A owes B, B owes C the same amount, into one A to C transaction', () => {
        const result = calculateNetBalances(
            ['a', 'b', 'c'],
            [
                {
                    paidByUserId: 'b',
                    splits: [
                        { userId: 'a', amount: 100 },
                        { userId: 'b', amount: 0 },
                    ],
                },
                {
                    paidByUserId: 'c',
                    splits: [
                        { userId: 'b', amount: 100 },
                        { userId: 'c', amount: 0 },
                    ],
                },
            ],
            [],
        );
        const settlements = simplifyDebts(result);

        const b = result.find((r) => r.userId === 'b');
        expect(b?.balance).toBe(0);
        expect(settlements).toEqual([{ fromUserId: 'a', toUserId: 'c', amount: 100 }]);
    });

    it('minimizes transactions across multiple creditors and debtors', () => {
        const result = simplifyDebts([
            { userId: 'a', balance: -60 },
            { userId: 'b', balance: -40 },
            { userId: 'c', balance: 100 },
        ]);

        expect(result).toEqual([
            { fromUserId: 'a', toUserId: 'c', amount: 60 },
            { fromUserId: 'b', toUserId: 'c', amount: 40 },
        ]);
    });

    it('handles a debtor whose debt spans multiple creditors', () => {
        const result = simplifyDebts([
            { userId: 'a', balance: -100 },
            { userId: 'b', balance: 60 },
            { userId: 'c', balance: 40 },
        ]);

        expect(result).toEqual([
            { fromUserId: 'a', toUserId: 'b', amount: 60 },
            { fromUserId: 'a', toUserId: 'c', amount: 40 },
        ]);
    });

    it('ignores members who are already settled', () => {
        const result = simplifyDebts([
            { userId: 'a', balance: -50 },
            { userId: 'b', balance: 0 },
            { userId: 'c', balance: 50 },
        ]);

        expect(result).toEqual([{ fromUserId: 'a', toUserId: 'c', amount: 50 }]);
    });
});

describe('balance conservation', () => {
    it.each([1, 3, 101, 99999])(
        'settles every account exactly for %i cents without mutating input',
        (cents) => {
            const balances = [
                { userId: 'a', balance: -cents / 100 },
                { userId: 'b', balance: -0.07 },
                { userId: 'c', balance: cents / 100 },
                { userId: 'd', balance: 0.07 },
            ];
            const before = balances.map((value) => ({ ...value }));
            const remaining = new Map(
                balances.map((value) => [value.userId, Math.round(value.balance * 100)]),
            );
            for (const payment of simplifyDebts(balances)) {
                expect(payment.amount).toBeGreaterThan(0);
                expect(payment.fromUserId).not.toBe(payment.toUserId);
                const paid = Math.round(payment.amount * 100);
                remaining.set(payment.fromUserId, remaining.get(payment.fromUserId)! + paid);
                remaining.set(payment.toUserId, remaining.get(payment.toUserId)! - paid);
            }
            expect([...remaining.values()]).toEqual([0, 0, 0, 0]);
            expect(balances).toEqual(before);
        },
    );
    it('includes historical members supplied by the caller and preserves cent-level overpayment', () => {
        expect(
            calculateNetBalances(
                ['a', 'former'],
                [{ paidByUserId: 'a', splits: [{ userId: 'former', amount: 0.1 }] }],
                [{ fromUserId: 'former', toUserId: 'a', amount: 0.2 }],
            ),
        ).toEqual([
            { userId: 'a', balance: -0.1 },
            { userId: 'former', balance: 0.1 },
        ]);
    });
    it('handles a payer outside the requested result set without NaN balances', () => {
        expect(
            calculateNetBalances(
                ['a'],
                [{ paidByUserId: 'historical', splits: [{ userId: 'a', amount: 1.25 }] }],
                [],
            ),
        ).toEqual([{ userId: 'a', balance: -1.25 }]);
    });
    it('returns no settlements for an empty ledger', () => {
        expect(calculateNetBalances([], [], [])).toEqual([]);
        expect(simplifyDebts([])).toEqual([]);
    });
});
