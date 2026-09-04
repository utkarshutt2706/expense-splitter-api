import { Prisma, User } from '@prisma/client';
import { calculateNetBalances, simplifyDebts } from '../balances/balance-calculator';
import { fromCents, toCents } from '../common/money';

export const friendBalanceGroupSelect = {
    id: true,
    name: true,
    members: { where: { leftAt: null }, select: { userId: true } },
    expenses: {
        select: {
            paidByUserId: true,
            splits: { select: { userId: true, amount: true } },
        },
    },
    payments: { select: { fromUserId: true, toUserId: true, amount: true } },
} satisfies Prisma.GroupSelect;

export type FriendBalanceGroup = Prisma.GroupGetPayload<{
    select: typeof friendBalanceGroupSelect;
}>;
export type FriendUser = Omit<User, 'passwordHash'>;
export type FriendSummary = FriendUser & {
    sharedGroupCount: number;
    netBalance: number;
    groupBalances: { groupId: string; groupName: string; balance: number }[];
};

export function buildFriendSummaries(
    userId: string,
    users: FriendUser[],
    memberships: { userId: string; groupId: string }[],
    groups: FriendBalanceGroup[],
): FriendSummary[] {
    const sharedGroupCount = memberships.reduce<Map<string, number>>((counts, membership) => {
        counts.set(membership.userId, (counts.get(membership.userId) ?? 0) + 1);
        return counts;
    }, new Map());
    const balancesByFriend = new Map<
        string,
        { groupId: string; groupName: string; balanceCents: number }[]
    >();

    function addBalance(friendId: string, group: FriendBalanceGroup, balanceCents: number) {
        const balances = balancesByFriend.get(friendId) ?? [];
        balances.push({ groupId: group.id, groupName: group.name, balanceCents });
        balancesByFriend.set(friendId, balances);
    }

    for (const group of groups) {
        const balances = calculateNetBalances(
            group.members.map(({ userId: memberId }) => memberId),
            group.expenses.map((expense) => ({
                paidByUserId: expense.paidByUserId,
                splits: expense.splits.map((split) => ({
                    userId: split.userId,
                    amount: split.amount.toNumber(),
                })),
            })),
            group.payments.map((payment) => ({
                fromUserId: payment.fromUserId,
                toUserId: payment.toUserId,
                amount: payment.amount.toNumber(),
            })),
        );
        for (const settlement of simplifyDebts(balances)) {
            if (settlement.toUserId === userId) {
                addBalance(settlement.fromUserId, group, toCents(settlement.amount));
            } else if (settlement.fromUserId === userId) {
                addBalance(settlement.toUserId, group, -toCents(settlement.amount));
            }
        }
    }

    return users.map((user) => {
        const groupBalances = balancesByFriend.get(user.id) ?? [];
        return {
            ...user,
            sharedGroupCount: sharedGroupCount.get(user.id) ?? 0,
            netBalance: fromCents(
                groupBalances.reduce((total, entry) => total + entry.balanceCents, 0),
            ),
            groupBalances: groupBalances.map(({ groupId, groupName, balanceCents }) => ({
                groupId,
                groupName,
                balance: fromCents(balanceCents),
            })),
        };
    });
}
