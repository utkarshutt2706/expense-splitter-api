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
});
