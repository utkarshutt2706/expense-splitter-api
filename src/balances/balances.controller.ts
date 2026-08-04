import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiGroupScopedErrors } from '../common/decorators/api-common-errors.decorator';
import { GroupMembershipGuard } from '../common/guards/group-membership.guard';
import { BalancesService } from './balances.service';
import { GroupBalancesResponseDto } from './dto/group-balances-response.dto';

@ApiBearerAuth('access-token')
@UseGuards(GroupMembershipGuard)
@Controller('groups/:groupId/balances')
export class BalancesController {
    constructor(private readonly balancesService: BalancesService) {}

    @Get()
    @ApiOperation({
        summary: 'Get net balances and a minimal settlement plan for a group',
        description:
            'settlements is the Simplify Debt-minimized transaction list -- the fewest payments ' +
            'needed to bring every member to zero, not a raw pairwise ledger.',
    })
    @ApiResponse({
        status: 200,
        description: 'Balances and settlements.',
        type: GroupBalancesResponseDto,
    })
    @ApiGroupScopedErrors()
    getGroupBalances(@Param('groupId') groupId: string): Promise<GroupBalancesResponseDto> {
        return this.balancesService.getGroupBalances(groupId);
    }
}
