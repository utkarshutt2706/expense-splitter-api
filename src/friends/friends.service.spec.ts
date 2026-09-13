import { PrismaService } from '../prisma/prisma.service';
import { FriendsService } from './friends.service';

describe('FriendsService', () => {
    let service: FriendsService;
    let prisma: {
        user: { findMany: jest.Mock };
        groupMember: { findMany: jest.Mock };
        group: { findMany: jest.Mock };
    };

    beforeEach(() => {
        prisma = {
            user: { findMany: jest.fn() },
            groupMember: { findMany: jest.fn() },
            group: { findMany: jest.fn() },
        };
        service = new FriendsService(prisma as unknown as PrismaService);
    });

    it('returns an empty list when the user has no active groups', async () => {
        prisma.groupMember.findMany.mockResolvedValueOnce([]);

        await expect(service.findFriends('user-1')).resolves.toEqual([]);
    });

    it('returns active members of shared groups, deduped and excluding self', async () => {
        prisma.groupMember.findMany
            .mockResolvedValueOnce([{ groupId: 'group-1' }, { groupId: 'group-2' }])
            .mockResolvedValueOnce([
                { userId: 'user-2', groupId: 'group-1' },
                { userId: 'user-2', groupId: 'group-2' },
                { userId: 'user-3', groupId: 'group-1' },
            ]);
        prisma.user.findMany.mockResolvedValue([
            { id: 'user-2', name: 'Friend Two' },
            { id: 'user-3', name: 'Friend Three' },
        ]);
        prisma.group.findMany.mockResolvedValue([
            {
                id: 'group-1',
                name: 'Goa Trip',
                members: [{ userId: 'user-1' }, { userId: 'user-2' }, { userId: 'user-3' }],
                expenses: [
                    {
                        paidByUserId: 'user-1',
                        splits: [
                            { userId: 'user-1', amount: { toNumber: () => 40 } },
                            { userId: 'user-2', amount: { toNumber: () => 60 } },
                        ],
                    },
                ],
                payments: [],
            },
            {
                id: 'group-2',
                name: 'Flatmates',
                members: [{ userId: 'user-1' }, { userId: 'user-2' }],
                expenses: [
                    {
                        paidByUserId: 'user-2',
                        splits: [
                            { userId: 'user-1', amount: { toNumber: () => 20 } },
                            { userId: 'user-2', amount: { toNumber: () => 20 } },
                        ],
                    },
                ],
                payments: [],
            },
        ]);

        const result = await service.findFriends('user-1');

        expect(prisma.groupMember.findMany).toHaveBeenNthCalledWith(1, {
            where: { userId: 'user-1', leftAt: null },
            select: { groupId: true },
        });
        expect(prisma.groupMember.findMany).toHaveBeenNthCalledWith(2, {
            where: {
                groupId: { in: ['group-1', 'group-2'] },
                userId: { not: 'user-1' },
                leftAt: null,
            },
            select: { userId: true, groupId: true },
        });
        expect(result.map((user) => user.id)).toEqual(['user-2', 'user-3']);
        expect(result.map((user) => user.sharedGroupCount)).toEqual([2, 1]);
        expect(result[0]).toMatchObject({
            netBalance: 40,
            groupBalances: [
                { groupId: 'group-1', groupName: 'Goa Trip', balance: 60 },
                { groupId: 'group-2', groupName: 'Flatmates', balance: -20 },
            ],
        });
        expect(result[1]).toMatchObject({ netBalance: 0, groupBalances: [] });
        expect(prisma.user.findMany).toHaveBeenCalledWith({
            where: { id: { in: ['user-2', 'user-3'] } },
            omit: { passwordHash: true },
        });
        expect(prisma.group.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                // Jest asymmetric matchers are intentionally typed as any.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                select: expect.objectContaining({
                    members: { where: { leftAt: null }, select: { userId: true } },
                }),
            }),
        );
    });

    it('does not load users or balances when the caller has no active memberships', async () => {
        prisma.groupMember.findMany.mockResolvedValue([]);
        await expect(service.findFriends('me')).resolves.toEqual([]);
        expect(prisma.user.findMany).not.toHaveBeenCalled();
        expect(prisma.group.findMany).not.toHaveBeenCalled();
    });
    it('includes payments and ignores settlements involving only other members', async () => {
        prisma.groupMember.findMany
            .mockResolvedValueOnce([{ groupId: 'g' }])
            .mockResolvedValueOnce([
                { userId: 'a', groupId: 'g' },
                { userId: 'b', groupId: 'g' },
            ]);
        const a = { id: 'a', name: 'A', email: null, phone: null, avatarUrl: null };
        const b = { ...a, id: 'b', name: 'B' };
        prisma.user.findMany.mockResolvedValue([a, b]);
        prisma.group.findMany.mockResolvedValue([
            {
                id: 'g',
                name: 'Group',
                members: [{ userId: 'me' }, { userId: 'a' }, { userId: 'b' }],
                expenses: [],
                payments: [{ fromUserId: 'a', toUserId: 'b', amount: { toNumber: () => 5.25 } }],
            },
        ]);
        await expect(service.findFriends('me')).resolves.toEqual([
            { ...a, sharedGroupCount: 1, netBalance: 0, groupBalances: [] },
            { ...b, sharedGroupCount: 1, netBalance: 0, groupBalances: [] },
        ]);
    });
    it('propagates membership lookup failure without loading user profiles', async () => {
        const error = new Error('DB unavailable');
        prisma.groupMember.findMany.mockRejectedValue(error);
        await expect(service.findFriends('me')).rejects.toBe(error);
        expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
});
