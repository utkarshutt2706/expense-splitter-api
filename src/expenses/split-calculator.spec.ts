import {
    calculateEqualSplit,
    calculatePercentageSplit,
    calculateSharesSplit,
    distributeCentsByWeight,
    splitsReconcile,
    sumAmounts,
} from './split-calculator';

describe('distributeCentsByWeight', () => {
    it('divides evenly when there is no remainder', () => {
        expect(distributeCentsByWeight(300, [1, 1, 1])).toEqual([100, 100, 100]);
    });

    it('gives the leftover cents to the largest remainders first', () => {
        expect(distributeCentsByWeight(100, [1, 1, 1])).toEqual([34, 33, 33]);
    });

    it('distributes proportionally to unequal weights', () => {
        expect(distributeCentsByWeight(300, [1, 2])).toEqual([100, 200]);
    });

    it('throws when total weight is zero', () => {
        expect(() => distributeCentsByWeight(100, [0, 0])).toThrow(
            'Total weight must be greater than zero',
        );
    });
});

describe('calculateEqualSplit', () => {
    it('matches the seed data: 5200 split 5-way with no remainder', () => {
        const result = calculateEqualSplit(5200, ['a', 'b', 'c', 'd', 'e']);

        expect(result).toEqual([
            { userId: 'a', amount: 1040 },
            { userId: 'b', amount: 1040 },
            { userId: 'c', amount: 1040 },
            { userId: 'd', amount: 1040 },
            { userId: 'e', amount: 1040 },
        ]);
    });

    it('matches the seed data: 960 split 4-way with no remainder', () => {
        const result = calculateEqualSplit(960, ['a', 'b', 'c', 'd']);

        expect(result.every((split) => split.amount === 240)).toBe(true);
    });

    it('matches the seed data: 569 split 5-way with no remainder', () => {
        const result = calculateEqualSplit(569, ['a', 'b', 'c', 'd', 'e']);

        expect(result.every((split) => split.amount === 113.8)).toBe(true);
    });

    it('matches the seed data: 1647.45 split 5-way with no remainder', () => {
        const result = calculateEqualSplit(1647.45, ['a', 'b', 'c', 'd', 'e']);

        expect(result.every((split) => split.amount === 329.49)).toBe(true);
    });

    it('matches the seed data: 1293.68 split 3-way with largest-remainder rounding', () => {
        const result = calculateEqualSplit(1293.68, ['khem', 'abhinav', 'utkarsh']);

        expect(result).toEqual([
            { userId: 'khem', amount: 431.23 },
            { userId: 'abhinav', amount: 431.23 },
            { userId: 'utkarsh', amount: 431.22 },
        ]);
    });

    it('matches the seed data: 460 split 3-way with largest-remainder rounding', () => {
        const result = calculateEqualSplit(460, ['abhay', 'abhinav', 'utkarsh']);

        expect(result).toEqual([
            { userId: 'abhay', amount: 153.34 },
            { userId: 'abhinav', amount: 153.33 },
            { userId: 'utkarsh', amount: 153.33 },
        ]);
    });

    it('gives the full amount to a single participant', () => {
        expect(calculateEqualSplit(100, ['solo'])).toEqual([{ userId: 'solo', amount: 100 }]);
    });
});

describe('calculatePercentageSplit', () => {
    it('splits proportionally to given percentages', () => {
        const result = calculatePercentageSplit(1000, [
            { userId: 'a', percentage: 25 },
            { userId: 'b', percentage: 75 },
        ]);

        expect(result).toEqual([
            { userId: 'a', amount: 250 },
            { userId: 'b', amount: 750 },
        ]);
    });

    it('applies largest-remainder rounding for uneven percentages', () => {
        const result = calculatePercentageSplit(100, [
            { userId: 'a', percentage: 33.33 },
            { userId: 'b', percentage: 33.33 },
            { userId: 'c', percentage: 33.34 },
        ]);

        expect(sumAmounts(result)).toBe(100);
    });
});

describe('calculateSharesSplit', () => {
    it('splits proportionally to given share weights', () => {
        const result = calculateSharesSplit(300, [
            { userId: 'a', shares: 1 },
            { userId: 'b', shares: 2 },
        ]);

        expect(result).toEqual([
            { userId: 'a', amount: 100 },
            { userId: 'b', amount: 200 },
        ]);
    });

    it('applies largest-remainder rounding when shares do not divide evenly', () => {
        const result = calculateSharesSplit(100, [
            { userId: 'a', shares: 1 },
            { userId: 'b', shares: 1 },
            { userId: 'c', shares: 1 },
        ]);

        expect(sumAmounts(result)).toBe(100);
    });
});

describe('splitsReconcile', () => {
    it('returns true for identical splits', () => {
        const splits = [
            { userId: 'a', amount: 50 },
            { userId: 'b', amount: 50 },
        ];

        expect(splitsReconcile(splits, splits, 0)).toBe(true);
    });

    it('returns true when within tolerance', () => {
        const submitted = [{ userId: 'a', amount: 50.01 }];
        const computed = [{ userId: 'a', amount: 50.0 }];

        expect(splitsReconcile(submitted, computed, 1)).toBe(true);
    });

    it('returns false when outside tolerance', () => {
        const submitted = [{ userId: 'a', amount: 50.5 }];
        const computed = [{ userId: 'a', amount: 50.0 }];

        expect(splitsReconcile(submitted, computed, 1)).toBe(false);
    });

    it('returns false when the participant sets differ in length', () => {
        const submitted = [
            { userId: 'a', amount: 50 },
            { userId: 'b', amount: 50 },
        ];
        const computed = [{ userId: 'a', amount: 100 }];

        expect(splitsReconcile(submitted, computed, 0)).toBe(false);
    });

    it('returns false when a submitted userId is missing from the computed set', () => {
        const submitted = [{ userId: 'a', amount: 100 }];
        const computed = [{ userId: 'b', amount: 100 }];

        expect(splitsReconcile(submitted, computed, 0)).toBe(false);
    });
});

describe('sumAmounts', () => {
    it('sums split amounts without float drift', () => {
        const splits = [
            { userId: 'a', amount: 0.1 },
            { userId: 'b', amount: 0.2 },
        ];

        expect(sumAmounts(splits)).toBe(0.3);
    });
});
