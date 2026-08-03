import { Injectable, Logger } from '@nestjs/common';

export interface InvitationEmail {
    to: string;
    inviteUrl: string;
    groupName: string;
    inviterName: string;
}

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    sendInvitationEmail(email: InvitationEmail): void {
        this.logger.log(
            `Invitation email to ${email.to}: ${email.inviterName} invited you to join ` +
                `"${email.groupName}". Accept at ${email.inviteUrl}`,
        );
    }
}
