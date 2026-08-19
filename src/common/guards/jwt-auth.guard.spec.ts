import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { ALLOW_MISSING_PHONE_KEY } from '../decorators/allow-missing-phone.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

type MockRequest = {
    header: (name: string) => string | undefined;
    user?: unknown;
};

type MockPrismaUserLookup = {
    findUnique: jest.MockedFunction<(args: unknown) => Promise<{ phone: string | null } | null>>;
};

describe('JwtAuthGuard', () => {
    let reflector: Reflector;
    let jwtService: { verifyAsync: jest.Mock };
    let prisma: { user: MockPrismaUserLookup };
    let guard: JwtAuthGuard;

    beforeEach(() => {
        reflector = new Reflector();
        jwtService = { verifyAsync: jest.fn() };
        prisma = {
            user: {
                findUnique: jest.fn<(args: unknown) => Promise<{ phone: string | null } | null>>(),
            },
        };
        guard = new JwtAuthGuard(
            reflector,
            jwtService as unknown as JwtService,
            prisma as unknown as PrismaService,
        );
    });

    function mockContext(request: MockRequest): ExecutionContext {
        return {
            getHandler: () => undefined,
            getClass: () => undefined,
            switchToHttp: () => ({
                getRequest: () => request,
            }),
        } as unknown as ExecutionContext;
    }

    it('allows a public route without checking the header', async () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
        const request: MockRequest = { header: () => undefined };

        await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
        expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('rejects when the Authorization header is missing', async () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
        const request: MockRequest = { header: () => undefined };

        await expect(guard.canActivate(mockContext(request))).rejects.toThrow(
            UnauthorizedException,
        );
    });

    it('rejects when the Authorization scheme is not Bearer', async () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
        const request: MockRequest = { header: () => 'Basic something' };

        await expect(guard.canActivate(mockContext(request))).rejects.toThrow(
            UnauthorizedException,
        );
    });

    it('rejects when the token fails verification', async () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
        jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
        const request: MockRequest = { header: () => 'Bearer bad-token' };

        await expect(guard.canActivate(mockContext(request))).rejects.toThrow(
            UnauthorizedException,
        );
    });

    it('rejects when the user does not have a phone number on file', async () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
        jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', email: 'user@example.com' });
        prisma.user.findUnique.mockResolvedValue({ phone: null });
        const request: MockRequest = { header: () => 'Bearer good-token' };

        await expect(guard.canActivate(mockContext(request))).rejects.toThrow(ForbiddenException);
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            select: { phone: true },
        });
    });

    it('allows a phone-less user through a route that permits adding a phone number', async () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
            key === ALLOW_MISSING_PHONE_KEY ? true : false,
        );
        const payload = { sub: 'user-1', email: 'user@example.com' };
        jwtService.verifyAsync.mockResolvedValue(payload);
        prisma.user.findUnique.mockResolvedValue({ phone: null });
        const request: MockRequest = { header: () => 'Bearer good-token' };

        await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
        expect(request.user).toEqual(payload);
    });

    it('allows a valid token and attaches the payload to the request when the user has a phone number', async () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
        const payload = { sub: 'user-1', email: 'user@example.com' };
        jwtService.verifyAsync.mockResolvedValue(payload);
        prisma.user.findUnique.mockResolvedValue({ phone: '9876543210' });
        const request: MockRequest = { header: () => 'Bearer good-token' };

        await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
        expect(jwtService.verifyAsync).toHaveBeenCalledWith('good-token');
        expect(request.user).toEqual(payload);
    });
});
