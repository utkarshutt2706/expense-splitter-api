import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { mapBalanceInputs } from './balance-input-mapper';
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
        const balanceInputs = mapBalanceInputs(expenses, payments);
        const balances = calculateNetBalances(
            memberIds,
            balanceInputs.expenses,
            balanceInputs.payments,
        );

        return { balances, settlements: simplifyDebts(balances) };
    }
}
