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
} from '@nestjs/common';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { RenameGroupDto } from './dto/rename-group.dto';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
    constructor(private readonly groupsService: GroupsService) {}

    @Post()
    create(@Body() dto: CreateGroupDto): Promise<GroupResponseDto> {
        return this.groupsService.create(dto);
    }

    @Get()
    findAll(): Promise<GroupResponseDto[]> {
        return this.groupsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string): Promise<GroupResponseDto> {
        return this.groupsService.findOne(id);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id') id: string): Promise<void> {
        await this.groupsService.remove(id);
    }

    @Patch(':id/name')
    rename(@Param('id') id: string, @Body() dto: RenameGroupDto): Promise<GroupResponseDto> {
        return this.groupsService.rename(id, dto.name);
    }

    @Post(':id/members')
    addMember(@Param('id') id: string, @Body() dto: AddMemberDto): Promise<GroupResponseDto> {
        return this.groupsService.addMember(id, dto);
    }

    @Delete(':id/members/:userId')
    removeMember(
        @Param('id') id: string,
        @Param('userId') userId: string,
    ): Promise<GroupResponseDto> {
        return this.groupsService.removeMember(id, userId);
    }
}
