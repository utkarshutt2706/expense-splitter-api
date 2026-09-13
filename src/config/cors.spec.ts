import { isOriginAllowed, parseAllowedOrigins } from './cors';

describe('parseAllowedOrigins', () => {
    it('splits a comma-separated list', () => {
        expect(parseAllowedOrigins('https://a.example.com,https://b.example.com')).toEqual([
            'https://a.example.com',
            'https://b.example.com',
        ]);
    });

    it('trims whitespace around each origin', () => {
        expect(parseAllowedOrigins(' https://a.example.com , https://b.example.com ')).toEqual([
            'https://a.example.com',
            'https://b.example.com',
        ]);
    });

    it('drops empty entries', () => {
        expect(parseAllowedOrigins('https://a.example.com,,')).toEqual(['https://a.example.com']);
    });
});

describe('isOriginAllowed', () => {
    const allowedOrigins = ['https://utkarshutt2706.github.io'];

    it('allows a request with no origin (non-browser clients)', () => {
        expect(isOriginAllowed(undefined, allowedOrigins)).toBe(true);
    });

    it('allows an origin present in the allow-list', () => {
        expect(isOriginAllowed('https://utkarshutt2706.github.io', allowedOrigins)).toBe(true);
    });

    it('allows any localhost port over http', () => {
        expect(isOriginAllowed('http://localhost:5173', allowedOrigins)).toBe(true);
        expect(isOriginAllowed('http://localhost', allowedOrigins)).toBe(true);
    });

    it('rejects an origin not in the allow-list', () => {
        expect(isOriginAllowed('https://evil.example.com', allowedOrigins)).toBe(false);
    });

    it('rejects https localhost, since only http is allowed', () => {
        expect(isOriginAllowed('https://localhost:5173', allowedOrigins)).toBe(false);
    });
});

describe('origin security boundaries', () => {
    it.each([
        'http://localhost.evil.com',
        'http://localhost:80/path',
        'null',
        'https://allowed.example.com.evil.com',
        'http://127.0.0.1:3000',
    ])('rejects lookalike origin %s', (origin) => {
        expect(isOriginAllowed(origin, ['https://allowed.example.com'])).toBe(false);
    });
    it('handles an empty allowlist configuration', () => {
        expect(parseAllowedOrigins(' , , ')).toEqual([]);
        expect(isOriginAllowed('https://client.example.com', [])).toBe(false);
    });
});
