import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, SplitType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpensesService } from './expenses.service';

function knownRequestError(code: string): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError('mock prisma error', {
        code,
        clientVersion: '7.9.1',
    });
}

function dec(value: number): Prisma.Decimal {
    return new Prisma.Decimal(value);
}

describe('ExpensesService', () => {
    let service: ExpensesService;
    let prisma: {
        group: { findUnique: jest.Mock };
        expense: { create: jest.Mock; findMany: jest.Mock };
    };

    const group = { id: 'group-1', name: 'Daaru Party', createdAt: new Date() };

    beforeEach(() => {
        prisma = {
            group: { findUnique: jest.fn() },
            expense: { create: jest.fn(), findMany: jest.fn() },
        };
        service = new ExpensesService(prisma as unknown as PrismaService);
        prisma.group.findUnique.mockResolvedValue(group);
    });

    function persistedExpense(dto: CreateExpenseDto, id = 'expense-1') {
        return {
            id,
            groupId: 'group-1',
            description: dto.description,
            amount: dec(dto.amount),
            paidByUserId: dto.paidByUserId,
            splitType: dto.splitType,
            createdAt: new Date('2026-07-23T10:00:00.000Z'),
            splits: dto.splits.map((split) => ({
                id: `split-${split.userId}`,
                expenseId: id,
                userId: split.userId,
                amount: dec(split.amount),
            })),
        };
    }

    describe('create', () => {
        it('throws NotFoundException when the group does not exist', async () => {
            prisma.group.findUnique.mockResolvedValue(null);

            const dto: CreateExpenseDto = {
                description: 'Daaru',
                amount: 100,
                paidByUserId: 'user-1',
                splitType: SplitType.equal,
                splits: [{ userId: 'user-1', amount: 100 }],
            };

            await expect(service.create('missing', dto)).rejects.toThrow(NotFoundException);
        });

        it('persists an equal split that reconciles', async () => {
            const dto: CreateExpenseDto = {
                description: 'Daaru',
                amount: 5200,
                paidByUserId: 'friend-divanshu',
                splitType: SplitType.equal,
                splits: ['a', 'b', 'c', 'd', 'e'].map((userId) => ({ userId, amount: 1040 })),
            };
            prisma.expense.create.mockResolvedValue(persistedExpense(dto));

            const result = await service.create('group-1', dto);

            expect(result.amount).toBe(5200);
            expect(result.splits).toHaveLength(5);
            expect(result.splits[0]).toEqual({ userId: 'a', amount: 1040 });
        });

        it('rejects an equal split that does not reconcile', async () => {
            const dto: CreateExpenseDto = {
                description: 'Daaru',
                amount: 100,
                paidByUserId: 'user-1',
                splitType: SplitType.equal,
                splits: [
                    { userId: 'a', amount: 60 },
                    { userId: 'b', amount: 40 },
                ],
            };

            await expect(service.create('group-1', dto)).rejects.toThrow(BadRequestException);
            expect(prisma.expense.create).not.toHaveBeenCalled();
        });

        it('persists an exact split whose amounts sum to the total', async () => {
            const dto: CreateExpenseDto = {
                description: 'Chakna',
                amount: 100,
                paidByUserId: 'user-1',
                splitType: SplitType.exact,
                splits: [
                    { userId: 'a', amount: 70 },
                    { userId: 'b', amount: 30 },
                ],
            };
            prisma.expense.create.mockResolvedValue(persistedExpense(dto));

            const result = await service.create('group-1', dto);

            expect(result.splitType).toBe(SplitType.exact);
        });

        it('rejects an exact split whose amounts do not sum to the total', async () => {
            const dto: CreateExpenseDto = {
                description: 'Chakna',
                amount: 100,
                paidByUserId: 'user-1',
                splitType: SplitType.exact,
                splits: [
                    { userId: 'a', amount: 70 },
                    { userId: 'b', amount: 20 },
                ],
            };

            await expect(service.create('group-1', dto)).rejects.toThrow(BadRequestException);
        });

        it('persists a percentage split that reconciles', async () => {
            const dto: CreateExpenseDto = {
                description: 'Pizza',
                amount: 1000,
                paidByUserId: 'user-1',
                splitType: SplitType.percentage,
                splits: [
                    { userId: 'a', amount: 250 },
                    { userId: 'b', amount: 750 },
                ],
                percentages: [
                    { userId: 'a', percentage: 25 },
                    { userId: 'b', percentage: 75 },
                ],
            };
            prisma.expense.create.mockResolvedValue(persistedExpense(dto));

            const result = await service.create('group-1', dto);

            expect(result.splitType).toBe(SplitType.percentage);
        });

        it('rejects a percentage split with no percentages provided', async () => {
            const dto: CreateExpenseDto = {
                description: 'Pizza',
                amount: 1000,
                paidByUserId: 'user-1',
                splitType: SplitType.percentage,
                splits: [{ userId: 'a', amount: 1000 }],
            };

            await expect(service.create('group-1', dto)).rejects.toThrow(
                'percentages is required for a percentage split',
            );
        });

        it('rejects a percentage split whose percentages do not sum to 100', async () => {
            const dto: CreateExpenseDto = {
                description: 'Pizza',
                amount: 1000,
                paidByUserId: 'user-1',
                splitType: SplitType.percentage,
                splits: [
                    { userId: 'a', amount: 250 },
                    { userId: 'b', amount: 250 },
                ],
                percentages: [
                    { userId: 'a', percentage: 25 },
                    { userId: 'b', percentage: 25 },
                ],
            };

            await expect(service.create('group-1', dto)).rejects.toThrow(
                'percentages must sum to 100',
            );
        });

        it('rejects a percentage split whose submitted amounts do not reconcile', async () => {
            const dto: CreateExpenseDto = {
                description: 'Pizza',
                amount: 1000,
                paidByUserId: 'user-1',
                splitType: SplitType.percentage,
                splits: [
                    { userId: 'a', amount: 500 },
                    { userId: 'b', amount: 500 },
                ],
                percentages: [
                    { userId: 'a', percentage: 25 },
                    { userId: 'b', percentage: 75 },
                ],
            };

            await expect(service.create('group-1', dto)).rejects.toThrow(BadRequestException);
        });

        it('persists a shares split that reconciles', async () => {
            const dto: CreateExpenseDto = {
                description: 'Sutta',
                amount: 300,
                paidByUserId: 'user-1',
                splitType: SplitType.shares,
                splits: [
                    { userId: 'a', amount: 100 },
                    { userId: 'b', amount: 200 },
                ],
                shares: [
                    { userId: 'a', shares: 1 },
                    { userId: 'b', shares: 2 },
                ],
            };
            prisma.expense.create.mockResolvedValue(persistedExpense(dto));

            const result = await service.create('group-1', dto);

            expect(result.splitType).toBe(SplitType.shares);
        });

        it('rejects a shares split with no shares provided', async () => {
            const dto: CreateExpenseDto = {
                description: 'Sutta',
                amount: 300,
                paidByUserId: 'user-1',
                splitType: SplitType.shares,
                splits: [{ userId: 'a', amount: 300 }],
            };

            await expect(service.create('group-1', dto)).rejects.toThrow(
                'shares is required for a shares split',
            );
        });

        it('rejects a shares split whose submitted amounts do not reconcile', async () => {
            const dto: CreateExpenseDto = {
                description: 'Sutta',
                amount: 300,
                paidByUserId: 'user-1',
                splitType: SplitType.shares,
                splits: [
                    { userId: 'a', amount: 150 },
                    { userId: 'b', amount: 150 },
                ],
                shares: [
                    { userId: 'a', shares: 1 },
                    { userId: 'b', shares: 2 },
                ],
            };

            await expect(service.create('group-1', dto)).rejects.toThrow(BadRequestException);
        });

        it('maps a foreign key violation on persist to BadRequestException', async () => {
            const dto: CreateExpenseDto = {
                description: 'Daaru',
                amount: 100,
                paidByUserId: 'missing-user',
                splitType: SplitType.equal,
                splits: [{ userId: 'missing-user', amount: 100 }],
            };
            prisma.expense.create.mockRejectedValue(knownRequestError('P2003'));

            await expect(service.create('group-1', dto)).rejects.toThrow(BadRequestException);
        });

        it('rethrows unrecognized persist errors unchanged', async () => {
            const dto: CreateExpenseDto = {
                description: 'Daaru',
                amount: 100,
                paidByUserId: 'user-1',
                splitType: SplitType.equal,
                splits: [{ userId: 'user-1', amount: 100 }],
            };
            prisma.expense.create.mockRejectedValue(new Error('boom'));

            await expect(service.create('group-1', dto)).rejects.toThrow('boom');
        });
    });

    describe('findAllByGroup', () => {
        it('throws NotFoundException when the group does not exist', async () => {
            prisma.group.findUnique.mockResolvedValue(null);

            await expect(service.findAllByGroup('missing')).rejects.toThrow(NotFoundException);
        });

        it('returns all expenses for the group mapped to the response shape', async () => {
            const dto: CreateExpenseDto = {
                description: 'Daaru',
                amount: 100,
                paidByUserId: 'user-1',
                splitType: SplitType.equal,
                splits: [{ userId: 'user-1', amount: 100 }],
            };
            prisma.expense.findMany.mockResolvedValue([persistedExpense(dto)]);

            const result = await service.findAllByGroup('group-1');

            expect(result).toHaveLength(1);
            expect(result[0].amount).toBe(100);
        });
    });
});
