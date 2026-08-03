import { Module } from '@nestjs/common';
import { GroupMembershipGuard } from '../common/guards/group-membership.guard';
import { BalancesController } from './balances.controller';
import { BalancesService } from './balances.service';

@Module({
    controllers: [BalancesController],
    providers: [BalancesService, GroupMembershipGuard],
})
export class BalancesModule {}
