import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

type MockedAuthService = {
    register: jest.Mock;
    login: jest.Mock;
};

describe('AuthController', () => {
    let controller: AuthController;
    let authService: MockedAuthService;

    const user: AuthUserResponseDto = {
        id: 'user-1',
        name: 'Existing User',
        email: 'existing@example.com',
        phone: null,
        avatarUrl: null,
    };

    beforeEach(() => {
        authService = { register: jest.fn(), login: jest.fn() };
        controller = new AuthController(authService as unknown as AuthService);
    });

    it('delegates register to the service', async () => {
        authService.register.mockResolvedValue(user);

        const dto = {
            name: 'Existing User',
            email: 'existing@example.com',
            password: 'password123',
        };
        await expect(controller.register(dto)).resolves.toEqual(user);
        expect(authService.register).toHaveBeenCalledWith(dto);
    });

    it('delegates login to the service', async () => {
        authService.login.mockResolvedValue(user);

        const dto = { email: 'existing@example.com', password: 'password123' };
        await expect(controller.login(dto)).resolves.toEqual(user);
        expect(authService.login).toHaveBeenCalledWith(dto);
    });
});
