import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

const decimal = (value: number): Prisma.Decimal => new Prisma.Decimal(value);

describe('DashboardService', () => {
    const findMany = jest.fn();
    const service = new DashboardService({ group: { findMany } } as unknown as PrismaService);

    beforeEach(() => findMany.mockReset());

    it('keeps expense spending and settlement-aware balances distinct', async () => {
        findMany.mockResolvedValue([
            {
                id: 'trip',
                name: 'Trip',
                members: [
                    { userId: 'me', user: { id: 'me', name: 'Me' } },
                    { userId: 'friend', user: { id: 'friend', name: 'Asha' } },
                ],
                expenses: [
                    {
                        createdAt: new Date('2026-07-10T00:00:00Z'),
                        paidOn: new Date('2026-07-09T00:00:00Z'),
                        amount: decimal(120),
                        paidByUserId: 'me',
                        splits: [
                            { userId: 'me', amount: decimal(60) },
                            { userId: 'friend', amount: decimal(60) },
                        ],
                    },
                    {
                        createdAt: new Date('2026-08-10T00:00:00Z'),
                        paidOn: new Date('2026-08-10T00:00:00Z'),
                        amount: decimal(80.25),
                        paidByUserId: 'friend',
                        splits: [
                            { userId: 'me', amount: decimal(20.25) },
                            { userId: 'friend', amount: decimal(60) },
                        ],
                    },
                ],
                payments: [{ fromUserId: 'friend', toUserId: 'me', amount: decimal(20) }],
            },
            {
                id: 'empty',
                name: 'Empty group',
                members: [{ userId: 'me', user: { id: 'me', name: 'Me' } }],
                expenses: [],
                payments: [],
            },
        ]);

        const result = await service.getDashboard('me');
        expect(result.actualPaid).toBe(120);
        expect(result.currentUserShare).toBe(80.25);
        expect(result.groupSpend[0]).toEqual(
            expect.objectContaining({
                groupId: 'trip',
                amount: 200.25,
                actualPaid: 120,
                currentUserShare: 80.25,
                currentBalance: 19.75,
            }),
        );
        expect(result.groupSpend[0]?.memberShares).toEqual([
            { userId: 'friend', name: 'Asha', amount: 120, isCurrentUser: false },
            { userId: 'me', name: 'Me', amount: 80.25, isCurrentUser: true },
        ]);
        expect(result.groupSpend[0]?.spendingByMonth).toEqual([
            { month: '2026-07', amount: 120, actualPaid: 120, currentUserShare: 60 },
            { month: '2026-08', amount: 80.25, actualPaid: 0, currentUserShare: 20.25 },
        ]);
        expect(result.groupSpend[0]?.spendingByDay).toEqual([
            { date: '2026-07-09', amount: 120, actualPaid: 120, currentUserShare: 60 },
            { date: '2026-08-10', amount: 80.25, actualPaid: 0, currentUserShare: 20.25 },
        ]);
        expect(result.groupSpend[1]).toEqual(
            expect.objectContaining({ groupId: 'empty', amount: 0 }),
        );
    });

    it('returns no groups when the user has none', async () => {
        findMany.mockResolvedValue([]);
        await expect(service.getDashboard('me')).resolves.toEqual({
            actualPaid: 0,
            currentUserShare: 0,
            groupSpend: [],
        });
    });

    it('filters expenses and settlement payments using an exclusive end instant', async () => {
        findMany.mockResolvedValue([]);
        await service.getDashboard('me', '2026-08-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
        expect(findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                // Jest asymmetric matchers are intentionally typed as any.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                include: expect.objectContaining({
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    expenses: expect.objectContaining({
                        where: {
                            paidOn: {
                                gte: new Date('2026-08-01T00:00:00.000Z'),
                                lt: new Date('2026-09-01T00:00:00.000Z'),
                            },
                        },
                    }),
                    payments: {
                        where: {
                            paidOn: {
                                gte: new Date('2026-08-01T00:00:00.000Z'),
                                lt: new Date('2026-09-01T00:00:00.000Z'),
                            },
                        },
                    },
                }),
            }),
        );
    });

    it('rejects incomplete, reversed, and longer-than-one-year ranges', async () => {
        await expect(service.getDashboard('me', '2026-01-01T00:00:00.000Z')).rejects.toThrow(
            'Both from and to are required',
        );
        await expect(
            service.getDashboard('me', '2026-02-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        ).rejects.toThrow('from must be before to');
        await expect(
            service.getDashboard('me', '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.001Z'),
        ).rejects.toThrow('cannot exceed one year');
    });
});
