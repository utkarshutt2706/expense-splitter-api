import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateNetBalances, simplifyDebts } from './balance-calculator';
import { GroupBalancesResponseDto } from './dto/group-balances-response.dto';

@Injectable()
export class BalancesService {
    constructor(private readonly prisma: PrismaService) {}

    async getGroupBalances(
        groupId: string,
        client: Prisma.TransactionClient | PrismaService = this.prisma,
    ): Promise<GroupBalancesResponseDto> {
        const group = await client.group.findUnique({
            where: { id: groupId },
            include: { members: true },
        });
        if (!group) {
            throw new NotFoundException(`Group ${groupId} not found`);
        }

        const [expenses, payments] = await Promise.all([
            client.expense.findMany({
                where: { groupId },
                include: { splits: true },
            }),
            client.payment.findMany({ where: { groupId } }),
        ]);

        const memberIds = group.members.map((member) => member.userId);
        const balances = calculateNetBalances(
            memberIds,
            expenses.map((expense) => ({
                paidByUserId: expense.paidByUserId,
                splits: expense.splits.map((split) => ({
                    userId: split.userId,
                    amount: split.amount.toNumber(),
                })),
            })),
            payments.map((payment) => ({
                fromUserId: payment.fromUserId,
                toUserId: payment.toUserId,
                amount: payment.amount.toNumber(),
            })),
        );

        return { balances, settlements: simplifyDebts(balances) };
    }
}
