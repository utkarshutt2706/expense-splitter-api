import {
    BadRequestException,
    ConflictException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { hashPassword } from './password-hasher';

function knownRequestError(code: string, meta?: Record<string, unknown>) {
    return new Prisma.PrismaClientKnownRequestError('mock prisma error', {
        code,
        clientVersion: '7.9.1',
        meta,
    });
}

describe('AuthService', () => {
    let service: AuthService;
    let tx: {
        user: { create: jest.Mock };
        groupMember: { upsert: jest.Mock };
        groupInvitation: { findUnique: jest.Mock; update: jest.Mock };
    };
    let prisma: {
        user: { findUnique: jest.Mock };
        $transaction: jest.Mock;
    };
    let jwtService: { signAsync: jest.Mock };

    beforeEach(() => {
        tx = {
            user: { create: jest.fn() },
            groupMember: { upsert: jest.fn() },
            groupInvitation: { findUnique: jest.fn(), update: jest.fn() },
        };
        prisma = {
            user: { findUnique: jest.fn() },
            $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
        };
        jwtService = { signAsync: jest.fn().mockResolvedValue('signed-jwt-token') };
        service = new AuthService(
            prisma as unknown as PrismaService,
            jwtService as unknown as JwtService,
        );
    });

    describe('register', () => {
        const dto = {
            name: 'New User',
            email: 'new.user@example.com',
            phone: '9000000000',
            password: 'a-secure-password',
        };

        it('creates a user with a hashed password, returns a token and public shape', async () => {
            tx.user.create.mockResolvedValue({
                id: 'user-1',
                name: dto.name,
                email: dto.email,
                phone: dto.phone,
                avatarUrl: null,
            });

            const result = await service.register(dto);

            expect(result).toEqual({
                user: {
                    id: 'user-1',
                    name: dto.name,
                    email: dto.email,
                    phone: dto.phone,
                    avatarUrl: null,
                },
                accessToken: 'signed-jwt-token',
            });
            expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-1', email: dto.email });

            const createMock = tx.user.create as jest.Mock<
                unknown,
                [{ data: { passwordHash: string }; omit: { passwordHash: boolean } }]
            >;
            const createArgs = createMock.mock.calls[0][0];
            expect(createArgs.omit).toEqual({ passwordHash: true });
            expect(createArgs.data.passwordHash).not.toBe(dto.password);
            expect(typeof createArgs.data.passwordHash).toBe('string');
        });

        it('throws ConflictException when the email is already registered', async () => {
            tx.user.create.mockRejectedValue(knownRequestError('P2002', { target: ['email'] }));

            await expect(service.register(dto)).rejects.toThrow(ConflictException);
        });

        it('rethrows unrecognized errors unchanged', async () => {
            tx.user.create.mockRejectedValue(new Error('boom'));

            await expect(service.register(dto)).rejects.toThrow('boom');
        });

        describe('with an inviteToken', () => {
            const inviteDto = { ...dto, inviteToken: 'raw-token' };

            it('joins the invited group and marks the invitation accepted', async () => {
                tx.groupInvitation.findUnique.mockResolvedValue({
                    id: 'invitation-1',
                    groupId: 'group-1',
                    email: dto.email,
                    status: 'pending',
                    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
                });
                tx.user.create.mockResolvedValue({
                    id: 'user-1',
                    name: dto.name,
                    email: dto.email,
                    phone: dto.phone,
                    avatarUrl: null,
                });

                await service.register(inviteDto);

                expect(tx.groupMember.upsert).toHaveBeenCalledWith({
                    where: { groupId_userId: { groupId: 'group-1', userId: 'user-1' } },
                    create: { groupId: 'group-1', userId: 'user-1' },
                    update: { leftAt: null },
                });
                expect(tx.groupInvitation.update).toHaveBeenCalledWith({
                    where: { id: 'invitation-1' },
                    data: { status: 'accepted', acceptedAt: expect.any(Date) as Date },
                });
            });

            it('throws NotFoundException when the token does not match any invitation', async () => {
                tx.groupInvitation.findUnique.mockResolvedValue(null);

                await expect(service.register(inviteDto)).rejects.toThrow(NotFoundException);
                expect(tx.user.create).not.toHaveBeenCalled();
            });

            it('throws ConflictException when the invitation is expired', async () => {
                tx.groupInvitation.findUnique.mockResolvedValue({
                    id: 'invitation-1',
                    groupId: 'group-1',
                    email: dto.email,
                    status: 'pending',
                    expiresAt: new Date(Date.now() - 1000),
                });

                await expect(service.register(inviteDto)).rejects.toThrow(ConflictException);
            });

            it('throws ConflictException when the invitation was already accepted', async () => {
                tx.groupInvitation.findUnique.mockResolvedValue({
                    id: 'invitation-1',
                    groupId: 'group-1',
                    email: dto.email,
                    status: 'accepted',
                    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
                });

                await expect(service.register(inviteDto)).rejects.toThrow(ConflictException);
            });

            it('throws BadRequestException when the invitation email does not match', async () => {
                tx.groupInvitation.findUnique.mockResolvedValue({
                    id: 'invitation-1',
                    groupId: 'group-1',
                    email: 'someone-else@example.com',
                    status: 'pending',
                    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
                });

                await expect(service.register(inviteDto)).rejects.toThrow(BadRequestException);
                expect(tx.user.create).not.toHaveBeenCalled();
            });
        });
    });

    describe('login', () => {
        it('returns a token with the public user shape for correct credentials', async () => {
            const passwordHash = await hashPassword('correct-password');
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                name: 'Existing User',
                email: 'existing@example.com',
                phone: null,
                avatarUrl: null,
                passwordHash,
            });

            const result = await service.login({
                email: 'existing@example.com',
                password: 'correct-password',
            });

            expect(result).toEqual({
                user: {
                    id: 'user-1',
                    name: 'Existing User',
                    email: 'existing@example.com',
                    phone: null,
                    avatarUrl: null,
                },
                accessToken: 'signed-jwt-token',
            });
            expect(result.user).not.toHaveProperty('passwordHash');
        });

        it('throws UnauthorizedException when the email is not registered', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(
                service.login({ email: 'missing@example.com', password: 'anything' }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException when the user has never set a password', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                name: 'Friend Only',
                email: 'friend@example.com',
                phone: null,
                avatarUrl: null,
                passwordHash: null,
            });

            await expect(
                service.login({ email: 'friend@example.com', password: 'anything' }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException when the password is wrong', async () => {
            const passwordHash = await hashPassword('correct-password');
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                name: 'Existing User',
                email: 'existing@example.com',
                phone: null,
                avatarUrl: null,
                passwordHash,
            });

            await expect(
                service.login({ email: 'existing@example.com', password: 'wrong-password' }),
            ).rejects.toThrow(UnauthorizedException);
        });
    });
});
