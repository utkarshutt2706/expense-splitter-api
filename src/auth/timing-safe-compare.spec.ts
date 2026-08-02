import { timingSafeCompare } from './timing-safe-compare';

describe('timingSafeCompare', () => {
    it('returns true for identical strings', () => {
        expect(timingSafeCompare('same-value', 'same-value')).toBe(true);
    });

    it('returns false for different strings of the same length', () => {
        expect(timingSafeCompare('value-one', 'value-two')).toBe(false);
    });

    it('returns false for strings of different lengths', () => {
        expect(timingSafeCompare('short', 'a-much-longer-value')).toBe(false);
    });
});
