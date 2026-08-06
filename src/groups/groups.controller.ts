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
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
    ApiGroupScopedErrors,
    ApiUnauthorizedError,
} from '../common/decorators/api-common-errors.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { errorExample, ErrorResponseDto } from '../common/dto/error-response.dto';
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
    @ApiOperation({
        summary: 'Create a group',
        description: 'The caller is always added to memberIds even if they omit themselves.',
    })
    @ApiResponse({ status: 201, description: 'Group created.', type: GroupResponseDto })
    @ApiResponse({
        status: 400,
        description: 'Validation error, or a memberId does not reference an existing user.',
        type: ErrorResponseDto,
        examples: {
            validation: {
                summary: 'Validation error',
                value: errorExample(
                    'VALIDATION_ERROR',
                    'MemberIds must contain at least 1 elements',
                ),
            },
            unknownMember: {
                summary: 'Unknown memberId',
                value: errorExample(
                    'VALIDATION_ERROR',
                    'One or more memberIds do not reference an existing user',
                ),
            },
        },
    })
    @ApiUnauthorizedError()
    create(
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateGroupDto,
    ): Promise<GroupResponseDto> {
        return this.groupsService.create(user.sub, dto);
    }

    @Get()
    @ApiOperation({
        summary: "List the caller's groups",
        description: 'Only returns groups the caller is currently a member of.',
    })
    @ApiResponse({ status: 200, description: 'The groups.', type: [GroupResponseDto] })
    @ApiUnauthorizedError()
    findAll(@CurrentUser() user: JwtPayload): Promise<GroupResponseDto[]> {
        return this.groupsService.findAll(user.sub);
    }

    @UseGuards(GroupMembershipGuard)
    @Get(':id')
    @ApiOperation({ summary: 'Get a group by id' })
    @ApiResponse({ status: 200, description: 'The group.', type: GroupResponseDto })
    @ApiGroupScopedErrors()
    findOne(@Param('id') id: string): Promise<GroupResponseDto> {
        return this.groupsService.findOne(id);
    }

    @UseGuards(GroupMembershipGuard)
    @Patch(':id')
    @ApiOperation({
        summary: 'Rename a group and/or replace its membership',
        description:
            'Partial update. memberIds, when sent, fully replaces the current membership -- it is ' +
            'not a delta of individual adds/removes.',
    })
    @ApiResponse({ status: 200, description: 'Updated group.', type: GroupResponseDto })
    @ApiResponse({
        status: 400,
        description: 'A memberId does not reference an existing user.',
        type: ErrorResponseDto,
        example: errorExample(
            'VALIDATION_ERROR',
            'One or more memberIds do not reference an existing user',
        ),
    })
    @ApiResponse({
        status: 409,
        description:
            'memberIds omits one or more current members who still have an unsettled balance ' +
            '(including a member removing themselves) -- they must be settled up before leaving ' +
            'or being removed.',
        type: ErrorResponseDto,
        example: errorExample(
            'CONFLICT',
            'Cannot remove member(s) with an unsettled balance: user-1',
        ),
    })
    @ApiGroupScopedErrors()
    update(@Param('id') id: string, @Body() dto: UpdateGroupDto): Promise<GroupResponseDto> {
        return this.groupsService.update(id, dto);
    }

    @UseGuards(GroupMembershipGuard)
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Delete a group',
        description:
            "Cascades: deletes the group's memberships, expenses, expense splits, payments, and " +
            'invitations too. Every member must have a zero balance first.',
    })
    @ApiResponse({ status: 204, description: 'Deleted.' })
    @ApiResponse({
        status: 409,
        description: 'One or more members still have an unsettled balance.',
        type: ErrorResponseDto,
        example: errorExample(
            'CONFLICT',
            'Cannot delete a group with unsettled balances -- everyone must be settled up first',
        ),
    })
    @ApiGroupScopedErrors()
    async remove(@Param('id') id: string): Promise<void> {
        await this.groupsService.remove(id);
    }
}
