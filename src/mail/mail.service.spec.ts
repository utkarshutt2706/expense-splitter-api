import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EnvConfig } from '../config/env.validation';
import { MailService } from './mail.service';

jest.mock('resend');

describe('MailService', () => {
    let service: MailService;
    let configService: { get: jest.Mock };
    let send: jest.Mock;

    const email = {
        to: 'bob@example.com',
        inviteUrl: 'https://frontend.example.com/register?invite=raw-token',
        groupName: 'Goa Trip',
        inviterName: 'Alice',
        expiresAt: new Date('2026-08-13T00:00:00.000Z'),
    };

    beforeEach(() => {
        send = jest.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null });
        (Resend as unknown as jest.Mock).mockImplementation(() => ({
            emails: { send },
        }));

        configService = {
            get: jest.fn((key: string) =>
                key === 'RESEND_API_KEY'
                    ? 're_test_key'
                    : 'Expense Splitter <onboarding@resend.dev>',
            ),
        };

        service = new MailService(configService as unknown as ConfigService<EnvConfig, true>);
    });

    it('sends the invitation email via Resend with subject, html, and text', async () => {
        await service.sendInvitationEmail(email);

        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'Expense Splitter <onboarding@resend.dev>',
                to: 'bob@example.com',
                subject: expect.stringContaining('Alice') as string,
                html: expect.stringContaining('Goa Trip') as string,
                text: expect.stringContaining(email.inviteUrl) as string,
            }),
        );
    });

    it('does not throw when Resend returns an error', async () => {
        send.mockResolvedValue({ data: null, error: { name: 'error', message: 'invalid domain' } });

        await expect(service.sendInvitationEmail(email)).resolves.toBeUndefined();
    });
});
