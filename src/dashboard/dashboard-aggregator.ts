import { Prisma } from '@prisma/client';
import { mapBalanceInputs } from '../balances/balance-input-mapper';
import { calculateNetBalances } from '../balances/balance-calculator';
import { fromCents, toCents } from '../common/money';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

export const dashboardGroupInclude = {
    members: { include: { user: { select: { id: true, name: true } } } },
    expenses: { include: { splits: true } },
    payments: true,
} satisfies Prisma.GroupInclude;
export type DashboardGroup = Prisma.GroupGetPayload<{ include: typeof dashboardGroupInclude }>;
type Bucket = { amount: number; actualPaid: number; currentUserShare: number };
const emptyBucket = (): Bucket => ({ amount: 0, actualPaid: 0, currentUserShare: 0 });
const mapBucket = (value: Bucket): Bucket => ({
    amount: fromCents(value.amount),
    actualPaid: fromCents(value.actualPaid),
    currentUserShare: fromCents(value.currentUserShare),
});

export function aggregateDashboard(groups: DashboardGroup[], userId: string): DashboardResponseDto {
    const groupSpend = groups.map((group) => {
        let total = 0,
            paid = 0,
            share = 0;
        const shares = new Map(group.members.map(({ user }) => [user.id, 0]));
        const months = new Map<string, Bucket>();
        const days = new Map<string, Bucket>();
        for (const expense of group.expenses) {
            const amount = toCents(expense.amount.toNumber());
            const monthKey = expense.paidOn.toISOString().slice(0, 7);
            const dayKey = expense.paidOn.toISOString().slice(0, 10);
            const month = months.get(monthKey) ?? emptyBucket();
            const day = days.get(dayKey) ?? emptyBucket();
            total += amount;
            month.amount += amount;
            day.amount += amount;
            if (expense.paidByUserId === userId) {
                paid += amount;
                month.actualPaid += amount;
                day.actualPaid += amount;
            }
            for (const split of expense.splits) {
                const cents = toCents(split.amount.toNumber());
                shares.set(split.userId, (shares.get(split.userId) ?? 0) + cents);
                if (split.userId === userId) {
                    share += cents;
                    month.currentUserShare += cents;
                    day.currentUserShare += cents;
                }
            }
            months.set(monthKey, month);
            days.set(dayKey, day);
        }
        const input = mapBalanceInputs(group.expenses, group.payments);
        const balances = calculateNetBalances(
            group.members.map(({ userId: id }) => id),
            input.expenses,
            input.payments,
        );
        return {
            groupId: group.id,
            name: group.name,
            amount: fromCents(total),
            actualPaid: fromCents(paid),
            currentUserShare: fromCents(share),
            currentBalance: balances.find(({ userId: id }) => id === userId)?.balance ?? 0,
            memberShares: group.members
                .map(({ user }) => ({
                    userId: user.id,
                    name: user.name,
                    amount: fromCents(shares.get(user.id) ?? 0),
                    isCurrentUser: user.id === userId,
                }))
                .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)),
            spendingByMonth: [...months]
                .map(([month, value]) => ({ month, ...mapBucket(value) }))
                .sort((a, b) => a.month.localeCompare(b.month)),
            spendingByDay: [...days]
                .map(([date, value]) => ({ date, ...mapBucket(value) }))
                .sort((a, b) => a.date.localeCompare(b.date)),
        };
    });
    groupSpend.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
    return {
        actualPaid: fromCents(
            groupSpend.reduce((sum, group) => sum + toCents(group.actualPaid), 0),
        ),
        currentUserShare: fromCents(
            groupSpend.reduce((sum, group) => sum + toCents(group.currentUserShare), 0),
        ),
        groupSpend,
    };
}
