import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

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
            create: jest.Mock;
            findMany: jest.Mock;
            findUnique: jest.Mock;
            update: jest.Mock;
            delete: jest.Mock;
        };
    };

    const user: User = {
        id: 'user-1',
        name: 'Utkarsh',
        email: 'utkarsh@example.com',
        phone: null,
        avatarUrl: null,
    };

    beforeEach(() => {
        prisma = {
            user: {
                create: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            },
        };
        service = new UsersService(prisma as unknown as PrismaService);
    });

    describe('create', () => {
        it('creates a user', async () => {
            prisma.user.create.mockResolvedValue(user);

            await expect(service.create({ name: 'Utkarsh' })).resolves.toEqual(user);
        });

        it('throws ConflictException on a unique constraint violation', async () => {
            prisma.user.create.mockRejectedValue(knownRequestError('P2002', { target: ['email'] }));

            await expect(service.create({ name: 'Utkarsh' })).rejects.toThrow(ConflictException);
        });

        it('rethrows unrecognized errors unchanged', async () => {
            prisma.user.create.mockRejectedValue(new Error('boom'));

            await expect(service.create({ name: 'Utkarsh' })).rejects.toThrow('boom');
        });
    });

    describe('findAll', () => {
        it('returns all users', async () => {
            prisma.user.findMany.mockResolvedValue([user]);

            await expect(service.findAll()).resolves.toEqual([user]);
        });
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
