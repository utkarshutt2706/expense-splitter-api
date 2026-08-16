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
    ApiNotGroupMemberError,
    ApiUnauthorizedError,
} from '../common/decorators/api-common-errors.decorator';
import { errorExample, ErrorResponseDto } from '../common/dto/error-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GroupMembershipGuard } from '../common/guards/group-membership.guard';
import { JwtPayload } from '../common/jwt-payload';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseResponseDto } from './dto/expense-response.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

const GROUP_NOT_FOUND_EXAMPLE = errorExample('NOT_FOUND', 'Group does-not-exist not found');
const EXPENSE_NOT_FOUND_EXAMPLE = errorExample(
    'NOT_FOUND',
    'Expense does-not-exist not found in group group-daaru-party',
);
const EXPENSE_OR_GROUP_NOT_FOUND_RESPONSE = ApiResponse({
    status: 404,
    description: 'No group with that id, or no expense with that id in this group.',
    type: ErrorResponseDto,
    examples: {
        groupNotFound: { summary: 'Group not found', value: GROUP_NOT_FOUND_EXAMPLE },
        expenseNotFound: { summary: 'Expense not found', value: EXPENSE_NOT_FOUND_EXAMPLE },
    },
});

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
        examples: {
            validation: {
                summary: 'Validation error',
                value: errorExample(
                    'VALIDATION_ERROR',
                    'Description must be shorter than or equal to 500 characters',
                ),
            },
            equalSplitMismatch: {
                summary: 'equal split does not reconcile',
                value: errorExample(
                    'VALIDATION_ERROR',
                    'submitted splits do not reconcile with the server-computed split',
                ),
            },
            exactSumMismatch: {
                summary: 'exact split does not sum to amount',
                value: errorExample(
                    'VALIDATION_ERROR',
                    'splits do not sum to the expense amount for an exact split',
                ),
            },
            percentagesMissing: {
                summary: 'percentages missing for percentage split',
                value: errorExample(
                    'VALIDATION_ERROR',
                    'percentages is required for a percentage split',
                ),
            },
            percentagesSum: {
                summary: 'percentages do not sum to 100',
                value: errorExample('VALIDATION_ERROR', 'percentages must sum to 100'),
            },
            sharesMissing: {
                summary: 'shares missing for shares split',
                value: errorExample('VALIDATION_ERROR', 'shares is required for a shares split'),
            },
            unknownUser: {
                summary: 'paidByUserId/split userId unknown',
                value: errorExample(
                    'VALIDATION_ERROR',
                    'paidByUserId or a split userId does not reference an existing user',
                ),
            },
        },
    })
    @ApiGroupScopedErrors()
    create(
        @Param('groupId') groupId: string,
        @Body() dto: CreateExpenseDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ExpenseResponseDto> {
        return this.expensesService.create(groupId, dto, user.sub);
    }

    @Get()
    @ApiOperation({ summary: 'List all expenses in a group' })
    @ApiResponse({ status: 200, description: 'The expenses.', type: [ExpenseResponseDto] })
    @ApiGroupScopedErrors()
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
    @ApiUnauthorizedError()
    @ApiNotGroupMemberError()
    @EXPENSE_OR_GROUP_NOT_FOUND_RESPONSE
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
        example: errorExample(
            'VALIDATION_ERROR',
            'submitted splits do not reconcile with the server-computed split',
        ),
    })
    @ApiUnauthorizedError()
    @ApiNotGroupMemberError()
    @EXPENSE_OR_GROUP_NOT_FOUND_RESPONSE
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
    @ApiUnauthorizedError()
    @ApiNotGroupMemberError()
    @EXPENSE_OR_GROUP_NOT_FOUND_RESPONSE
    async remove(@Param('groupId') groupId: string, @Param('id') id: string): Promise<void> {
        await this.expensesService.remove(groupId, id);
    }
}
