import { Module } from '@nestjs/common';
import { GroupMembershipGuard } from '../common/guards/group-membership.guard';
import { MailModule } from '../mail/mail.module';
import { InvitationValidationController } from './invitation-validation.controller';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
    imports: [MailModule],
    controllers: [InvitationsController, InvitationValidationController],
    providers: [InvitationsService, GroupMembershipGuard],
})
export class InvitationsModule {}
