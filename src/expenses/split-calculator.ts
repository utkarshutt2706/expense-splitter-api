import { fromCents, toCents } from '../common/money';

export interface Split {
    userId: string;
    amount: number;
}

export function distributeCentsByWeight(totalCents: number, weights: number[]): number[] {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight <= 0) {
        throw new Error('Total weight must be greater than zero');
    }

    const rawShares = weights.map((weight) => (totalCents * weight) / totalWeight);
    const floors = rawShares.map((share) => Math.floor(share));
    const flooredTotal = floors.reduce((sum, cents) => sum + cents, 0);
    const remainder = totalCents - flooredTotal;

    const byRemainingFraction = rawShares
        .map((share, index) => ({ index, fraction: share - floors[index] }))
        .sort((a, b) => b.fraction - a.fraction);

    const result = [...floors];
    for (let i = 0; i < remainder; i++) {
        result[byRemainingFraction[i].index] += 1;
    }
    return result;
}

export function calculateEqualSplit(amount: number, participantUserIds: string[]): Split[] {
    const cents = distributeCentsByWeight(
        toCents(amount),
        participantUserIds.map(() => 1),
    );
    return participantUserIds.map((userId, index) => ({
        userId,
        amount: fromCents(cents[index]),
    }));
}

export function calculatePercentageSplit(
    amount: number,
    percentages: { userId: string; percentage: number }[],
): Split[] {
    const cents = distributeCentsByWeight(
        toCents(amount),
        percentages.map((entry) => entry.percentage),
    );
    return percentages.map((entry, index) => ({
        userId: entry.userId,
        amount: fromCents(cents[index]),
    }));
}

export function calculateSharesSplit(
    amount: number,
    shares: { userId: string; shares: number }[],
): Split[] {
    const cents = distributeCentsByWeight(
        toCents(amount),
        shares.map((entry) => entry.shares),
    );
    return shares.map((entry, index) => ({
        userId: entry.userId,
        amount: fromCents(cents[index]),
    }));
}

export function splitsReconcile(
    submitted: Split[],
    computed: Split[],
    toleranceCents: number,
): boolean {
    if (submitted.length !== computed.length) {
        return false;
    }

    const computedByUserId = new Map(computed.map((split) => [split.userId, split.amount]));
    return submitted.every((split) => {
        const expected = computedByUserId.get(split.userId);
        if (expected === undefined) {
            return false;
        }
        return Math.abs(toCents(split.amount) - toCents(expected)) <= toleranceCents;
    });
}

export function sumAmounts(splits: Split[]): number {
    return splits.reduce((sum, split) => sum + toCents(split.amount), 0) / 100;
}
