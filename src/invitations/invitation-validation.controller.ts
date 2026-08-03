import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { ValidateInvitationResponseDto } from './dto/validate-invitation-response.dto';
import { InvitationsService } from './invitations.service';

@Controller('invitations')
export class InvitationValidationController {
    constructor(private readonly invitationsService: InvitationsService) {}

    @Public()
    @Get(':token')
    @ApiOperation({
        summary: 'Validate an invitation token',
        description:
            'Public -- the token itself is the credential. Called when the registration page loads ' +
            'with ?invite=<token> in the URL, to show which group/email the invite is for before ' +
            'the person registers.',
    })
    @ApiResponse({
        status: 200,
        description: 'The invitation is valid and pending.',
        type: ValidateInvitationResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'No invitation matches this token.',
        type: ErrorResponseDto,
    })
    @ApiResponse({
        status: 409,
        description: 'The invitation exists but is expired, revoked, or already accepted.',
        type: ErrorResponseDto,
    })
    validate(@Param('token') token: string): Promise<ValidateInvitationResponseDto> {
        return this.invitationsService.validate(token);
    }
}
