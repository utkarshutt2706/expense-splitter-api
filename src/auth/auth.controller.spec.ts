import { instanceToPlain } from 'class-transformer';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { REFRESH_COOKIE_NAME } from './refresh-session';

type MockedAuthService = {
    register: jest.Mock;
    login: jest.Mock;
    changePassword: jest.Mock;
    createRefreshSession: jest.Mock;
    refresh: jest.Mock;
    revokeRefreshSession: jest.Mock;
};

describe('AuthController', () => {
    let controller: AuthController;
    let authService: MockedAuthService;
    let response: { cookie: jest.Mock; clearCookie: jest.Mock };

    const tokenResponse: AuthTokenResponseDto = {
        user: {
            id: 'user-1',
            name: 'Existing User',
            email: 'existing@example.com',
            phone: null,
            avatarUrl: null,
        },
        accessToken: 'signed-jwt-token',
    };

    beforeEach(() => {
        authService = {
            register: jest.fn(),
            login: jest.fn(),
            changePassword: jest.fn(),
            createRefreshSession: jest.fn().mockResolvedValue('refresh-token'),
            refresh: jest.fn(),
            revokeRefreshSession: jest.fn(),
        };
        response = { cookie: jest.fn(), clearCookie: jest.fn() };
        controller = new AuthController(authService as unknown as AuthService);
    });

    it('delegates register to the service', async () => {
        authService.register.mockResolvedValue(tokenResponse);

        const dto = {
            name: 'Existing User',
            phone: '9876543210',
            email: 'existing@example.com',
            password: 'password123',
        };
        await expect(controller.register(dto, response as never)).resolves.toEqual(tokenResponse);
        expect(authService.register).toHaveBeenCalledWith(dto);
        expect(authService.createRefreshSession).toHaveBeenCalledWith('user-1');
        expect(response.cookie).toHaveBeenCalledWith(
            REFRESH_COOKIE_NAME,
            'refresh-token',
            expect.objectContaining({ httpOnly: true, maxAge: 604_800_000 }),
        );
    });

    it('delegates login to the service', async () => {
        authService.login.mockResolvedValue(tokenResponse);

        const dto = { email: 'existing@example.com', password: 'password123' };
        await expect(controller.login(dto, response as never)).resolves.toEqual(tokenResponse);
        expect(authService.login).toHaveBeenCalledWith(dto);
    });

    it('restores a session from the refresh cookie', async () => {
        authService.refresh.mockResolvedValue(tokenResponse);
        const request = { headers: { cookie: `${REFRESH_COOKIE_NAME}=refresh-token` } };

        await expect(
            controller.refresh('ExpenseSplitter', request as never, response as never),
        ).resolves.toEqual(tokenResponse);
        expect(authService.refresh).toHaveBeenCalledWith('refresh-token');
    });

    it('returns null without calling the service when no refresh cookie exists', async () => {
        await expect(
            controller.refresh('ExpenseSplitter', { headers: {} } as never, response as never),
        ).resolves.toBeNull();
        expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('revokes the refresh session and clears its cookie on logout', async () => {
        const request = { headers: { cookie: `${REFRESH_COOKIE_NAME}=refresh-token` } };

        await controller.logout('ExpenseSplitter', request as never, response as never);

        expect(authService.revokeRefreshSession).toHaveBeenCalledWith('refresh-token');
        expect(response.clearCookie).toHaveBeenCalledWith(
            REFRESH_COOKIE_NAME,
            expect.objectContaining({ httpOnly: true }),
        );
    });

    it('rejects refresh requests without the session header', async () => {
        await expect(
            controller.refresh(undefined, { headers: {} } as never, response as never),
        ).rejects.toThrow('Invalid session request');
        expect(authService.refresh).not.toHaveBeenCalled();
    });

    it("delegates changePassword to the service with the caller's own id", async () => {
        authService.changePassword.mockResolvedValue(undefined);

        const dto = { currentPassword: 'old-password', newPassword: 'a-new-secure-password' };
        await expect(
            controller.changePassword({ sub: 'user-1', email: 'existing@example.com' }, dto),
        ).resolves.toBeUndefined();
        expect(authService.changePassword).toHaveBeenCalledWith('user-1', dto);
    });

    it('clears an invalid refresh session cookie with matching scope', async () => {
        authService.refresh.mockResolvedValue(null);
        await expect(
            controller.refresh(
                'ExpenseSplitter',
                { headers: { cookie: `${REFRESH_COOKIE_NAME}=expired` } } as never,
                response as never,
            ),
        ).resolves.toBeNull();
        expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/auth',
        });
        expect(response.cookie).not.toHaveBeenCalled();
    });
    it('clears the cookie on repeated logout without a server session', async () => {
        await controller.logout('ExpenseSplitter', { headers: {} } as never, response as never);
        expect(authService.revokeRefreshSession).not.toHaveBeenCalled();
        expect(response.clearCookie).toHaveBeenCalledTimes(1);
    });
    it.each([undefined, '', 'expensesplitter', 'wrong'])(
        'rejects logout header %p before any side effect',
        async (header) => {
            await expect(
                controller.logout(
                    header,
                    { headers: { cookie: `${REFRESH_COOKIE_NAME}=token` } } as never,
                    response as never,
                ),
            ).rejects.toThrow('Invalid session request');
            expect(authService.revokeRefreshSession).not.toHaveBeenCalled();
            expect(response.clearCookie).not.toHaveBeenCalled();
        },
    );
    it('does not create a session or cookie when login fails', async () => {
        const error = new Error('login unavailable');
        authService.login.mockRejectedValue(error);
        await expect(
            controller.login({ email: 'a@example.com', password: 'p' }, response as never),
        ).rejects.toBe(error);
        expect(authService.createRefreshSession).not.toHaveBeenCalled();
        expect(response.cookie).not.toHaveBeenCalled();
    });
    it('does not issue a cookie when session persistence fails', async () => {
        const error = new Error('session unavailable');
        authService.login.mockResolvedValue(tokenResponse);
        authService.createRefreshSession.mockRejectedValue(error);
        await expect(
            controller.login({ email: 'a@example.com', password: 'p' }, response as never),
        ).rejects.toBe(error);
        expect(response.cookie).not.toHaveBeenCalled();
    });
    it('propagates revocation failure without reporting a cleared cookie', async () => {
        const error = new Error('revoke unavailable');
        authService.revokeRefreshSession.mockRejectedValue(error);
        await expect(
            controller.logout(
                'ExpenseSplitter',
                { headers: { cookie: `${REFRESH_COOKIE_NAME}=token` } } as never,
                response as never,
            ),
        ).rejects.toBe(error);
        expect(response.clearCookie).not.toHaveBeenCalled();
    });
    it('sets and clears production cookies with the same secure cross-site scope', async () => {
        const previous = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        try {
            await jest.isolateModulesAsync(async () => {
                const { AuthController: ProductionController } =
                    jest.requireActual<typeof import('./auth.controller')>('./auth.controller');
                const productionController = new ProductionController(
                    authService as unknown as AuthService,
                );
                authService.login.mockResolvedValue(tokenResponse);
                await expect(
                    productionController.login(
                        { email: 'existing@example.com', password: 'password123' },
                        response as never,
                    ),
                ).resolves.toEqual(tokenResponse);
                const scope = { httpOnly: true, secure: true, sameSite: 'none', path: '/auth' };
                expect(response.cookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, 'refresh-token', {
                    ...scope,
                    maxAge: 604_800_000,
                });
                await productionController.logout(
                    'ExpenseSplitter',
                    { headers: {} } as never,
                    response as never,
                );
                expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, scope);
            });
        } finally {
            if (previous === undefined) delete process.env.NODE_ENV;
            else process.env.NODE_ENV = previous;
        }
    });
});

describe('AuthUserResponseDto serialization', () => {
    it.each([
        { email: null, phone: null, avatarUrl: null },
        {
            email: 'user@example.com',
            phone: '+919876543210',
            avatarUrl: 'https://example.com/avatar.png',
        },
    ])('preserves public profile fields and explicit nulls: %p', (profile) => {
        const user = new AuthUserResponseDto();
        user.id = 'user-1';
        user.name = 'Asha';
        user.email = profile.email;
        user.phone = profile.phone;
        user.avatarUrl = profile.avatarUrl;

        const serialized: unknown = instanceToPlain(user);
        expect(serialized).toStrictEqual({
            id: 'user-1',
            name: 'Asha',
            email: profile.email,
            phone: profile.phone,
            avatarUrl: profile.avatarUrl,
        });
        expect(JSON.stringify(serialized)).toBe(
            JSON.stringify({ id: 'user-1', name: 'Asha', ...profile }),
        );
    });
});
