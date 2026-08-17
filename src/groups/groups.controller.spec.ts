import { JwtPayload } from '../common/jwt-payload';
import { GroupResponseDto } from './dto/group-response.dto';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

type MockedGroupsService = {
    create: jest.Mock;
    findAll: jest.Mock;
    findAllSummaries: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    update: jest.Mock;
};

describe('GroupsController', () => {
    let controller: GroupsController;
    let groupsService: MockedGroupsService;

    const group: GroupResponseDto = {
        id: 'group-1',
        name: 'Daaru Party',
        memberIds: ['user-1', 'user-2'],
        createdAt: '2026-07-01T00:00:00.000Z',
    };
    const currentUser: JwtPayload = { sub: 'user-1', email: 'user-1@example.com' };

    beforeEach(() => {
        groupsService = {
            create: jest.fn(),
            findAll: jest.fn(),
            findAllSummaries: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            update: jest.fn(),
        };
        controller = new GroupsController(groupsService as unknown as GroupsService);
    });

    it('delegates create to the service with the current user as creator', async () => {
        groupsService.create.mockResolvedValue(group);

        const dto = { name: 'Daaru Party', memberIds: ['user-1', 'user-2'] };
        await expect(controller.create(currentUser, dto)).resolves.toEqual(group);
        expect(groupsService.create).toHaveBeenCalledWith('user-1', dto);
    });

    it('delegates findAll to the service scoped to the current user', async () => {
        groupsService.findAll.mockResolvedValue([group]);

        await expect(controller.findAll(currentUser)).resolves.toEqual([group]);
        expect(groupsService.findAll).toHaveBeenCalledWith('user-1');
    });

    it('delegates group summaries to the service scoped to the current user', async () => {
        const summaries = [{ ...group, memberCount: 2, currentUserBalance: 0 }];
        groupsService.findAllSummaries.mockResolvedValue(summaries);

        await expect(controller.findAllSummaries(currentUser)).resolves.toEqual(summaries);
        expect(groupsService.findAllSummaries).toHaveBeenCalledWith('user-1');
    });

    it('delegates findOne to the service', async () => {
        groupsService.findOne.mockResolvedValue(group);

        await expect(controller.findOne('group-1')).resolves.toEqual(group);
        expect(groupsService.findOne).toHaveBeenCalledWith('group-1');
    });

    it('delegates remove to the service', async () => {
        groupsService.remove.mockResolvedValue(undefined);

        await expect(controller.remove('group-1')).resolves.toBeUndefined();
        expect(groupsService.remove).toHaveBeenCalledWith('group-1');
    });

    it('delegates update to the service', async () => {
        groupsService.update.mockResolvedValue({ ...group, name: 'New Name' });

        const dto = { name: 'New Name', memberIds: ['user-1'] };
        await expect(controller.update('group-1', dto)).resolves.toMatchObject({
            name: 'New Name',
        });
        expect(groupsService.update).toHaveBeenCalledWith('group-1', dto);
    });
});
