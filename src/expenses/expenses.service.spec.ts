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
        expense: {
            create: jest.Mock;
            findMany: jest.Mock;
            findFirst: jest.Mock;
            update: jest.Mock;
            delete: jest.Mock;
        };
        expenseSplit: { deleteMany: jest.Mock };
        $transaction: jest.Mock;
    };

    const group = { id: 'group-1', name: 'Daaru Party', createdAt: new Date() };

    beforeEach(() => {
        prisma = {
            group: { findUnique: jest.fn() },
            expense: {
                create: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            },
            expenseSplit: { deleteMany: jest.fn() },
            $transaction: jest.fn(),
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

    describe('findOne', () => {
        it('returns the expense when found in the group', async () => {
            const dto: CreateExpenseDto = {
                description: 'Daaru',
                amount: 100,
                paidByUserId: 'user-1',
                splitType: SplitType.equal,
                splits: [{ userId: 'user-1', amount: 100 }],
            };
            prisma.expense.findFirst.mockResolvedValue(persistedExpense(dto));

            const result = await service.findOne('group-1', 'expense-1');

            expect(result.id).toBe('expense-1');
            expect(prisma.expense.findFirst).toHaveBeenCalledWith({
                where: { id: 'expense-1', groupId: 'group-1' },
                include: { splits: true },
            });
        });

        it('throws NotFoundException when not found in the group', async () => {
            prisma.expense.findFirst.mockResolvedValue(null);

            await expect(service.findOne('group-1', 'missing')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('update', () => {
        const existingDto: CreateExpenseDto = {
            description: 'Daaru',
            amount: 100,
            paidByUserId: 'user-1',
            splitType: SplitType.equal,
            splits: [{ userId: 'user-1', amount: 100 }],
        };

        beforeEach(() => {
            prisma.expense.findFirst.mockResolvedValue(persistedExpense(existingDto));
            prisma.$transaction.mockResolvedValue(undefined);
        });

        it('throws NotFoundException when the expense does not exist in the group', async () => {
            prisma.expense.findFirst.mockResolvedValue(null);

            await expect(
                service.update('group-1', 'missing', existingDto),
            ).rejects.toThrow(NotFoundException);
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });

        it('rejects an updated split that does not reconcile', async () => {
            const badDto: CreateExpenseDto = {
                ...existingDto,
                splits: [{ userId: 'user-1', amount: 50 }],
            };

            await expect(service.update('group-1', 'expense-1', badDto)).rejects.toThrow(
                BadRequestException,
            );
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });

        it('replaces the splits and updates the expense atomically', async () => {
            const newDto: CreateExpenseDto = {
                description: 'Daaru (updated)',
                amount: 200,
                paidByUserId: 'user-2',
                splitType: SplitType.equal,
                splits: [
                    { userId: 'a', amount: 100 },
                    { userId: 'b', amount: 100 },
                ],
            };

            await service.update('group-1', 'expense-1', newDto);

            expect(prisma.expenseSplit.deleteMany).toHaveBeenCalledWith({
                where: { expenseId: 'expense-1' },
            });
            expect(prisma.expense.update).toHaveBeenCalledWith({
                where: { id: 'expense-1' },
                data: {
                    description: 'Daaru (updated)',
                    amount: 200,
                    paidByUserId: 'user-2',
                    splitType: SplitType.equal,
                    splits: {
                        create: [
                            { userId: 'a', amount: 100 },
                            { userId: 'b', amount: 100 },
                        ],
                    },
                },
            });
            expect(prisma.$transaction).toHaveBeenCalled();
        });

        it('maps a foreign key violation on persist to BadRequestException', async () => {
            prisma.$transaction.mockRejectedValue(knownRequestError('P2003'));

            await expect(
                service.update('group-1', 'expense-1', existingDto),
            ).rejects.toThrow(BadRequestException);
        });

        it('maps a not-found race condition to NotFoundException', async () => {
            prisma.$transaction.mockRejectedValue(knownRequestError('P2025'));

            await expect(
                service.update('group-1', 'expense-1', existingDto),
            ).rejects.toThrow(NotFoundException);
        });

        it('rethrows unrecognized persist errors unchanged', async () => {
            prisma.$transaction.mockRejectedValue(new Error('boom'));

            await expect(service.update('group-1', 'expense-1', existingDto)).rejects.toThrow(
                'boom',
            );
        });
    });

    describe('remove', () => {
        const existingDto: CreateExpenseDto = {
            description: 'Daaru',
            amount: 100,
            paidByUserId: 'user-1',
            splitType: SplitType.equal,
            splits: [{ userId: 'user-1', amount: 100 }],
        };

        beforeEach(() => {
            prisma.expense.findFirst.mockResolvedValue(persistedExpense(existingDto));
        });

        it('throws NotFoundException when the expense does not exist in the group', async () => {
            prisma.expense.findFirst.mockResolvedValue(null);

            await expect(service.remove('group-1', 'missing')).rejects.toThrow(
                NotFoundException,
            );
            expect(prisma.expense.delete).not.toHaveBeenCalled();
        });

        it('deletes the expense', async () => {
            prisma.expense.delete.mockResolvedValue(undefined);

            await service.remove('group-1', 'expense-1');

            expect(prisma.expense.delete).toHaveBeenCalledWith({ where: { id: 'expense-1' } });
        });

        it('maps a not-found race condition to NotFoundException', async () => {
            prisma.expense.delete.mockRejectedValue(knownRequestError('P2025'));

            await expect(service.remove('group-1', 'expense-1')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('rethrows unrecognized delete errors unchanged', async () => {
            prisma.expense.delete.mockRejectedValue(new Error('boom'));

            await expect(service.remove('group-1', 'expense-1')).rejects.toThrow('boom');
        });
    });
});
