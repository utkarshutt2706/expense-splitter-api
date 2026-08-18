import { ForbiddenException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { PublicUser, UsersService } from './users.service';

type MockedUsersService = {
    lookup: jest.Mock;
    findFriends: jest.Mock;
    findManyByIds: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
};

describe('UsersController', () => {
    let controller: UsersController;
    let usersService: MockedUsersService;

    const currentUser = { sub: 'user-1', email: 'user-1@example.com' };
    const user: PublicUser = {
        id: 'user-1',
        name: 'Utkarsh',
        email: null,
        phone: null,
        avatarUrl: null,
    };

    beforeEach(() => {
        usersService = {
            lookup: jest.fn(),
            findFriends: jest.fn(),
            findManyByIds: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
        };
        controller = new UsersController(usersService as unknown as UsersService);
    });

    it('delegates lookup to the service', async () => {
        usersService.lookup.mockResolvedValue([user]);

        await expect(controller.lookup({ query: 'utkar' })).resolves.toEqual([user]);
        expect(usersService.lookup).toHaveBeenCalledWith({ query: 'utkar' });
    });

    it('delegates findFriends to the service using the caller id', async () => {
        usersService.findFriends.mockResolvedValue([user]);

        await expect(controller.findFriends(currentUser)).resolves.toEqual([user]);
        expect(usersService.findFriends).toHaveBeenCalledWith('user-1');
    });

    it('delegates findManyByIds to the service', async () => {
        usersService.findManyByIds.mockResolvedValue([user]);

        await expect(controller.findManyByIds({ ids: ['user-1'] })).resolves.toEqual([user]);
        expect(usersService.findManyByIds).toHaveBeenCalledWith({ ids: ['user-1'] });
    });

    it('delegates findOne to the service', async () => {
        usersService.findOne.mockResolvedValue(user);

        await expect(controller.findOne('user-1')).resolves.toEqual(user);
        expect(usersService.findOne).toHaveBeenCalledWith('user-1');
    });

    it('delegates update to the service when updating self', async () => {
        usersService.update.mockResolvedValue(user);

        await expect(
            controller.update(currentUser, 'user-1', { name: 'New Name' }),
        ).resolves.toEqual(user);
        expect(usersService.update).toHaveBeenCalledWith('user-1', { name: 'New Name' });
    });

    it('throws ForbiddenException when updating a different user', () => {
        expect(() => controller.update(currentUser, 'user-2', { name: 'New Name' })).toThrow(
            ForbiddenException,
        );
        expect(usersService.update).not.toHaveBeenCalled();
    });

    it('delegates remove to the service when removing self', async () => {
        usersService.remove.mockResolvedValue(user);

        await expect(controller.remove(currentUser, 'user-1')).resolves.toBeUndefined();
        expect(usersService.remove).toHaveBeenCalledWith('user-1');
    });

    it('throws ForbiddenException when removing a different user', async () => {
        await expect(controller.remove(currentUser, 'user-2')).rejects.toThrow(ForbiddenException);
        expect(usersService.remove).not.toHaveBeenCalled();
    });
});
