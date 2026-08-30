import { HttpStatus } from '@nestjs/common';
import { logHttpFailure } from './http-error-logging';

describe('logHttpFailure', () => {
    const logger = { error: jest.fn(), warn: jest.fn() };

    beforeEach(() => jest.clearAllMocks());

    it('logs server failures at error level with their stack', () => {
        expect(
            logHttpFailure(logger, HttpStatus.INTERNAL_SERVER_ERROR, 'request failed', 'stack'),
        ).toBe(true);
        expect(logger.error).toHaveBeenCalledWith('request failed', 'stack');
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it.each([HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.TOO_MANY_REQUESTS])(
        'logs suspicious status %s at warning level without a stack',
        (status) => {
            expect(logHttpFailure(logger, status, 'request rejected', 'stack')).toBe(true);
            expect(logger.warn).toHaveBeenCalledWith('request rejected');
            expect(logger.error).not.toHaveBeenCalled();
        },
    );

    it.each([HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT])(
        'does not log routine client status %s',
        (status) => {
            expect(logHttpFailure(logger, status, 'expected failure', 'stack')).toBe(false);
            expect(logger.warn).not.toHaveBeenCalled();
            expect(logger.error).not.toHaveBeenCalled();
        },
    );
});
