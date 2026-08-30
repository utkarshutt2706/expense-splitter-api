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
    };
    let jwtService: { signAsync: jest.Mock };

    beforeEach(() => {
        prisma = {
            user: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
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
