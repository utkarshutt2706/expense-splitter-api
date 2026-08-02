import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Expense, ExpenseSplit, Prisma, SplitType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseResponseDto } from './dto/expense-response.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import {
    Split,
    calculateEqualSplit,
    calculatePercentageSplit,
    calculateSharesSplit,
    splitsReconcile,
    sumAmounts,
} from './split-calculator';

type ExpenseWithSplits = Expense & { splits: ExpenseSplit[] };

const RECONCILE_TOLERANCE_CENTS = 1;
const PERCENTAGE_SUM_TOLERANCE = 0.01;

@Injectable()
export class ExpensesService {
    constructor(private readonly prisma: PrismaService) {}

    async create(groupId: string, dto: CreateExpenseDto): Promise<ExpenseResponseDto> {
        await this.ensureGroupExists(groupId);

        const submitted: Split[] = dto.splits;
        this.validateSplits(dto);

        try {
            const expense = await this.prisma.expense.create({
                data: {
                    groupId,
                    description: dto.description,
                    amount: dto.amount,
                    paidByUserId: dto.paidByUserId,
                    splitType: dto.splitType,
                    splits: {
                        create: submitted.map((split) => ({
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
        this.validateSplits(dto);

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

    private validateSplits(dto: CreateExpenseDto): void {
        if (dto.splitType === SplitType.exact) {
            const total = sumAmounts(dto.splits);
            if (Math.round(total * 100) !== Math.round(dto.amount * 100)) {
                throw new BadRequestException(
                    'splits do not sum to the expense amount for an exact split',
                );
            }
            return;
        }

        const computed = this.computeExpectedSplits(dto);
        if (!splitsReconcile(dto.splits, computed, RECONCILE_TOLERANCE_CENTS)) {
            throw new BadRequestException(
                'submitted splits do not reconcile with the server-computed split',
            );
        }
    }

    private computeExpectedSplits(dto: CreateExpenseDto): Split[] {
        switch (dto.splitType) {
            case SplitType.equal:
                return calculateEqualSplit(
                    dto.amount,
                    dto.splits.map((split) => split.userId),
                );
            case SplitType.percentage: {
                if (!dto.percentages || dto.percentages.length === 0) {
                    throw new BadRequestException('percentages is required for a percentage split');
                }
                const total = dto.percentages.reduce((sum, entry) => sum + entry.percentage, 0);
                if (Math.abs(total - 100) > PERCENTAGE_SUM_TOLERANCE) {
                    throw new BadRequestException('percentages must sum to 100');
                }
                return calculatePercentageSplit(dto.amount, dto.percentages);
            }
            case SplitType.shares: {
                if (!dto.shares || dto.shares.length === 0) {
                    throw new BadRequestException('shares is required for a shares split');
                }
                return calculateSharesSplit(dto.amount, dto.shares);
            }
            default:
                throw new BadRequestException(`Unsupported split type: ${String(dto.splitType)}`);
        }
    }

    private async ensureGroupExists(groupId: string): Promise<void> {
        const group = await this.prisma.group.findUnique({ where: { id: groupId } });
        if (!group) {
            throw new NotFoundException(`Group ${groupId} not found`);
        }
    }

    private toResponse(expense: ExpenseWithSplits): ExpenseResponseDto {
        return {
            id: expense.id,
            groupId: expense.groupId,
            description: expense.description,
            amount: expense.amount.toNumber(),
            paidByUserId: expense.paidByUserId,
            splitType: expense.splitType,
            splits: expense.splits.map((split) => ({
                userId: split.userId,
                amount: split.amount.toNumber(),
            })),
            createdAt: expense.createdAt.toISOString(),
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
