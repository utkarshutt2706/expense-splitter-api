import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { EnvConfig } from '../config/env.validation';
import { MailService } from './mail.service';

jest.mock('nodemailer');

describe('MailService', () => {
    let service: MailService;
    let configService: { get: jest.Mock };
    let sendMail: jest.Mock;

    const email = {
        to: 'bob@example.com',
        inviteUrl: 'https://frontend.example.com/register?invite=raw-token',
        groupName: 'Goa Trip',
        inviterName: 'Alice',
        expiresAt: new Date('2026-08-13T00:00:00.000Z'),
        frontendUrl: 'https://frontend.example.com',
    };

    beforeEach(() => {
        sendMail = jest.fn().mockResolvedValue({ messageId: 'message-1' });
        (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

        configService = {
            get: jest.fn((key: string) =>
                key === 'GMAIL_USER' ? 'utkarshutt2706@gmail.com' : 'an-app-password',
            ),
        };

        service = new MailService(configService as unknown as ConfigService<EnvConfig, true>);
    });

    it('creates a Gmail SMTP transport with the configured credentials', () => {
        expect(nodemailer.createTransport).toHaveBeenCalledWith({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user: 'utkarshutt2706@gmail.com', pass: 'an-app-password' },
        });
    });

    it('sends the invitation email with subject, html, and text', async () => {
        await service.sendInvitationEmail(email);

        expect(sendMail).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'Expense Splitter <utkarshutt2706@gmail.com>',
                to: 'bob@example.com',
                subject: expect.stringContaining('Alice') as string,
                html: expect.stringContaining('Goa Trip') as string,
                text: expect.stringContaining(email.inviteUrl) as string,
            }),
        );
    });

    it('does not throw when sending fails', async () => {
        sendMail.mockRejectedValue(new Error('invalid login'));

        await expect(service.sendInvitationEmail(email)).resolves.toBeUndefined();
    });
});
