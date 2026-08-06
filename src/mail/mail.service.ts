import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
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
}

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly resend: Resend;
    private readonly from: string;

    constructor(private readonly configService: ConfigService<EnvConfig, true>) {
        this.resend = new Resend(this.configService.get('RESEND_API_KEY', { infer: true }));
        this.from = this.configService.get('MAIL_FROM', { infer: true });
    }

    async sendInvitationEmail(email: InvitationEmail): Promise<void> {
        const { error } = await this.resend.emails.send({
            from: this.from,
            to: email.to,
            subject: invitationEmailSubject(email),
            html: invitationEmailHtml(email),
            text: invitationEmailText(email),
        });

        if (error) {
            this.logger.error(`Failed to send invitation email to ${email.to}: ${error.message}`);
            return;
        }

        this.logger.log(`Invitation email sent to ${email.to} for group "${email.groupName}"`);
    }
}
