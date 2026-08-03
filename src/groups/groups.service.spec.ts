import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Group, GroupMember, Prisma } from '@prisma/client';
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
        service = new GroupsService(prisma as unknown as PrismaService);
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
        it('deletes a group', async () => {
            prisma.group.delete.mockResolvedValue(group);

            await expect(service.remove('group-1')).resolves.toBeUndefined();
        });

        it('throws NotFoundException when the group does not exist', async () => {
            prisma.group.delete.mockRejectedValue(knownRequestError('P2025'));

            await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
        });
    });

    describe('update', () => {
        beforeEach(() => {
            prisma.group.findUnique.mockResolvedValue(group);
            prisma.$transaction.mockResolvedValue(undefined);
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
            expect(prisma.$transaction).not.toHaveBeenCalled();
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
            expect(prisma.$transaction).not.toHaveBeenCalled();
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
