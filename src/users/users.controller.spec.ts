import { User } from '@prisma/client';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

type MockedUsersService = {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
};

describe('UsersController', () => {
    let controller: UsersController;
    let usersService: MockedUsersService;

    const user: User = {
        id: 'user-1',
        name: 'Utkarsh',
        email: null,
        phone: null,
        avatarUrl: null,
    };

    beforeEach(() => {
        usersService = {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
        };
        controller = new UsersController(usersService as unknown as UsersService);
    });

    it('delegates create to the service', async () => {
        usersService.create.mockResolvedValue(user);

        await expect(controller.create({ name: 'Utkarsh' })).resolves.toEqual(user);
        expect(usersService.create).toHaveBeenCalledWith({ name: 'Utkarsh' });
    });

    it('delegates findAll to the service', async () => {
        usersService.findAll.mockResolvedValue([user]);

        await expect(controller.findAll()).resolves.toEqual([user]);
    });

    it('delegates findOne to the service', async () => {
        usersService.findOne.mockResolvedValue(user);

        await expect(controller.findOne('user-1')).resolves.toEqual(user);
        expect(usersService.findOne).toHaveBeenCalledWith('user-1');
    });

    it('delegates update to the service', async () => {
        usersService.update.mockResolvedValue(user);

        await expect(controller.update('user-1', { name: 'New Name' })).resolves.toEqual(user);
        expect(usersService.update).toHaveBeenCalledWith('user-1', { name: 'New Name' });
    });

    it('delegates remove to the service', async () => {
        usersService.remove.mockResolvedValue(user);

        await expect(controller.remove('user-1')).resolves.toBeUndefined();
        expect(usersService.remove).toHaveBeenCalledWith('user-1');
    });
});
