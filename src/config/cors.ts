const LOCALHOST_ORIGIN_PATTERN = /^http:\/\/localhost(:\d+)?$/;

export function parseAllowedOrigins(commaSeparated: string): string[] {
    return commaSeparated
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
}

export function isOriginAllowed(
    origin: string | undefined,
    allowedOrigins: readonly string[],
): boolean {
    if (!origin) {
        return true;
    }

    return allowedOrigins.includes(origin) || LOCALHOST_ORIGIN_PATTERN.test(origin);
}
