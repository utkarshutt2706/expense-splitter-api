import { generateInvitationToken, hashInvitationToken } from './invitation-token';

describe('invitation-token', () => {
    it('generates a raw token whose hash matches tokenHash', () => {
        const { rawToken, tokenHash } = generateInvitationToken();

        expect(rawToken).toHaveLength(64);
        expect(hashInvitationToken(rawToken)).toBe(tokenHash);
    });

    it('generates a different token each time', () => {
        const first = generateInvitationToken();
        const second = generateInvitationToken();

        expect(first.rawToken).not.toBe(second.rawToken);
    });

    it('hashes the same input identically', () => {
        expect(hashInvitationToken('abc')).toBe(hashInvitationToken('abc'));
        expect(hashInvitationToken('abc')).not.toBe(hashInvitationToken('abd'));
    });
});
