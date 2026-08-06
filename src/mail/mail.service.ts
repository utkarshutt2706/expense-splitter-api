import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { EnvConfig } from '../config/env.validation';
import {
    invitationEmailHtml,
    invitationEmailSubject,
    invitationEmailText,
} from './invitation-email-template';

export interface InvitationEmail {
    to: string;
    inviteUrl: string;
    groupName: string;
    inviterName: string;
    expiresAt: Date;
    frontendUrl: string;
}

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly transporter: Transporter;
    private readonly from: string;

    constructor(private readonly configService: ConfigService<EnvConfig, true>) {
        const user = this.configService.get('GMAIL_USER', { infer: true });
        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user,
                pass: this.configService.get('GMAIL_APP_PASSWORD', { infer: true }),
            },
        });
        this.from = `Expense Splitter <${user}>`;
    }

    async sendInvitationEmail(email: InvitationEmail): Promise<void> {
        try {
            await this.transporter.sendMail({
                from: this.from,
                to: email.to,
                subject: invitationEmailSubject(email),
                html: invitationEmailHtml(email),
                text: invitationEmailText(email),
            });
            this.logger.log(`Invitation email sent to ${email.to} for group "${email.groupName}"`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to send invitation email to ${email.to}: ${message}`);
        }
    }
}
