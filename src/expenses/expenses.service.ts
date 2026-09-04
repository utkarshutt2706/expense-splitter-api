import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Expense, ExpenseSplit, Prisma } from '@prisma/client';
import { assertActiveGroupParticipants } from '../common/group-participants';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseResponseDto } from './dto/expense-response.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { expenseParticipantUserIds, validateExpenseSplits } from './expense-split-validator';

type ExpenseWithSplits = Expense & { splits: ExpenseSplit[] };

@Injectable()
export class ExpensesService {
    constructor(private readonly prisma: PrismaService) {}

    async create(
        groupId: string,
        dto: CreateExpenseDto,
        createdByUserId = dto.paidByUserId,
    ): Promise<ExpenseResponseDto> {
        await assertActiveGroupParticipants(this.prisma, groupId, expenseParticipantUserIds(dto));

        validateExpenseSplits(dto);
        const paidOn = dto.paidOn ? new Date(dto.paidOn) : new Date();

        try {
            const expense = await this.prisma.expense.create({
                data: {
                    groupId,
                    description: dto.description,
                    amount: dto.amount,
                    paidByUserId: dto.paidByUserId,
                    createdByUserId,
                    splitType: dto.splitType,
                    paidOn,
                    splits: {
                        create: dto.splits.map((split) => ({
                            userId: split.userId,
                            amount: split.amount,
                        })),
                    },
                },
                include: { splits: true },
            });
            return this.toResponse(expense);
        } catch (error) {
            throw this.mapPrismaError(error);
        }
    }

    async findAllByGroup(groupId: string): Promise<ExpenseResponseDto[]> {
        await this.ensureGroupExists(groupId);

        const expenses = await this.prisma.expense.findMany({
            where: { groupId },
            include: { splits: true },
            orderBy: { createdAt: 'asc' },
        });
        return expenses.map((expense) => this.toResponse(expense));
    }

    async findOne(groupId: string, id: string): Promise<ExpenseResponseDto> {
        const expense = await this.prisma.expense.findFirst({
            where: { id, groupId },
            include: { splits: true },
        });
        if (!expense) {
            throw new NotFoundException(`Expense ${id} not found in group ${groupId}`);
        }
        return this.toResponse(expense);
    }

    async update(groupId: string, id: string, dto: UpdateExpenseDto): Promise<ExpenseResponseDto> {
        await this.findOne(groupId, id);
        await assertActiveGroupParticipants(this.prisma, groupId, expenseParticipantUserIds(dto));
        validateExpenseSplits(dto);
        const paidOn = dto.paidOn ? new Date(dto.paidOn) : new Date();

        try {
            await this.prisma.$transaction([
                this.prisma.expenseSplit.deleteMany({ where: { expenseId: id } }),
                this.prisma.expense.update({
                    where: { id },
                    data: {
                        description: dto.description,
                        amount: dto.amount,
                        paidByUserId: dto.paidByUserId,
                        splitType: dto.splitType,
                        paidOn,
                        splits: {
                            create: dto.splits.map((split) => ({
                                userId: split.userId,
                                amount: split.amount,
                            })),
                        },
                    },
                }),
            ]);
        } catch (error) {
            throw this.mapPrismaError(error, id);
        }

        return this.findOne(groupId, id);
    }

    async remove(groupId: string, id: string): Promise<void> {
        await this.findOne(groupId, id);

        try {
            await this.prisma.expense.delete({ where: { id } });
        } catch (error) {
            throw this.mapPrismaError(error, id);
        }
    }

    private async ensureGroupExists(groupId: string): Promise<void> {
        const group = await this.prisma.group.findUnique({ where: { id: groupId } });
        if (!group) {
            throw new NotFoundException(`Group ${groupId} not found`);
        }
    }

    private toResponse(expense: ExpenseWithSplits): ExpenseResponseDto {
        const paidOnValue = new Date(String(expense.paidOn ?? expense.createdAt));
        const amount = Number(expense.amount);

        return {
            id: expense.id,
            groupId: expense.groupId,
            description: expense.description,
            amount,
            paidByUserId: expense.paidByUserId,
            createdByUserId: expense.createdByUserId,
            splitType: expense.splitType,
            splits: expense.splits.map((split) => ({
                userId: split.userId,
                amount: Number(split.amount),
            })),
            paidOn: paidOnValue.toISOString(),
            createdAt: new Date(String(expense.createdAt)).toISOString(),
        };
    }

    private mapPrismaError(error: unknown, id?: string): Error {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2003') {
                return new BadRequestException(
                    'paidByUserId or a split userId does not reference an existing user',
                );
            }
            if (error.code === 'P2025') {
                return new NotFoundException(id ? `Expense ${id} not found` : 'Expense not found');
            }
        }
        return error instanceof Error ? error : new Error('Unexpected error');
    }
}
