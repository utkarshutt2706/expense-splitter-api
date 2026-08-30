import { ConflictException, UnauthorizedException } from '@nestjs/common';
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
    let prisma: {
        user: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
        authSession: {
            create: jest.Mock;
            findUnique: jest.Mock;
            delete: jest.Mock;
            deleteMany: jest.Mock;
        };
    };
    let jwtService: { signAsync: jest.Mock };

    beforeEach(() => {
        prisma = {
            user: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
            authSession: {
                create: jest.fn(),
                findUnique: jest.fn(),
                delete: jest.fn(),
                deleteMany: jest.fn(),
            },
        };
        jwtService = { signAsync: jest.fn().mockResolvedValue('signed-jwt-token') };
        service = new AuthService(
            prisma as unknown as PrismaService,
            jwtService as unknown as JwtService,
        );
    });

    describe('refresh sessions', () => {
        const user = {
            id: 'user-1',
            name: 'Existing User',
            email: 'existing@example.com',
            phone: null,
            avatarUrl: null,
            passwordHash: 'not-returned',
        };

        it('stores a hash instead of the raw refresh token', async () => {
            const token = await service.createRefreshSession(user.id);
            const createMock = prisma.authSession.create as jest.Mock<
                unknown,
                [{ data: { userId: string; tokenHash: string; expiresAt: Date } }]
            >;
            const data = createMock.mock.calls[0][0].data;

            expect(data.userId).toBe(user.id);
            expect(data.tokenHash).not.toBe(token);
            expect(data.tokenHash).toHaveLength(64);
            expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now());
        });

        it('returns a fresh access token for an active refresh session', async () => {
            prisma.authSession.findUnique.mockResolvedValue({
                id: 'session-1',
                expiresAt: new Date(Date.now() + 60_000),
                user,
            });

            const result = await service.refresh('refresh-token');

            expect(result).toEqual({
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    avatarUrl: user.avatarUrl,
                },
                accessToken: 'signed-jwt-token',
            });
        });

        it('deletes an expired refresh session and returns null', async () => {
            prisma.authSession.findUnique.mockResolvedValue({
                id: 'session-1',
                expiresAt: new Date(Date.now() - 1),
                user,
            });

            await expect(service.refresh('expired-token')).resolves.toBeNull();
            expect(prisma.authSession.delete).toHaveBeenCalledWith({
                where: { id: 'session-1' },
            });
        });

        it('returns null for an unknown refresh token', async () => {
            prisma.authSession.findUnique.mockResolvedValue(null);

            await expect(service.refresh('unknown-token')).resolves.toBeNull();
            expect(prisma.authSession.delete).not.toHaveBeenCalled();
        });

        it('revokes the matching refresh session', async () => {
            await service.revokeRefreshSession('refresh-token');

            const deleteMock = prisma.authSession.deleteMany as jest.Mock<
                unknown,
                [{ where: { tokenHash: string } }]
            >;
            expect(deleteMock.mock.calls[0][0].where.tokenHash).toMatch(/^[a-f0-9]{64}$/);
        });
    });

    describe('register', () => {
        const dto = {
            name: 'New User',
            email: 'new.user@example.com',
            phone: '9000000000',
            password: 'a-secure-password',
        };

        it('creates a user with a hashed password, returns a token and public shape', async () => {
            prisma.user.create.mockResolvedValue({
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

            const createMock = prisma.user.create as jest.Mock<
                unknown,
                [{ data: { passwordHash: string }; omit: { passwordHash: boolean } }]
            >;
            const createArgs = createMock.mock.calls[0][0];
            expect(createArgs.omit).toEqual({ passwordHash: true });
            expect(createArgs.data.passwordHash).not.toBe(dto.password);
            expect(typeof createArgs.data.passwordHash).toBe('string');
        });

        it('throws ConflictException when the email is already registered', async () => {
            prisma.user.create.mockRejectedValue(knownRequestError('P2002', { target: ['email'] }));

            await expect(service.register(dto)).rejects.toThrow(ConflictException);
        });

        it('rethrows unrecognized errors unchanged', async () => {
            prisma.user.create.mockRejectedValue(new Error('boom'));

            await expect(service.register(dto)).rejects.toThrow('boom');
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

    describe('changePassword', () => {
        it('hashes and stores the new password when currentPassword is correct', async () => {
            const passwordHash = await hashPassword('old-password');
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash });

            await service.changePassword('user-1', {
                currentPassword: 'old-password',
                newPassword: 'a-new-secure-password',
            });

            const updateMock = prisma.user.update as jest.Mock<
                unknown,
                [{ where: { id: string }; data: { passwordHash: string } }]
            >;
            const updateArgs = updateMock.mock.calls[0][0];
            expect(updateArgs.where).toEqual({ id: 'user-1' });
            expect(updateArgs.data.passwordHash).not.toBe('a-new-secure-password');
            expect(updateArgs.data.passwordHash).not.toBe(passwordHash);
        });

        it('throws UnauthorizedException when currentPassword is wrong', async () => {
            const passwordHash = await hashPassword('old-password');
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash });

            await expect(
                service.changePassword('user-1', {
                    currentPassword: 'wrong-password',
                    newPassword: 'a-new-secure-password',
                }),
            ).rejects.toThrow(UnauthorizedException);
            expect(prisma.user.update).not.toHaveBeenCalled();
        });

        it('throws UnauthorizedException when the user has never set a password', async () => {
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: null });

            await expect(
                service.changePassword('user-1', {
                    currentPassword: 'anything',
                    newPassword: 'a-new-secure-password',
                }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException when the user does not exist', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(
                service.changePassword('missing-user', {
                    currentPassword: 'anything',
                    newPassword: 'a-new-secure-password',
                }),
            ).rejects.toThrow(UnauthorizedException);
        });
    });
});
