import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

describe('InvitationsController', () => {
    let controller: InvitationsController;
    let invitationsService: { create: jest.Mock };

    beforeEach(() => {
        invitationsService = { create: jest.fn() };
        controller = new InvitationsController(invitationsService as unknown as InvitationsService);
    });

    it('delegates create to the service with the caller as inviter', async () => {
        const response = {
            id: 'invitation-1',
            groupId: 'group-1',
            email: 'bob@example.com',
            status: 'pending',
            expiresAt: new Date().toISOString(),
        };
        invitationsService.create.mockResolvedValue(response);

        const result = await controller.create(
            'group-1',
            { sub: 'user-1', email: 'user-1@example.com' },
            { email: 'bob@example.com' },
        );

        expect(result).toEqual(response);
        expect(invitationsService.create).toHaveBeenCalledWith('group-1', 'user-1', {
            email: 'bob@example.com',
        });
    });
});
