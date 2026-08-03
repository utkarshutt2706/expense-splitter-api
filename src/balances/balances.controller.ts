import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { BalancesService } from './balances.service';
import { GroupBalancesResponseDto } from './dto/group-balances-response.dto';

@ApiBearerAuth('access-token')
@Controller('groups/:groupId/balances')
export class BalancesController {
    constructor(private readonly balancesService: BalancesService) {}

    @Get()
    getGroupBalances(@Param('groupId') groupId: string): Promise<GroupBalancesResponseDto> {
        return this.balancesService.getGroupBalances(groupId);
    }
}
