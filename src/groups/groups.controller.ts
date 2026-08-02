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
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
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

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateGroupDto): Promise<GroupResponseDto> {
        return this.groupsService.update(id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id') id: string): Promise<void> {
        await this.groupsService.remove(id);
    }
}
