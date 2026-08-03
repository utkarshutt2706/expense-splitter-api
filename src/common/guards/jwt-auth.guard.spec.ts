import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

type MockRequest = {
    header: (name: string) => string | undefined;
    user?: unknown;
};

describe('JwtAuthGuard', () => {
    let reflector: Reflector;
    let jwtService: { verifyAsync: jest.Mock };
    let guard: JwtAuthGuard;

    beforeEach(() => {
        reflector = new Reflector();
        jwtService = { verifyAsync: jest.fn() };
        guard = new JwtAuthGuard(reflector, jwtService as unknown as JwtService);
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

    it('allows a valid token and attaches the payload to the request', async () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
        const payload = { sub: 'user-1', email: 'user@example.com' };
        jwtService.verifyAsync.mockResolvedValue(payload);
        const request: MockRequest = { header: () => 'Bearer good-token' };

        await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
        expect(jwtService.verifyAsync).toHaveBeenCalledWith('good-token');
        expect(request.user).toEqual(payload);
    });
});
