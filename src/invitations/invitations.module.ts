import { Module } from '@nestjs/common';
import { GroupMembershipGuard } from '../common/guards/group-membership.guard';
import { MailService } from '../mail/mail.service';
import { InvitationValidationController } from './invitation-validation.controller';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
    controllers: [InvitationsController, InvitationValidationController],
    providers: [InvitationsService, MailService, GroupMembershipGuard],
})
export class InvitationsModule {}
