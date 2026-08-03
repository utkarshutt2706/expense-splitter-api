import { AuthTokenResponseDto } from './dto/auth-token-response.dto';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

type MockedAuthService = {
    register: jest.Mock;
    login: jest.Mock;
};

describe('AuthController', () => {
    let controller: AuthController;
    let authService: MockedAuthService;

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
        authService = { register: jest.fn(), login: jest.fn() };
        controller = new AuthController(authService as unknown as AuthService);
    });

    it('delegates register to the service', async () => {
        authService.register.mockResolvedValue(tokenResponse);

        const dto = {
            name: 'Existing User',
            email: 'existing@example.com',
            password: 'password123',
        };
        await expect(controller.register(dto)).resolves.toEqual(tokenResponse);
        expect(authService.register).toHaveBeenCalledWith(dto);
    });

    it('delegates login to the service', async () => {
        authService.login.mockResolvedValue(tokenResponse);

        const dto = { email: 'existing@example.com', password: 'password123' };
        await expect(controller.login(dto)).resolves.toEqual(tokenResponse);
        expect(authService.login).toHaveBeenCalledWith(dto);
    });
});
