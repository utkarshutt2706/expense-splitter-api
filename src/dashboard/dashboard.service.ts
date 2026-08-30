import { BadRequestException, Injectable } from '@nestjs/common';
import { mapBalanceInputs } from '../balances/balance-input-mapper';
import { calculateNetBalances } from '../balances/balance-calculator';
import { fromCents, toCents } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) {}

    async getDashboard(userId: string, from?: string, to?: string): Promise<DashboardResponseDto> {
        const dateRange = this.dateRange(from, to);
        const groups = await this.prisma.group.findMany({
            where: { members: { some: { userId, leftAt: null } } },
            include: {
                members: {
                    where: { leftAt: null },
                    include: { user: { select: { id: true, name: true } } },
                },
                expenses: { where: dateRange, include: { splits: true } },
                payments: { where: dateRange },
            },
        });

        const groupSummaries = groups.map((group) => {
            let totalCents = 0;
            let paidCents = 0;
            let shareCents = 0;
            const shares = new Map(group.members.map(({ user }) => [user.id, 0]));
            const monthlySpend = new Map<
                string,
                { amount: number; actualPaid: number; currentUserShare: number }
            >();
            const dailySpend = new Map<
                string,
                { amount: number; actualPaid: number; currentUserShare: number }
            >();

            for (const expense of group.expenses) {
                const amount = toCents(expense.amount.toNumber());
                const month = expense.paidOn.toISOString().slice(0, 7);
                const date = expense.paidOn.toISOString().slice(0, 10);
                const monthly = monthlySpend.get(month) ?? {
                    amount: 0,
                    actualPaid: 0,
                    currentUserShare: 0,
                };
                const daily = dailySpend.get(date) ?? {
                    amount: 0,
                    actualPaid: 0,
                    currentUserShare: 0,
                };
                totalCents += amount;
                monthly.amount += amount;
                daily.amount += amount;
                if (expense.paidByUserId === userId) {
                    paidCents += amount;
                    monthly.actualPaid += amount;
                    daily.actualPaid += amount;
                }
                for (const split of expense.splits) {
                    const splitCents = toCents(split.amount.toNumber());
                    shares.set(split.userId, (shares.get(split.userId) ?? 0) + splitCents);
                    if (split.userId === userId) {
                        shareCents += splitCents;
                        monthly.currentUserShare += splitCents;
                        daily.currentUserShare += splitCents;
                    }
                }
                monthlySpend.set(month, monthly);
                dailySpend.set(date, daily);
            }

            const balanceInputs = mapBalanceInputs(group.expenses, group.payments);
            const balances = calculateNetBalances(
                group.members.map(({ userId: memberId }) => memberId),
                balanceInputs.expenses,
                balanceInputs.payments,
            );

            return {
                groupId: group.id,
                name: group.name,
                amount: fromCents(totalCents),
                actualPaid: fromCents(paidCents),
                currentUserShare: fromCents(shareCents),
                currentBalance: balances.find((entry) => entry.userId === userId)?.balance ?? 0,
                memberShares: group.members
                    .map(({ user }) => ({
                        userId: user.id,
                        name: user.name,
                        amount: fromCents(shares.get(user.id) ?? 0),
                        isCurrentUser: user.id === userId,
                    }))
                    .sort(
                        (left, right) =>
                            right.amount - left.amount || left.name.localeCompare(right.name),
                    ),
                spendingByMonth: [...monthlySpend.entries()]
                    .map(([month, monthly]) => ({
                        month,
                        amount: fromCents(monthly.amount),
                        actualPaid: fromCents(monthly.actualPaid),
                        currentUserShare: fromCents(monthly.currentUserShare),
                    }))
                    .sort((left, right) => left.month.localeCompare(right.month)),
                spendingByDay: [...dailySpend.entries()]
                    .map(([date, daily]) => ({
                        date,
                        amount: fromCents(daily.amount),
                        actualPaid: fromCents(daily.actualPaid),
                        currentUserShare: fromCents(daily.currentUserShare),
                    }))
                    .sort((left, right) => left.date.localeCompare(right.date)),
            };
        });

        groupSummaries.sort(
            (left, right) => right.amount - left.amount || left.name.localeCompare(right.name),
        );
        return {
            actualPaid: fromCents(
                groupSummaries.reduce((sum, group) => sum + toCents(group.actualPaid), 0),
            ),
            currentUserShare: fromCents(
                groupSummaries.reduce((sum, group) => sum + toCents(group.currentUserShare), 0),
            ),
            groupSpend: groupSummaries,
        };
    }

    private dateRange(from?: string, to?: string): { paidOn?: { gte: Date; lt: Date } } {
        if (!from && !to) return {};
        if (!from || !to) throw new BadRequestException('Both from and to are required');

        const start = new Date(from);
        const end = new Date(to);
        if (start >= end) throw new BadRequestException('from must be before to');

        const maximumEnd = new Date(start);
        maximumEnd.setUTCFullYear(maximumEnd.getUTCFullYear() + 1);
        if (end > maximumEnd) {
            throw new BadRequestException('Dashboard date range cannot exceed one year');
        }
        return { paidOn: { gte: start, lt: end } };
    }
}
