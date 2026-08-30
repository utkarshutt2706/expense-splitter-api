export const AUTH_RATE_LIMITS = {
    login: {
        limit: 10,
        ttl: 60_000,
        blockDuration: 5 * 60_000,
    },
    register: {
        limit: 5,
        ttl: 60 * 60_000,
        blockDuration: 60 * 60_000,
    },
} as const;
