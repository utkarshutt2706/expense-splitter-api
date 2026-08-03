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
