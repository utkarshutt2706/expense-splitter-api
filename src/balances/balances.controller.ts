import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GroupMembershipGuard } from '../common/guards/group-membership.guard';
import { BalancesService } from './balances.service';
import { GroupBalancesResponseDto } from './dto/group-balances-response.dto';

@ApiBearerAuth('access-token')
@UseGuards(GroupMembershipGuard)
@Controller('groups/:groupId/balances')
export class BalancesController {
    constructor(private readonly balancesService: BalancesService) {}

    @Get()
    getGroupBalances(@Param('groupId') groupId: string): Promise<GroupBalancesResponseDto> {
        return this.balancesService.getGroupBalances(groupId);
    }
}
