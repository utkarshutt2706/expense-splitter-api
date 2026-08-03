import { createHash, randomBytes } from 'crypto';

export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString('hex');
    return { rawToken, tokenHash: hashInvitationToken(rawToken) };
}

export function hashInvitationToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
}
