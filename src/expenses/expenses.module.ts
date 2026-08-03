import { Module } from '@nestjs/common';
import { GroupMembershipGuard } from '../common/guards/group-membership.guard';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
    controllers: [ExpensesController],
    providers: [ExpensesService, GroupMembershipGuard],
})
export class ExpensesModule {}
