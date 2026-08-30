import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { LookupUserDto } from './dto/lookup-user.dto';
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
        it('throws BadRequestException when query is missing', async () => {
            await expect(service.lookup({})).rejects.toThrow(BadRequestException);
        });

        it('throws BadRequestException when query is only whitespace', async () => {
            await expect(service.lookup({ query: '   ' })).rejects.toThrow(BadRequestException);
        });

        it('throws BadRequestException when query is shorter than three characters', async () => {
            await expect(service.lookup({ query: 'ab' })).rejects.toThrow(BadRequestException);
            expect(prisma.user.findMany).not.toHaveBeenCalled();
        });

        it('limits partial name matches without selecting contact details', async () => {
            const lookupUser = { id: user.id, name: user.name, avatarUrl: user.avatarUrl };
            prisma.user.findMany.mockResolvedValue([lookupUser]);

            await expect(service.lookup({ query: 'utkar' })).resolves.toEqual([lookupUser]);
            expect(prisma.user.findMany).toHaveBeenCalledWith({
                where: { name: { contains: 'utkar', mode: 'insensitive' } },
                select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                    email: false,
                    phone: false,
                },
                orderBy: { name: 'asc' },
                take: 10,
            });
        });

        it('trims whitespace before matching user records', async () => {
            prisma.user.findMany.mockResolvedValue([]);

            await expect(service.lookup({ query: '  utkar  ' })).resolves.toEqual([]);
            expect(prisma.user.findMany).toHaveBeenCalledWith({
                where: { name: { contains: 'utkar', mode: 'insensitive' } },
                select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                    email: false,
                    phone: false,
                },
                orderBy: { name: 'asc' },
                take: 10,
            });
        });

        it('requires an exact email match and returns only the matched email', async () => {
            prisma.user.findMany.mockResolvedValue([user]);

            await expect(service.lookup({ query: 'utkarsh@example.com' })).resolves.toEqual([user]);
            expect(prisma.user.findMany).toHaveBeenCalledWith({
                where: { email: { equals: 'utkarsh@example.com', mode: 'insensitive' } },
                select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                    email: true,
                    phone: false,
                },
                orderBy: { name: 'asc' },
                take: 10,
            });
        });

        it('requires an exact phone match and returns only the matched phone', async () => {
            prisma.user.findMany.mockResolvedValue([user]);

            await expect(service.lookup({ query: '9876543210' })).resolves.toEqual([user]);
            expect(prisma.user.findMany).toHaveBeenCalledWith({
                where: { phone: { equals: '9876543210' } },
                select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                    email: false,
                    phone: true,
                },
                orderBy: { name: 'asc' },
                take: 10,
            });
        });

        it('treats partial email text as a name search', async () => {
            prisma.user.findMany.mockResolvedValue([]);

            await service.lookup({ query: 'example.com' });

            expect(prisma.user.findMany).toHaveBeenCalledWith({
                where: { name: { contains: 'example.com', mode: 'insensitive' } },
                select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                    email: false,
                    phone: false,
                },
                orderBy: { name: 'asc' },
                take: 10,
            });
        });

        it('returns an empty array when no user matches', async () => {
            prisma.user.findMany.mockResolvedValue([]);

            await expect(service.lookup({ query: 'nobody' })).resolves.toEqual([]);
        });
    });

    describe('LookupUserDto', () => {
        it('trims the query before validation', () => {
            const dto = plainToInstance(LookupUserDto, { query: '  jamie@example.com  ' });

            expect(dto).toEqual({ query: 'jamie@example.com' });
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
