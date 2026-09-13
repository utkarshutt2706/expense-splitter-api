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

    it('scopes queries to the caller and active members even without a date filter', async () => {
        findMany.mockResolvedValue([]);
        await service.getDashboard('me');
        const calls = findMany.mock.calls as [
            { where: unknown; include: { members: unknown; expenses: unknown; payments: unknown } },
        ][];
        expect(calls[0][0].where).toEqual({ members: { some: { userId: 'me', leftAt: null } } });
        expect(calls[0][0].include).toEqual({
            members: {
                where: { leftAt: null },
                include: { user: { select: { id: true, name: true } } },
            },
            expenses: { where: {}, include: { splits: true } },
            payments: { where: {} },
        });
    });
    it.each([
        [undefined, '2026-01-01'],
        ['2026-01-01', '2026-01-01'],
        ['2026-01-01T00:00:00Z', '2026-01-01T01:00:00+01:00'],
    ])('rejects empty/equal intervals before reading data', async (from, to) => {
        await expect(service.getDashboard('me', from, to)).rejects.toThrow();
        expect(findMany).not.toHaveBeenCalled();
    });
    it('accepts exactly one calendar year and propagates DB failure', async () => {
        const error = new Error('DB unavailable');
        findMany.mockRejectedValue(error);
        await expect(service.getDashboard('me', '2024-02-29', '2025-03-01')).rejects.toBe(error);
        expect(findMany).toHaveBeenCalledTimes(1);
    });
    it('accumulates repeated buckets and deterministically sorts tied groups and members', async () => {
        const makeGroup = (id: string, name: string) => ({
            id,
            name,
            members: [
                { userId: 'me', user: { id: 'me', name: 'Zed' } },
                { userId: 'friend', user: { id: 'friend', name: 'Amy' } },
            ],
            expenses: [2, 1, 1].map((day) => ({
                amount: decimal(0.2),
                paidByUserId: 'me',
                paidOn: new Date(`2026-08-0${day}T00:00:00Z`),
                splits: [
                    { userId: 'me', amount: decimal(0.1) },
                    { userId: 'friend', amount: decimal(0.1) },
                ],
            })),
            payments: [],
        });
        findMany.mockResolvedValue([makeGroup('z', 'Zoo'), makeGroup('a', 'Alpha')]);
        const result = await service.getDashboard('me');
        expect(result.actualPaid).toBe(1.2);
        expect(result.currentUserShare).toBe(0.6);
        expect(result.groupSpend.map((g) => g.groupId)).toEqual(['a', 'z']);
        expect(result.groupSpend[0].memberShares).toEqual([
            { userId: 'friend', name: 'Amy', amount: 0.3, isCurrentUser: false },
            { userId: 'me', name: 'Zed', amount: 0.3, isCurrentUser: true },
        ]);
        expect(result.groupSpend[0].spendingByMonth).toEqual([
            { month: '2026-08', amount: 0.6, actualPaid: 0.6, currentUserShare: 0.3 },
        ]);
        expect(result.groupSpend[0].spendingByDay).toEqual([
            { date: '2026-08-01', amount: 0.4, actualPaid: 0.4, currentUserShare: 0.2 },
            { date: '2026-08-02', amount: 0.2, actualPaid: 0.2, currentUserShare: 0.1 },
        ]);
    });
    it('retains historical spending after a settled participant leaves the group', async () => {
        findMany.mockResolvedValue([
            {
                id: 'trip',
                name: 'Trip',
                members: [{ userId: 'me', user: { id: 'me', name: 'Me' } }],
                expenses: [
                    {
                        amount: decimal(20),
                        paidByUserId: 'me',
                        paidOn: new Date('2026-08-01'),
                        splits: [
                            { userId: 'me', amount: decimal(10) },
                            { userId: 'left', amount: decimal(10) },
                        ],
                    },
                ],
                payments: [{ fromUserId: 'left', toUserId: 'me', amount: decimal(10) }],
            },
        ]);
        await expect(service.getDashboard('me')).resolves.toEqual({
            actualPaid: 20,
            currentUserShare: 10,
            groupSpend: [
                {
                    groupId: 'trip',
                    name: 'Trip',
                    amount: 20,
                    actualPaid: 20,
                    currentUserShare: 10,
                    currentBalance: 0,
                    memberShares: [{ userId: 'me', name: 'Me', amount: 10, isCurrentUser: true }],
                    spendingByMonth: [
                        { month: '2026-08', amount: 20, actualPaid: 20, currentUserShare: 10 },
                    ],
                    spendingByDay: [
                        { date: '2026-08-01', amount: 20, actualPaid: 20, currentUserShare: 10 },
                    ],
                },
            ],
        });
    });
});
