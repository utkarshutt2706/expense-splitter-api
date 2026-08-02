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
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseResponseDto } from './dto/expense-response.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
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

    @Get(':id')
    findOne(
        @Param('groupId') groupId: string,
        @Param('id') id: string,
    ): Promise<ExpenseResponseDto> {
        return this.expensesService.findOne(groupId, id);
    }

    @Patch(':id')
    update(
        @Param('groupId') groupId: string,
        @Param('id') id: string,
        @Body() dto: UpdateExpenseDto,
    ): Promise<ExpenseResponseDto> {
        return this.expensesService.update(groupId, id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('groupId') groupId: string, @Param('id') id: string): Promise<void> {
        await this.expensesService.remove(groupId, id);
    }
}
