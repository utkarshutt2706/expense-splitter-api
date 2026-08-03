import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GroupMembershipGuard } from '../common/guards/group-membership.guard';
import { JwtPayload } from '../common/jwt-payload';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationResponseDto } from './dto/invitation-response.dto';
import { InvitationsService } from './invitations.service';

@ApiBearerAuth('access-token')
@UseGuards(GroupMembershipGuard)
@Controller('groups/:groupId/invitations')
export class InvitationsController {
    constructor(private readonly invitationsService: InvitationsService) {}

    @Post()
    create(
        @Param('groupId') groupId: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateInvitationDto,
    ): Promise<InvitationResponseDto> {
        return this.invitationsService.create(groupId, user.sub, dto);
    }
}
