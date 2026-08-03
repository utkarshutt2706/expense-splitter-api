import { Module } from '@nestjs/common';
import { GroupMembershipGuard } from '../common/guards/group-membership.guard';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
    controllers: [GroupsController],
    providers: [GroupsService, GroupMembershipGuard],
})
export class GroupsModule {}
