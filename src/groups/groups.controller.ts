import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GroupMembershipGuard } from '../common/guards/group-membership.guard';
import { JwtPayload } from '../common/jwt-payload';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupsService } from './groups.service';

@ApiBearerAuth('access-token')
@Controller('groups')
export class GroupsController {
    constructor(private readonly groupsService: GroupsService) {}

    @Post()
    create(
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateGroupDto,
    ): Promise<GroupResponseDto> {
        return this.groupsService.create(user.sub, dto);
    }

    @Get()
    findAll(@CurrentUser() user: JwtPayload): Promise<GroupResponseDto[]> {
        return this.groupsService.findAll(user.sub);
    }

    @UseGuards(GroupMembershipGuard)
    @Get(':id')
    findOne(@Param('id') id: string): Promise<GroupResponseDto> {
        return this.groupsService.findOne(id);
    }

    @UseGuards(GroupMembershipGuard)
    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateGroupDto): Promise<GroupResponseDto> {
        return this.groupsService.update(id, dto);
    }

    @UseGuards(GroupMembershipGuard)
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id') id: string): Promise<void> {
        await this.groupsService.remove(id);
    }
}
