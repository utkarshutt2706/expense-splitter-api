import { InvitationValidationController } from './invitation-validation.controller';
import { InvitationsService } from './invitations.service';

describe('InvitationValidationController', () => {
    let controller: InvitationValidationController;
    let invitationsService: { validate: jest.Mock };

    beforeEach(() => {
        invitationsService = { validate: jest.fn() };
        controller = new InvitationValidationController(
            invitationsService as unknown as InvitationsService,
        );
    });

    it('delegates validate to the service', async () => {
        const response = { email: 'bob@example.com', group: { id: 'group-1', name: 'Goa Trip' } };
        invitationsService.validate.mockResolvedValue(response);

        await expect(controller.validate('raw-token')).resolves.toEqual(response);
        expect(invitationsService.validate).toHaveBeenCalledWith('raw-token');
    });
});
