import { GroupResponseDto } from './dto/group-response.dto';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

type MockedGroupsService = {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    rename: jest.Mock;
    addMember: jest.Mock;
    removeMember: jest.Mock;
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

    beforeEach(() => {
        groupsService = {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            rename: jest.fn(),
            addMember: jest.fn(),
            removeMember: jest.fn(),
        };
        controller = new GroupsController(groupsService as unknown as GroupsService);
    });

    it('delegates create to the service', async () => {
        groupsService.create.mockResolvedValue(group);

        const dto = { name: 'Daaru Party', memberIds: ['user-1', 'user-2'] };
        await expect(controller.create(dto)).resolves.toEqual(group);
        expect(groupsService.create).toHaveBeenCalledWith(dto);
    });

    it('delegates findAll to the service', async () => {
        groupsService.findAll.mockResolvedValue([group]);

        await expect(controller.findAll()).resolves.toEqual([group]);
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

    it('delegates rename to the service', async () => {
        groupsService.rename.mockResolvedValue({ ...group, name: 'New Name' });

        await expect(controller.rename('group-1', { name: 'New Name' })).resolves.toMatchObject({
            name: 'New Name',
        });
        expect(groupsService.rename).toHaveBeenCalledWith('group-1', 'New Name');
    });

    it('delegates addMember to the service', async () => {
        groupsService.addMember.mockResolvedValue(group);

        const dto = { userId: 'user-3' };
        await expect(controller.addMember('group-1', dto)).resolves.toEqual(group);
        expect(groupsService.addMember).toHaveBeenCalledWith('group-1', dto);
    });

    it('delegates removeMember to the service', async () => {
        groupsService.removeMember.mockResolvedValue(group);

        await expect(controller.removeMember('group-1', 'user-2')).resolves.toEqual(group);
        expect(groupsService.removeMember).toHaveBeenCalledWith('group-1', 'user-2');
    });
});
