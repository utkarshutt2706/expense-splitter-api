import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

const decimal = (value: number): Prisma.Decimal => new Prisma.Decimal(value);

describe('DashboardService', () => {
    let findMany: jest.Mock;
    let service: DashboardService;

    beforeEach(() => {
        findMany = jest.fn();
        service = new DashboardService({ expense: { findMany } } as unknown as PrismaService);
    });

    it('aggregates actual payments, member shares, and group spend', async () => {
        findMany.mockResolvedValue([
            {
                amount: decimal(120),
                paidByUserId: 'me',
                group: { id: 'trip', name: 'Trip' },
                splits: [
                    { userId: 'me', amount: decimal(60), user: { id: 'me', name: 'Me' } },
                    { userId: 'friend', amount: decimal(60), user: { id: 'friend', name: 'Asha' } },
                ],
            },
            {
                amount: decimal(80.25),
                paidByUserId: 'friend',
                group: { id: 'trip', name: 'Trip' },
                splits: [
                    { userId: 'me', amount: decimal(20.25), user: { id: 'me', name: 'Me' } },
                    { userId: 'friend', amount: decimal(60), user: { id: 'friend', name: 'Asha' } },
                ],
            },
            {
                amount: decimal(40),
                paidByUserId: 'me',
                group: { id: 'home', name: 'Home' },
                splits: [{ userId: 'me', amount: decimal(40), user: { id: 'me', name: 'Me' } }],
            },
        ]);

        await expect(service.getDashboard('me')).resolves.toEqual({
            actualPaid: 160,
            currentUserShare: 120.25,
            memberShares: [
                { userId: 'me', name: 'Me', amount: 120.25, isCurrentUser: true },
                { userId: 'friend', name: 'Asha', amount: 120, isCurrentUser: false },
            ],
            groupSpend: [
                {
                    groupId: 'trip',
                    name: 'Trip',
                    amount: 200.25,
                    actualPaid: 120,
                    currentUserShare: 80.25,
                    memberShares: [
                        { userId: 'friend', name: 'Asha', amount: 120, isCurrentUser: false },
                        { userId: 'me', name: 'Me', amount: 80.25, isCurrentUser: true },
                    ],
                },
                {
                    groupId: 'home',
                    name: 'Home',
                    amount: 40,
                    actualPaid: 40,
                    currentUserShare: 40,
                    memberShares: [{ userId: 'me', name: 'Me', amount: 40, isCurrentUser: true }],
                },
            ],
        });
        expect(findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { group: { members: { some: { userId: 'me', leftAt: null } } } },
            }),
        );
    });

    it('returns an empty dashboard when the user has no expenses', async () => {
        findMany.mockResolvedValue([]);

        await expect(service.getDashboard('me')).resolves.toEqual({
            actualPaid: 0,
            currentUserShare: 0,
            memberShares: [],
            groupSpend: [],
        });
    });
});
