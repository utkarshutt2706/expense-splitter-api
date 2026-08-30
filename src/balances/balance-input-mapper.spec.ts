import { Prisma } from '@prisma/client';
import { mapBalanceInputs } from './balance-input-mapper';

describe('mapBalanceInputs', () => {
    it('converts only Prisma decimal amounts into calculator numbers', () => {
        const result = mapBalanceInputs(
            [
                {
                    paidByUserId: 'payer',
                    splits: [
                        { userId: 'payer', amount: new Prisma.Decimal('10.25') },
                        { userId: 'member', amount: new Prisma.Decimal('5.125') },
                    ],
                },
            ],
            [
                {
                    fromUserId: 'member',
                    toUserId: 'payer',
                    amount: new Prisma.Decimal('3.75'),
                },
            ],
        );

        expect(result).toEqual({
            expenses: [
                {
                    paidByUserId: 'payer',
                    splits: [
                        { userId: 'payer', amount: 10.25 },
                        { userId: 'member', amount: 5.125 },
                    ],
                },
            ],
            payments: [{ fromUserId: 'member', toUserId: 'payer', amount: 3.75 }],
        });
    });

    it('preserves empty financial collections', () => {
        expect(mapBalanceInputs([], [])).toEqual({ expenses: [], payments: [] });
    });
});
