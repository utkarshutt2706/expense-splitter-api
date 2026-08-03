import { fromCents, toCents } from '../common/money';

export interface NetBalance {
    userId: string;
    balance: number;
}

export interface SettlementTransaction {
    fromUserId: string;
    toUserId: string;
    amount: number;
}

interface ExpenseInput {
    paidByUserId: string;
    splits: { userId: string; amount: number }[];
}

interface PaymentInput {
    fromUserId: string;
    toUserId: string;
    amount: number;
}

export function calculateNetBalances(
    memberIds: string[],
    expenses: ExpenseInput[],
    payments: PaymentInput[],
): NetBalance[] {
    const centsByUser = new Map<string, number>(memberIds.map((userId) => [userId, 0]));

    const add = (userId: string, cents: number): void => {
        centsByUser.set(userId, (centsByUser.get(userId) ?? 0) + cents);
    };

    for (const expense of expenses) {
        for (const split of expense.splits) {
            if (split.userId === expense.paidByUserId) {
                continue;
            }
            add(expense.paidByUserId, toCents(split.amount));
            add(split.userId, -toCents(split.amount));
        }
    }

    for (const payment of payments) {
        add(payment.fromUserId, toCents(payment.amount));
        add(payment.toUserId, -toCents(payment.amount));
    }

    return memberIds.map((userId) => ({
        userId,
        balance: fromCents(centsByUser.get(userId) ?? 0),
    }));
}

export function simplifyDebts(balances: NetBalance[]): SettlementTransaction[] {
    const creditors = balances
        .filter((entry) => toCents(entry.balance) > 0)
        .map((entry) => ({ userId: entry.userId, cents: toCents(entry.balance) }))
        .sort((a, b) => b.cents - a.cents);

    const debtors = balances
        .filter((entry) => toCents(entry.balance) < 0)
        .map((entry) => ({ userId: entry.userId, cents: -toCents(entry.balance) }))
        .sort((a, b) => b.cents - a.cents);

    const transactions: SettlementTransaction[] = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        const settledCents = Math.min(debtor.cents, creditor.cents);

        transactions.push({
            fromUserId: debtor.userId,
            toUserId: creditor.userId,
            amount: fromCents(settledCents),
        });

        debtor.cents -= settledCents;
        creditor.cents -= settledCents;

        if (debtor.cents === 0) {
            i++;
        }
        if (creditor.cents === 0) {
            j++;
        }
    }

    return transactions;
}
