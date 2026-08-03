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
});
