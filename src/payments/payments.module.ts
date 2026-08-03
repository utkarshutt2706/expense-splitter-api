import { Module } from '@nestjs/common';
import { GroupMembershipGuard } from '../common/guards/group-membership.guard';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
    controllers: [PaymentsController],
    providers: [PaymentsService, GroupMembershipGuard],
})
export class PaymentsModule {}
