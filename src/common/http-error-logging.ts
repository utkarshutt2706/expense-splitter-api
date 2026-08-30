import { HttpStatus, Logger } from '@nestjs/common';

const WARNING_STATUSES = new Set<number>([
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.TOO_MANY_REQUESTS,
]);
const INTERNAL_SERVER_ERROR_STATUS = Number(HttpStatus.INTERNAL_SERVER_ERROR);

export function logHttpFailure(
    logger: Pick<Logger, 'error' | 'warn'>,
    status: number,
    message: string,
    stack?: string,
): boolean {
    if (status >= INTERNAL_SERVER_ERROR_STATUS) {
        logger.error(message, stack);
        return true;
    }

    if (WARNING_STATUSES.has(status)) {
        logger.warn(message);
        return true;
    }

    return false;
}
