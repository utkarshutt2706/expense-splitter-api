import { ConflictException, NotFoundException } from '@nestjs/common';
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
            create: jest.Mock;
            delete: jest.Mock;
        };
    };

    const createdAt = new Date('2026-07-01T00:00:00.000Z');
    const members: GroupMember[] = [
        { groupId: 'group-1', userId: 'user-1' },
        { groupId: 'group-1', userId: 'user-2' },
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
                create: jest.fn(),
                delete: jest.fn(),
            },
        };
        service = new GroupsService(prisma as unknown as PrismaService);
    });

    describe('create', () => {
        it('creates a group and maps members to memberIds', async () => {
            prisma.group.create.mockResolvedValue(group);

            await expect(
                service.create({ name: 'Daaru Party', memberIds: ['user-1', 'user-2'] }),
            ).resolves.toEqual({
                id: 'group-1',
                name: 'Daaru Party',
                memberIds: ['user-1', 'user-2'],
                createdAt: createdAt.toISOString(),
            });
        });

        it('throws ConflictException when a memberId does not reference a user', async () => {
            prisma.group.create.mockRejectedValue(knownRequestError('P2003'));

            await expect(
                service.create({ name: 'Daaru Party', memberIds: ['missing-user'] }),
            ).rejects.toThrow(ConflictException);
        });

        it('rethrows unrecognized errors unchanged', async () => {
            prisma.group.create.mockRejectedValue(new Error('boom'));

            await expect(
                service.create({ name: 'Daaru Party', memberIds: ['user-1'] }),
            ).rejects.toThrow('boom');
        });
    });

    describe('findAll', () => {
        it('returns all groups mapped to memberIds', async () => {
            prisma.group.findMany.mockResolvedValue([group]);

            await expect(service.findAll()).resolves.toEqual([
                {
                    id: 'group-1',
                    name: 'Daaru Party',
                    memberIds: ['user-1', 'user-2'],
                    createdAt: createdAt.toISOString(),
                },
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
        it('deletes a group', async () => {
            prisma.group.delete.mockResolvedValue(group);

            await expect(service.remove('group-1')).resolves.toBeUndefined();
        });

        it('throws NotFoundException when the group does not exist', async () => {
            prisma.group.delete.mockRejectedValue(knownRequestError('P2025'));

            await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
        });
    });

    describe('rename', () => {
        it('renames a group', async () => {
            const renamed = { ...group, name: 'New Name' };
            prisma.group.update.mockResolvedValue(renamed);

            await expect(service.rename('group-1', 'New Name')).resolves.toMatchObject({
                name: 'New Name',
            });
        });

        it('throws NotFoundException when the group does not exist', async () => {
            prisma.group.update.mockRejectedValue(knownRequestError('P2025'));

            await expect(service.rename('missing', 'New Name')).rejects.toThrow(NotFoundException);
        });
    });

    describe('addMember', () => {
        beforeEach(() => {
            prisma.group.findUnique.mockResolvedValue(group);
        });

        it('adds a member and returns the updated group', async () => {
            prisma.groupMember.create.mockResolvedValue(members[0]);

            const result = service.addMember('group-1', { userId: 'user-3' });

            await expect(result).resolves.toMatchObject({ id: 'group-1' });
        });

        it('throws NotFoundException when the group does not exist', async () => {
            prisma.group.findUnique.mockResolvedValue(null);

            await expect(service.addMember('missing', { userId: 'user-1' })).rejects.toThrow(
                NotFoundException,
            );
        });

        it('throws ConflictException when the user is already a member', async () => {
            prisma.groupMember.create.mockRejectedValue(knownRequestError('P2002'));

            await expect(service.addMember('group-1', { userId: 'user-1' })).rejects.toThrow(
                ConflictException,
            );
        });

        it('throws NotFoundException when the user does not exist', async () => {
            prisma.groupMember.create.mockRejectedValue(knownRequestError('P2003'));

            await expect(service.addMember('group-1', { userId: 'missing-user' })).rejects.toThrow(
                NotFoundException,
            );
        });

        it('rethrows unrecognized errors unchanged', async () => {
            prisma.groupMember.create.mockRejectedValue(new Error('boom'));

            await expect(service.addMember('group-1', { userId: 'user-1' })).rejects.toThrow(
                'boom',
            );
        });
    });

    describe('removeMember', () => {
        beforeEach(() => {
            prisma.group.findUnique.mockResolvedValue(group);
        });

        it('removes a member and returns the updated group', async () => {
            prisma.groupMember.delete.mockResolvedValue(members[0]);

            await expect(service.removeMember('group-1', 'user-1')).resolves.toMatchObject({
                id: 'group-1',
            });
        });

        it('throws NotFoundException when the group does not exist', async () => {
            prisma.group.findUnique.mockResolvedValue(null);

            await expect(service.removeMember('missing', 'user-1')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('throws NotFoundException when the user is not a member', async () => {
            prisma.groupMember.delete.mockRejectedValue(knownRequestError('P2025'));

            await expect(service.removeMember('group-1', 'not-a-member')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('rethrows unrecognized errors unchanged', async () => {
            prisma.groupMember.delete.mockRejectedValue(new Error('boom'));

            await expect(service.removeMember('group-1', 'user-1')).rejects.toThrow('boom');
        });
    });
});
