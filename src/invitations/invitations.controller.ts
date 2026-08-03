import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
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
    @ApiOperation({
        summary: 'Invite an unregistered email to a group',
        description:
            'Only for emails that are not yet registered -- if the email already belongs to a ' +
            'user, look them up via Users > Lookup and add them directly with Groups > Update ' +
            'instead. Idempotent: calling again for the same email while a pending invite exists ' +
            'returns that same invitation (200) rather than creating a duplicate.',
    })
    @ApiResponse({ status: 201, description: 'Invitation created.', type: InvitationResponseDto })
    @ApiResponse({
        status: 200,
        description: 'A pending invitation for this email already existed.',
        type: InvitationResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Malformed email.', type: ErrorResponseDto })
    @ApiResponse({ status: 401, description: 'Missing or invalid token.', type: ErrorResponseDto })
    @ApiResponse({
        status: 403,
        description: 'The caller is not a member of this group.',
        type: ErrorResponseDto,
    })
    @ApiResponse({
        status: 409,
        description:
            'The email already belongs to a registered user, or is already an active member of ' +
            'this group.',
        type: ErrorResponseDto,
    })
    create(
        @Param('groupId') groupId: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateInvitationDto,
    ): Promise<InvitationResponseDto> {
        return this.invitationsService.create(groupId, user.sub, dto);
    }
}
