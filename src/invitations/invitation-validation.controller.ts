import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ValidateInvitationResponseDto } from './dto/validate-invitation-response.dto';
import { InvitationsService } from './invitations.service';

@Controller('invitations')
export class InvitationValidationController {
    constructor(private readonly invitationsService: InvitationsService) {}

    @Public()
    @Get(':token')
    validate(@Param('token') token: string): Promise<ValidateInvitationResponseDto> {
        return this.invitationsService.validate(token);
    }
}
