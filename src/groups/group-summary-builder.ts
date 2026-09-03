import { Prisma } from '@prisma/client';
import { mapBalanceInputs } from '../balances/balance-input-mapper';
import { calculateNetBalances } from '../balances/balance-calculator';
import { GroupSummaryResponseDto } from './dto/group-summary-response.dto';

export const groupSummaryInclude = {
    members: { where: { leftAt: null } },
    expenses: {
        select: {
            paidByUserId: true,
            createdAt: true,
            splits: { select: { userId: true, amount: true } },
        },
    },
    payments: {
        select: { fromUserId: true, toUserId: true, amount: true, createdAt: true },
    },
} satisfies Prisma.GroupInclude;

type SummaryGroup = Prisma.GroupGetPayload<{ include: typeof groupSummaryInclude }>;

export function buildGroupSummaries(
    groups: SummaryGroup[],
    currentUserId: string,
): GroupSummaryResponseDto[] {
    return groups.map((group) => {
        const memberIds = group.members.map(({ userId }) => userId);
        const inputs = mapBalanceInputs(group.expenses, group.payments);
        const balances = calculateNetBalances(memberIds, inputs.expenses, inputs.payments);
        const activityDates = [
            ...group.expenses.map(({ createdAt }) => createdAt),
            ...group.payments.map(({ createdAt }) => createdAt),
        ];
        const lastActivityAt = activityDates.reduce<Date | null>(
            (latest, date) => (!latest || date > latest ? date : latest),
            null,
        );
        return {
            id: group.id,
            name: group.name,
            memberIds,
            memberCount: memberIds.length,
            currentUserBalance:
                balances.find(({ userId }) => userId === currentUserId)?.balance ?? 0,
            hasFinancialActivity: activityDates.length > 0,
            lastActivityAt: lastActivityAt?.toISOString() ?? null,
            createdAt: group.createdAt.toISOString(),
        };
    });
}
