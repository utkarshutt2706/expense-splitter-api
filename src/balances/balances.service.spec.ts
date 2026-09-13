import { NotFoundException } from '@nestjs/common';
import { Prisma, SplitType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BalancesService } from './balances.service';

function dec(value: number): Prisma.Decimal {
    return new Prisma.Decimal(value);
}

describe('BalancesService', () => {
    let service: BalancesService;
    let prisma: {
        group: { findUnique: jest.Mock };
        expense: { findMany: jest.Mock };
        payment: { findMany: jest.Mock };
    };

    beforeEach(() => {
        prisma = {
            group: { findUnique: jest.fn() },
            expense: { findMany: jest.fn() },
            payment: { findMany: jest.fn() },
        };
        service = new BalancesService(prisma as unknown as PrismaService);
    });

    it('throws NotFoundException when the group does not exist', async () => {
        prisma.group.findUnique.mockResolvedValue(null);

        await expect(service.getGroupBalances('missing')).rejects.toThrow(NotFoundException);
    });

    it('computes net balances and settlements from expenses and payments', async () => {
        prisma.group.findUnique.mockResolvedValue({
            id: 'group-1',
            members: [{ userId: 'a' }, { userId: 'b' }],
        });
        prisma.expense.findMany.mockResolvedValue([
            {
                id: 'expense-1',
                groupId: 'group-1',
                description: 'Daaru',
                amount: dec(100),
                paidByUserId: 'a',
                splitType: SplitType.equal,
                createdAt: new Date(),
                splits: [
                    { userId: 'a', amount: dec(50) },
                    { userId: 'b', amount: dec(50) },
                ],
            },
        ]);
        prisma.payment.findMany.mockResolvedValue([]);

        const result = await service.getGroupBalances('group-1');

        expect(result.balances).toEqual(
            expect.arrayContaining([
                { userId: 'a', balance: 50 },
                { userId: 'b', balance: -50 },
            ]),
        );
        expect(result.settlements).toEqual([{ fromUserId: 'b', toUserId: 'a', amount: 50 }]);
    });

    it('returns zero balances and no settlements for a group with no activity', async () => {
        prisma.group.findUnique.mockResolvedValue({
            id: 'group-1',
            members: [{ userId: 'a' }, { userId: 'b' }],
        });
        prisma.expense.findMany.mockResolvedValue([]);
        prisma.payment.findMany.mockResolvedValue([]);

        const result = await service.getGroupBalances('group-1');

        expect(result.balances).toEqual(
            expect.arrayContaining([
                { userId: 'a', balance: 0 },
                { userId: 'b', balance: 0 },
            ]),
        );
        expect(result.settlements).toEqual([]);
    });

    it('uses the supplied transaction for all reads and nets actual payment amounts', async () => {
        const tx = {
            group: {
                findUnique: jest
                    .fn()
                    .mockResolvedValue({ members: [{ userId: 'a' }, { userId: 'b' }] }),
            },
            expense: {
                findMany: jest
                    .fn()
                    .mockResolvedValue([
                        { paidByUserId: 'a', splits: [{ userId: 'b', amount: dec(10.25) }] },
                    ]),
            },
            payment: {
                findMany: jest
                    .fn()
                    .mockResolvedValue([{ fromUserId: 'b', toUserId: 'a', amount: dec(3.1) }]),
            },
        };
        await expect(
            service.getGroupBalances('g', tx as unknown as Prisma.TransactionClient),
        ).resolves.toEqual({
            balances: [
                { userId: 'a', balance: 7.15 },
                { userId: 'b', balance: -7.15 },
            ],
            settlements: [{ fromUserId: 'b', toUserId: 'a', amount: 7.15 }],
        });
        expect(tx.group.findUnique).toHaveBeenCalledWith({
            where: { id: 'g' },
            include: { members: true },
        });
        expect(tx.expense.findMany).toHaveBeenCalledWith({
            where: { groupId: 'g' },
            include: { splits: true },
        });
        expect(tx.payment.findMany).toHaveBeenCalledWith({ where: { groupId: 'g' } });
        expect(prisma.group.findUnique).not.toHaveBeenCalled();
        expect(prisma.expense.findMany).not.toHaveBeenCalled();
        expect(prisma.payment.findMany).not.toHaveBeenCalled();
    });
    it.each(['expense', 'payment'] as const)(
        'propagates %s read failures rather than returning partial balances',
        async (model) => {
            prisma.group.findUnique.mockResolvedValue({ members: [] });
            prisma.expense.findMany.mockResolvedValue([]);
            prisma.payment.findMany.mockResolvedValue([]);
            const error = new Error('read failed');
            prisma[model].findMany.mockRejectedValue(error);
            await expect(service.getGroupBalances('g')).rejects.toBe(error);
        },
    );
});
