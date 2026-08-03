import { MailService } from './mail.service';

describe('MailService', () => {
    it('logs the invitation email without throwing', () => {
        const service = new MailService();

        expect(() =>
            service.sendInvitationEmail({
                to: 'bob@example.com',
                inviteUrl: 'https://frontend.example.com/register?invite=raw-token',
                groupName: 'Goa Trip',
                inviterName: 'Alice',
            }),
        ).not.toThrow();
    });
});
