import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PublicUser, UsersService } from './users.service';

function knownRequestError(
    code: string,
    meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError('mock prisma error', {
        code,
        clientVersion: '7.9.1',
        meta,
    });
}

describe('UsersService', () => {
    let service: UsersService;
    let prisma: {
        user: {
            findMany: jest.Mock;
            findUnique: jest.Mock;
            update: jest.Mock;
            delete: jest.Mock;
        };
        groupMember: {
            findMany: jest.Mock;
        };
        group: {
            findMany: jest.Mock;
        };
    };

    const user: PublicUser = {
        id: 'user-1',
        name: 'Utkarsh',
        email: 'utkarsh@example.com',
        phone: null,
        avatarUrl: null,
    };

    beforeEach(() => {
        prisma = {
            user: {
                findMany: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            },
            groupMember: {
                findMany: jest.fn(),
            },
            group: {
                findMany: jest.fn(),
            },
        };
        service = new UsersService(prisma as unknown as PrismaService);
    });

    describe('findOne', () => {
        it('returns the user when found', async () => {
            prisma.user.findUnique.mockResolvedValue(user);

            await expect(service.findOne('user-1')).resolves.toEqual(user);
        });

        it('throws NotFoundException when missing', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
        });
    });

    describe('lookup', () => {
        it('throws BadRequestException when both email and phone are given', async () => {
            await expect(service.lookup({ email: 'a@example.com', phone: '123' })).rejects.toThrow(
                BadRequestException,
            );
        });

        it('throws BadRequestException when neither email nor phone is given', async () => {
            await expect(service.lookup({})).rejects.toThrow(BadRequestException);
        });

        it('finds a user by email', async () => {
            prisma.user.findUnique.mockResolvedValue(user);

            await expect(service.lookup({ email: 'utkarsh@example.com' })).resolves.toEqual(user);
            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { email: 'utkarsh@example.com' },
                omit: { passwordHash: true },
            });
        });

        it('finds a user by phone', async () => {
            prisma.user.findUnique.mockResolvedValue(user);

            await expect(service.lookup({ phone: '9876543210' })).resolves.toEqual(user);
            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { phone: '9876543210' },
                omit: { passwordHash: true },
            });
        });

        it('throws NotFoundException when no user matches', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.lookup({ email: 'nobody@example.com' })).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('findManyByIds', () => {
        it('returns the users matching the given ids', async () => {
            prisma.user.findMany.mockResolvedValue([user]);

            await expect(service.findManyByIds({ ids: ['user-1', 'user-2'] })).resolves.toEqual([
                user,
            ]);
            expect(prisma.user.findMany).toHaveBeenCalledWith({
                where: { id: { in: ['user-1', 'user-2'] } },
                omit: { passwordHash: true },
            });
        });
    });

    describe('findFriends', () => {
        it('returns an empty list when the user has no groups', async () => {
            prisma.groupMember.findMany.mockResolvedValueOnce([]);

            await expect(service.findFriends('user-1')).resolves.toEqual([]);
        });

        it('returns other members of shared groups, deduped and excluding self', async () => {
            prisma.groupMember.findMany
                .mockResolvedValueOnce([{ groupId: 'group-1' }, { groupId: 'group-2' }])
                .mockResolvedValueOnce([
                    { userId: 'user-2', groupId: 'group-1' },
                    { userId: 'user-2', groupId: 'group-2' },
                    { userId: 'user-3', groupId: 'group-1' },
                ]);
            prisma.user.findMany.mockResolvedValue([
                { ...user, id: 'user-2' },
                { ...user, id: 'user-3' },
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
                where: { userId: 'user-1' },
                select: { groupId: true },
            });
            expect(prisma.groupMember.findMany).toHaveBeenNthCalledWith(2, {
                where: { groupId: { in: ['group-1', 'group-2'] }, userId: { not: 'user-1' } },
                select: { userId: true, groupId: true },
            });
            expect(result.map((u) => u.id)).toEqual(['user-2', 'user-3']);
            expect(result.map((u) => u.sharedGroupCount)).toEqual([2, 1]);
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
        });
    });

    describe('update', () => {
        it('updates a user', async () => {
            prisma.user.update.mockResolvedValue(user);

            await expect(service.update('user-1', { name: 'New Name' })).resolves.toEqual(user);
        });

        it('throws NotFoundException when the record does not exist', async () => {
            prisma.user.update.mockRejectedValue(knownRequestError('P2025'));

            await expect(service.update('missing', { name: 'New Name' })).rejects.toThrow(
                NotFoundException,
            );
        });

        it('throws ConflictException on a unique constraint violation', async () => {
            prisma.user.update.mockRejectedValue(knownRequestError('P2002'));

            await expect(service.update('user-1', { email: 'dup@example.com' })).rejects.toThrow(
                ConflictException,
            );
        });
    });

    describe('remove', () => {
        it('deletes a user', async () => {
            prisma.user.delete.mockResolvedValue(user);

            await expect(service.remove('user-1')).resolves.toEqual(user);
        });

        it('throws NotFoundException when the record does not exist', async () => {
            prisma.user.delete.mockRejectedValue(knownRequestError('P2025'));

            await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
        });

        it('throws ConflictException when referenced by a group or expense', async () => {
            prisma.user.delete.mockRejectedValue(knownRequestError('P2003'));

            await expect(service.remove('user-1')).rejects.toThrow(ConflictException);
        });
    });
});
