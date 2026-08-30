import { FriendsController } from './friends.controller';
import { Friend, FriendsService } from './friends.service';

describe('FriendsController', () => {
    it('delegates friend discovery using the caller id', async () => {
        const friend = { id: 'user-2' } as Friend;
        const friendsService = { findFriends: jest.fn().mockResolvedValue([friend]) };
        const controller = new FriendsController(friendsService as unknown as FriendsService);

        await expect(
            controller.findFriends({ sub: 'user-1', email: 'user-1@example.com' }),
        ).resolves.toEqual([friend]);
        expect(friendsService.findFriends).toHaveBeenCalledWith('user-1');
    });
});
