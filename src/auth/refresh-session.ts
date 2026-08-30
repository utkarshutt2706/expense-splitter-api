import { createHash, randomBytes } from 'node:crypto';

export const REFRESH_COOKIE_NAME = 'expense_splitter_refresh';
export const REFRESH_SESSION_TTL_MS = 7 * 24 * 60 * 60_000;
export const SESSION_REQUEST_HEADER = 'x-session-request';
export const SESSION_REQUEST_HEADER_VALUE = 'ExpenseSplitter';

export function createRefreshToken(): string {
    return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
    if (!cookieHeader) return undefined;

    for (const cookie of cookieHeader.split(';')) {
        const separator = cookie.indexOf('=');
        if (separator === -1) continue;
        if (cookie.slice(0, separator).trim() !== name) continue;
        return decodeURIComponent(cookie.slice(separator + 1).trim());
    }

    return undefined;
}
