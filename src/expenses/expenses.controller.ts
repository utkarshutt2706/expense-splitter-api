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
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { GroupMembershipGuard } from '../common/guards/group-membership.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseResponseDto } from './dto/expense-response.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

@ApiBearerAuth('access-token')
@UseGuards(GroupMembershipGuard)
@Controller('groups/:groupId/expenses')
export class ExpensesController {
    constructor(private readonly expensesService: ExpensesService) {}

    @Post()
    @ApiOperation({
        summary: 'Record an expense',
        description:
            'The server independently recomputes the expected split from amount + splitType and ' +
            'rejects the write (400) if it does not reconcile with the submitted splits -- the ' +
            "client's numbers are never trusted blindly.",
    })
    @ApiResponse({ status: 201, description: 'Expense created.', type: ExpenseResponseDto })
    @ApiResponse({
        status: 400,
        description:
            'Validation error, submitted splits do not reconcile, or a userId does not reference ' +
            'an existing user.',
        type: ErrorResponseDto,
    })
    @ApiResponse({ status: 401, description: 'Missing or invalid token.', type: ErrorResponseDto })
    @ApiResponse({
        status: 403,
        description: 'The caller is not a member of this group.',
        type: ErrorResponseDto,
    })
    @ApiResponse({ status: 404, description: 'No group with that id.', type: ErrorResponseDto })
    create(
        @Param('groupId') groupId: string,
        @Body() dto: CreateExpenseDto,
    ): Promise<ExpenseResponseDto> {
        return this.expensesService.create(groupId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List all expenses in a group' })
    @ApiResponse({ status: 200, description: 'The expenses.', type: [ExpenseResponseDto] })
    @ApiResponse({ status: 401, description: 'Missing or invalid token.', type: ErrorResponseDto })
    @ApiResponse({
        status: 403,
        description: 'The caller is not a member of this group.',
        type: ErrorResponseDto,
    })
    @ApiResponse({ status: 404, description: 'No group with that id.', type: ErrorResponseDto })
    findAllByGroup(@Param('groupId') groupId: string): Promise<ExpenseResponseDto[]> {
        return this.expensesService.findAllByGroup(groupId);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Get an expense by id',
        description:
            'Scoped to the group in the URL -- an expense that exists but belongs to a different ' +
            'group also 404s here.',
    })
    @ApiResponse({ status: 200, description: 'The expense.', type: ExpenseResponseDto })
    @ApiResponse({ status: 401, description: 'Missing or invalid token.', type: ErrorResponseDto })
    @ApiResponse({
        status: 403,
        description: 'The caller is not a member of this group.',
        type: ErrorResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'No group with that id, or no expense with that id in this group.',
        type: ErrorResponseDto,
    })
    findOne(
        @Param('groupId') groupId: string,
        @Param('id') id: string,
    ): Promise<ExpenseResponseDto> {
        return this.expensesService.findOne(groupId, id);
    }

    @Patch(':id')
    @ApiOperation({
        summary: 'Replace an expense',
        description:
            'Full replacement, not a partial patch -- resend every field. Validated exactly like ' +
            'create, same reconciliation rules apply.',
    })
    @ApiResponse({ status: 200, description: 'Updated expense.', type: ExpenseResponseDto })
    @ApiResponse({
        status: 400,
        description: 'Validation error, or submitted splits do not reconcile.',
        type: ErrorResponseDto,
    })
    @ApiResponse({ status: 401, description: 'Missing or invalid token.', type: ErrorResponseDto })
    @ApiResponse({
        status: 403,
        description: 'The caller is not a member of this group.',
        type: ErrorResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'No group with that id, or no expense with that id in this group.',
        type: ErrorResponseDto,
    })
    update(
        @Param('groupId') groupId: string,
        @Param('id') id: string,
        @Body() dto: UpdateExpenseDto,
    ): Promise<ExpenseResponseDto> {
        return this.expensesService.update(groupId, id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Delete an expense',
        description: "Cascades to the expense's own splits.",
    })
    @ApiResponse({ status: 204, description: 'Deleted.' })
    @ApiResponse({ status: 401, description: 'Missing or invalid token.', type: ErrorResponseDto })
    @ApiResponse({
        status: 403,
        description: 'The caller is not a member of this group.',
        type: ErrorResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'No group with that id, or no expense with that id in this group.',
        type: ErrorResponseDto,
    })
    async remove(@Param('groupId') groupId: string, @Param('id') id: string): Promise<void> {
        await this.expensesService.remove(groupId, id);
    }
}
