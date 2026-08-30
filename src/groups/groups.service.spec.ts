import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Group, GroupMember, Prisma } from '@prisma/client';
import { BalancesService } from '../balances/balances.service';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from './groups.service';

function knownRequestError(code: string): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError('mock prisma error', {
        code,
        clientVersion: '7.9.1',
    });
}

describe('GroupsService', () => {
    let service: GroupsService;
    let prisma: {
        group: {
            create: jest.Mock;
            findMany: jest.Mock;
            findUnique: jest.Mock;
            update: jest.Mock;
            delete: jest.Mock;
        };
        groupMember: {
            updateMany: jest.Mock;
            upsert: jest.Mock;
        };
        $transaction: jest.Mock;
    };
    let balancesService: { getGroupBalances: jest.Mock };

    const createdAt = new Date('2026-07-01T00:00:00.000Z');
    const members: GroupMember[] = [
        { groupId: 'group-1', userId: 'user-1', leftAt: null },
        { groupId: 'group-1', userId: 'user-2', leftAt: null },
    ];
    const group: Group & { members: GroupMember[] } = {
        id: 'group-1',
        name: 'Daaru Party',
        createdAt,
        members,
    };

    function settledBalances(...userIds: string[]) {
        return { balances: userIds.map((userId) => ({ userId, balance: 0 })), settlements: [] };
    }

    beforeEach(() => {
        prisma = {
            group: {
                create: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            },
            groupMember: {
                updateMany: jest.fn(),
                upsert: jest.fn(),
            },
            $transaction: jest.fn(),
        };
        balancesService = {
            getGroupBalances: jest.fn().mockResolvedValue(settledBalances('user-1', 'user-2')),
        };
        prisma.$transaction.mockImplementation(
            async (operation: (tx: typeof prisma) => Promise<unknown>) => operation(prisma),
        );
        service = new GroupsService(
            prisma as unknown as PrismaService,
            balancesService as unknown as BalancesService,
        );
    });

    describe('create', () => {
        it('creates a group and maps members to memberIds', async () => {
            prisma.group.create.mockResolvedValue(group);

            await expect(
                service.create('user-1', { name: 'Daaru Party', memberIds: ['user-1', 'user-2'] }),
            ).resolves.toEqual({
                id: 'group-1',
                name: 'Daaru Party',
                memberIds: ['user-1', 'user-2'],
                createdAt: createdAt.toISOString(),
            });
        });

        it('adds the creator to memberIds when they omitted themselves', async () => {
            prisma.group.create.mockResolvedValue(group);

            await service.create('user-1', { name: 'Daaru Party', memberIds: ['user-2'] });

            expect(prisma.group.create).toHaveBeenCalledWith({
                data: {
                    name: 'Daaru Party',
                    members: {
                        create: [{ userId: 'user-1' }, { userId: 'user-2' }],
                    },
                },
                include: { members: { where: { leftAt: null } } },
            });
        });

        it('does not duplicate the creator when already present in memberIds', async () => {
            prisma.group.create.mockResolvedValue(group);

            const dto = { name: 'Daaru Party', memberIds: ['user-1', 'user-2'] };
            await service.create('user-1', dto);

            const createMock = prisma.group.create as jest.Mock<
                unknown,
                [{ data: { members: { create: { userId: string }[] } } }]
            >;
            const createArgs = createMock.mock.calls[0][0];
            expect(createArgs.data.members.create).toEqual([
                { userId: 'user-1' },
                { userId: 'user-2' },
            ]);
        });

        it('throws BadRequestException when a memberId does not reference a user', async () => {
            prisma.group.create.mockRejectedValue(knownRequestError('P2003'));

            await expect(
                service.create('user-1', { name: 'Daaru Party', memberIds: ['missing-user'] }),
            ).rejects.toThrow(BadRequestException);
        });

        it('rethrows unrecognized errors unchanged', async () => {
            prisma.group.create.mockRejectedValue(new Error('boom'));

            await expect(
                service.create('user-1', { name: 'Daaru Party', memberIds: ['user-1'] }),
            ).rejects.toThrow('boom');
        });
    });

    describe('findAll', () => {
        it("returns only the caller's groups mapped to memberIds", async () => {
            prisma.group.findMany.mockResolvedValue([group]);

            await expect(service.findAll('user-1')).resolves.toEqual([
                {
                    id: 'group-1',
                    name: 'Daaru Party',
                    memberIds: ['user-1', 'user-2'],
                    createdAt: createdAt.toISOString(),
                },
            ]);
            expect(prisma.group.findMany).toHaveBeenCalledWith({
                where: { members: { some: { userId: 'user-1', leftAt: null } } },
                include: { members: { where: { leftAt: null } } },
            });
        });
    });

    describe('findAllSummaries', () => {
        it('returns canonical current-user balances and latest financial activity', async () => {
            prisma.group.findMany.mockResolvedValue([
                {
                    ...group,
                    expenses: [
                        {
                            paidByUserId: 'user-1',
                            createdAt: new Date('2026-08-12T10:00:00.000Z'),
                            splits: [
                                { userId: 'user-1', amount: { toNumber: () => 50 } },
                                { userId: 'user-2', amount: { toNumber: () => 50 } },
                            ],
                        },
                    ],
                    payments: [
                        {
                            fromUserId: 'user-2',
                            toUserId: 'user-1',
                            amount: { toNumber: () => 20 },
                            createdAt: new Date('2026-08-15T10:00:00.000Z'),
                        },
                    ],
                },
            ]);

            await expect(service.findAllSummaries('user-1')).resolves.toEqual([
                {
                    id: 'group-1',
                    name: 'Daaru Party',
                    memberIds: ['user-1', 'user-2'],
                    memberCount: 2,
                    currentUserBalance: 30,
                    hasFinancialActivity: true,
                    lastActivityAt: '2026-08-15T10:00:00.000Z',
                    createdAt: createdAt.toISOString(),
                },
            ]);
        });

        it('returns an explicit no-activity summary without inventing a date', async () => {
            prisma.group.findMany.mockResolvedValue([{ ...group, expenses: [], payments: [] }]);

            await expect(service.findAllSummaries('user-1')).resolves.toEqual([
                expect.objectContaining({
                    currentUserBalance: 0,
                    hasFinancialActivity: false,
                    lastActivityAt: null,
                }),
            ]);
        });
    });

    describe('findOne', () => {
        it('returns the group when found', async () => {
            prisma.group.findUnique.mockResolvedValue(group);

            await expect(service.findOne('group-1')).resolves.toMatchObject({ id: 'group-1' });
        });

        it('throws NotFoundException when missing', async () => {
            prisma.group.findUnique.mockResolvedValue(null);

            await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
        });
    });

    describe('remove', () => {
        it('deletes a group when every balance is settled', async () => {
            prisma.group.delete.mockResolvedValue(group);

            await expect(service.remove('group-1')).resolves.toBeUndefined();
            expect(balancesService.getGroupBalances).toHaveBeenCalledWith('group-1', prisma);
            expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
        });

        it('throws ConflictException when any member has an unsettled balance', async () => {
            balancesService.getGroupBalances.mockResolvedValue({
                balances: [
                    { userId: 'user-1', balance: 25 },
                    { userId: 'user-2', balance: -25 },
                ],
                settlements: [],
            });

            await expect(service.remove('group-1')).rejects.toThrow(ConflictException);
            expect(prisma.group.delete).not.toHaveBeenCalled();
        });

        it('throws NotFoundException when the group does not exist', async () => {
            prisma.group.delete.mockRejectedValue(knownRequestError('P2025'));

            await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
        });

        it('retries a serializable transaction conflict', async () => {
            prisma.$transaction.mockRejectedValueOnce(knownRequestError('P2034'));
            prisma.group.delete.mockResolvedValue(group);

            await expect(service.remove('group-1')).resolves.toBeUndefined();
            expect(prisma.$transaction).toHaveBeenCalledTimes(2);
            expect(prisma.group.delete).toHaveBeenCalledTimes(1);
        });
    });

    describe('update', () => {
        beforeEach(() => {
            prisma.group.findUnique.mockResolvedValue(group);
        });

        it('throws NotFoundException when the group does not exist', async () => {
            prisma.group.findUnique.mockResolvedValue(null);

            await expect(service.update('missing', { name: 'New Name' })).rejects.toThrow(
                NotFoundException,
            );
        });

        it('renames the group without touching membership', async () => {
            prisma.group.update.mockResolvedValue(group);

            await service.update('group-1', { name: 'New Name' });

            expect(prisma.group.update).toHaveBeenCalledWith({
                where: { id: 'group-1' },
                data: { name: 'New Name' },
            });
            expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
        });

        it('soft-removes members no longer in the list and upserts new ones', async () => {
            await service.update('group-1', { memberIds: ['user-2', 'user-3'] });

            expect(prisma.groupMember.updateMany).toHaveBeenCalledWith({
                where: { groupId: 'group-1', userId: { in: ['user-1'] } },
                data: { leftAt: expect.any(Date) as Date },
            });
            expect(prisma.groupMember.upsert).toHaveBeenCalledWith({
                where: { groupId_userId: { groupId: 'group-1', userId: 'user-3' } },
                create: { groupId: 'group-1', userId: 'user-3' },
                update: { leftAt: null },
            });
            expect(prisma.$transaction).toHaveBeenCalled();
            expect(prisma.group.update).not.toHaveBeenCalled();
        });

        it('checks balances only for the members actually being removed', async () => {
            await service.update('group-1', { memberIds: ['user-2', 'user-3'] });

            expect(balancesService.getGroupBalances).toHaveBeenCalledWith('group-1', prisma);
        });

        it('throws ConflictException when a member being removed has an unsettled balance', async () => {
            balancesService.getGroupBalances.mockResolvedValue({
                balances: [
                    { userId: 'user-1', balance: 25 },
                    { userId: 'user-2', balance: -25 },
                ],
                settlements: [],
            });

            const result = service.update('group-1', { memberIds: ['user-2', 'user-3'] });

            await expect(result).rejects.toThrow(ConflictException);
            expect(prisma.groupMember.updateMany).not.toHaveBeenCalled();
        });

        it('does not check balances when no one is being removed', async () => {
            await service.update('group-1', { memberIds: ['user-1', 'user-2', 'user-4'] });

            expect(balancesService.getGroupBalances).not.toHaveBeenCalled();
        });

        it('clears leftAt when a previously removed member rejoins', async () => {
            await service.update('group-1', { memberIds: ['user-1', 'user-2', 'user-4'] });

            expect(prisma.groupMember.upsert).toHaveBeenCalledWith({
                where: { groupId_userId: { groupId: 'group-1', userId: 'user-4' } },
                create: { groupId: 'group-1', userId: 'user-4' },
                update: { leftAt: null },
            });
        });

        it('updates both name and membership together', async () => {
            prisma.group.update.mockResolvedValue(group);

            await service.update('group-1', { name: 'New Name', memberIds: ['user-3'] });

            expect(prisma.$transaction).toHaveBeenCalled();
            expect(prisma.group.update).toHaveBeenCalled();
        });

        it('re-fetches the group when given an empty update', async () => {
            const result = service.update('group-1', {});

            await expect(result).resolves.toMatchObject({ id: 'group-1' });
            expect(prisma.$transaction).toHaveBeenCalled();
            expect(prisma.group.update).not.toHaveBeenCalled();
        });

        it('throws BadRequestException when a replacement memberId is invalid', async () => {
            prisma.$transaction.mockRejectedValue(knownRequestError('P2003'));

            const result = service.update('group-1', { memberIds: ['missing-user'] });

            await expect(result).rejects.toThrow(BadRequestException);
        });

        it('throws NotFoundException when the group is deleted mid-update', async () => {
            prisma.group.update.mockRejectedValue(knownRequestError('P2025'));

            await expect(service.update('group-1', { name: 'New Name' })).rejects.toThrow(
                NotFoundException,
            );
        });

        it('rethrows unrecognized errors unchanged', async () => {
            prisma.group.update.mockRejectedValue(new Error('boom'));

            await expect(service.update('group-1', { name: 'New Name' })).rejects.toThrow('boom');
        });
    });
});
