import { Module } from '@nestjs/common';
import { BalancesModule } from '../balances/balances.module';
import { GroupMembershipGuard } from '../common/guards/group-membership.guard';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
    imports: [BalancesModule],
    controllers: [GroupsController],
    providers: [GroupsService, GroupMembershipGuard],
})
export class GroupsModule {}
