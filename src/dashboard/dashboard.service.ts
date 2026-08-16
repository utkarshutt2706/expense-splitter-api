import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) {}

    async getDashboard(userId: string): Promise<DashboardResponseDto> {
        const expenses = await this.prisma.expense.findMany({
            where: {
                group: {
                    members: { some: { userId, leftAt: null } },
                },
            },
            include: {
                group: { select: { id: true, name: true } },
                splits: {
                    include: {
                        user: { select: { id: true, name: true } },
                    },
                },
            },
        });

        let actualPaid = 0;
        let currentUserShare = 0;
        const memberShares = new Map<string, { name: string; amount: number }>();
        const groupSpend = new Map<
            string,
            {
                name: string;
                amount: number;
                actualPaid: number;
                currentUserShare: number;
                memberShares: Map<string, { name: string; amount: number }>;
            }
        >();

        for (const expense of expenses) {
            const expenseAmount = expense.amount.toNumber();
            if (expense.paidByUserId === userId) {
                actualPaid += expenseAmount;
            }

            const group = groupSpend.get(expense.group.id) ?? {
                name: expense.group.name,
                amount: 0,
                actualPaid: 0,
                currentUserShare: 0,
                memberShares: new Map<string, { name: string; amount: number }>(),
            };
            group.amount += expenseAmount;
            if (expense.paidByUserId === userId) {
                group.actualPaid += expenseAmount;
            }
            groupSpend.set(expense.group.id, group);

            for (const split of expense.splits) {
                const splitAmount = split.amount.toNumber();
                const member = memberShares.get(split.userId) ?? {
                    name: split.user.name,
                    amount: 0,
                };
                member.amount += splitAmount;
                memberShares.set(split.userId, member);

                const groupMember = group.memberShares.get(split.userId) ?? {
                    name: split.user.name,
                    amount: 0,
                };
                groupMember.amount += splitAmount;
                group.memberShares.set(split.userId, groupMember);
                if (split.userId === userId) {
                    currentUserShare += splitAmount;
                    group.currentUserShare += splitAmount;
                }
            }
        }

        return {
            actualPaid: this.roundMoney(actualPaid),
            currentUserShare: this.roundMoney(currentUserShare),
            memberShares: [...memberShares.entries()]
                .map(([memberUserId, member]) => ({
                    userId: memberUserId,
                    name: member.name,
                    amount: this.roundMoney(member.amount),
                    isCurrentUser: memberUserId === userId,
                }))
                .sort(
                    (left, right) =>
                        right.amount - left.amount || left.name.localeCompare(right.name),
                ),
            groupSpend: [...groupSpend.entries()]
                .map(([groupId, group]) => ({
                    groupId,
                    name: group.name,
                    amount: this.roundMoney(group.amount),
                    actualPaid: this.roundMoney(group.actualPaid),
                    currentUserShare: this.roundMoney(group.currentUserShare),
                    memberShares: this.toMemberShares(group.memberShares, userId),
                }))
                .sort(
                    (left, right) =>
                        right.amount - left.amount || left.name.localeCompare(right.name),
                ),
        };
    }

    private roundMoney(value: number): number {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }

    private toMemberShares(
        shares: Map<string, { name: string; amount: number }>,
        currentUserId: string,
    ) {
        return [...shares.entries()]
            .map(([userId, member]) => ({
                userId,
                name: member.name,
                amount: this.roundMoney(member.amount),
                isCurrentUser: userId === currentUserId,
            }))
            .sort(
                (left, right) => right.amount - left.amount || left.name.localeCompare(right.name),
            );
    }
}
