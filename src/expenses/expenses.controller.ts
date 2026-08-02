import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseResponseDto } from './dto/expense-response.dto';
import { ExpensesService } from './expenses.service';

@Controller('groups/:groupId/expenses')
export class ExpensesController {
    constructor(private readonly expensesService: ExpensesService) {}

    @Post()
    create(
        @Param('groupId') groupId: string,
        @Body() dto: CreateExpenseDto,
    ): Promise<ExpenseResponseDto> {
        return this.expensesService.create(groupId, dto);
    }

    @Get()
    findAllByGroup(@Param('groupId') groupId: string): Promise<ExpenseResponseDto[]> {
        return this.expensesService.findAllByGroup(groupId);
    }
}
