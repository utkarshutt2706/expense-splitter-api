import {
    createRefreshToken,
    hashRefreshToken,
    readCookie,
    REFRESH_COOKIE_NAME,
} from './refresh-session';

describe('refresh session helpers', () => {
    it('creates high-entropy tokens and stores only deterministic hashes', () => {
        const first = createRefreshToken();
        const second = createRefreshToken();

        expect(first).not.toBe(second);
        expect(first.length).toBeGreaterThanOrEqual(40);
        expect(hashRefreshToken(first)).toHaveLength(64);
        expect(hashRefreshToken(first)).toBe(hashRefreshToken(first));
        expect(hashRefreshToken(first)).not.toContain(first);
    });

    it('reads the named cookie without depending on cookie order', () => {
        expect(
            readCookie(`theme=dark; ${REFRESH_COOKIE_NAME}=token%20value`, REFRESH_COOKIE_NAME),
        ).toBe('token value');
    });

    it('returns undefined for a missing cookie', () => {
        expect(readCookie('theme=dark', REFRESH_COOKIE_NAME)).toBeUndefined();
        expect(readCookie(undefined, REFRESH_COOKIE_NAME)).toBeUndefined();
    });

    it('matches a known SHA-256 digest', () => {
        expect(hashRefreshToken('abc')).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        );
        expect(hashRefreshToken('abd')).not.toBe(hashRefreshToken('abc'));
    });
    it.each([
        ['broken; token=value', 'value'],
        [' token = a=b== ', 'a=b=='],
        ['token=first; token=second', 'first'],
        ['token=', ''],
        ['other_token=wrong; token=right', 'right'],
        ['', undefined],
    ])('parses cookie syntax %s', (header, expected) => {
        expect(readCookie(header, 'token')).toBe(expected);
    });
});
