import { fromCents, toCents } from './money';

describe('toCents', () => {
    it('converts a decimal amount to integer cents', () => {
        expect(toCents(10.5)).toBe(1050);
    });

    it('rounds to the nearest cent to guard against float drift', () => {
        expect(toCents(0.1 + 0.2)).toBe(30);
    });
});

describe('fromCents', () => {
    it('converts integer cents back to a decimal amount', () => {
        expect(fromCents(1050)).toBe(10.5);
    });

    it('rounds fractional cents before converting', () => {
        expect(fromCents(1050.4)).toBe(10.5);
    });
});

describe('signed monetary boundaries', () => {
    it.each([0, 0.01, -0.01, 123.45, -123.45, 9999999999.99])(
        'round trips %p within the persisted decimal range',
        (amount) => {
            expect(fromCents(toCents(amount))).toBe(amount);
        },
    );
});
