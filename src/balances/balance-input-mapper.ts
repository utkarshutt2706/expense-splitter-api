import type { BalanceExpenseInput, BalancePaymentInput } from './balance-calculator';

interface DecimalAmount {
    toNumber(): number;
}

interface ExpenseRecord {
    paidByUserId: string;
    splits: { userId: string; amount: DecimalAmount }[];
}

interface PaymentRecord {
    fromUserId: string;
    toUserId: string;
    amount: DecimalAmount;
}

interface BalanceInputs {
    expenses: BalanceExpenseInput[];
    payments: BalancePaymentInput[];
}

export function mapBalanceInputs(
    expenses: ExpenseRecord[],
    payments: PaymentRecord[],
): BalanceInputs {
    return {
        expenses: expenses.map((expense) => ({
            paidByUserId: expense.paidByUserId,
            splits: expense.splits.map((split) => ({
                userId: split.userId,
                amount: split.amount.toNumber(),
            })),
        })),
        payments: payments.map((payment) => ({
            fromUserId: payment.fromUserId,
            toUserId: payment.toUserId,
            amount: payment.amount.toNumber(),
        })),
    };
}
