import {
    CallHandler,
    ExecutionContext,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { lastValueFrom, throwError } from 'rxjs';
import { ControllerErrorLoggingInterceptor } from './controller-error-logging.interceptor';

type MockRequest = Pick<Request, 'method' | 'path' | 'route'> & {
    user?: { sub?: string };
};

describe('ControllerErrorLoggingInterceptor', () => {
    let interceptor: ControllerErrorLoggingInterceptor;
    let logError: jest.SpyInstance;
    let logWarning: jest.SpyInstance;

    beforeEach(() => {
        interceptor = new ControllerErrorLoggingInterceptor();
        logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
        logWarning = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function contextFor(request: MockRequest): ExecutionContext {
        return {
            switchToHttp: () => ({ getRequest: () => request }),
            getClass: () => class TestController {},
            getHandler: () => function testHandler() {},
        } as unknown as ExecutionContext;
    }

    function failingHandler(error: unknown): CallHandler {
        return { handle: () => throwError(() => error) };
    }

    it('does not log routine client failures', async () => {
        const error = new NotFoundException('group not found');
        const request: MockRequest = {
            method: 'GET',
            path: '/groups/group-1',
            route: { path: '/groups/:id' },
            user: { sub: 'user-1' },
        };

        await expect(
            lastValueFrom(interceptor.intercept(contextFor(request), failingHandler(error))),
        ).rejects.toBe(error);

        expect(logError).not.toHaveBeenCalled();
        expect(logWarning).not.toHaveBeenCalled();
    });

    it('warns about authentication failures without logging a stack trace', async () => {
        const error = new UnauthorizedException('invalid token');
        const request: MockRequest = {
            method: 'GET',
            path: '/groups/group-1',
            route: { path: '/groups/:id' },
            user: { sub: 'user-1' },
        };

        await expect(
            lastValueFrom(interceptor.intercept(contextFor(request), failingHandler(error))),
        ).rejects.toBe(error);

        expect(logWarning).toHaveBeenCalledWith(
            'Controller request failed | GET /groups/:id | status=401 | ' +
                'controller=TestController | handler=testHandler | user=user-1',
        );
        expect(logError).not.toHaveBeenCalled();
    });

    it('logs unexpected failures without exposing request data', async () => {
        const error = new Error('database failure');
        const request: MockRequest = {
            method: 'POST',
            path: '/auth/register?password=secret',
            route: { path: '/auth/register' },
        };

        await expect(
            lastValueFrom(interceptor.intercept(contextFor(request), failingHandler(error))),
        ).rejects.toBe(error);

        expect(logError).toHaveBeenCalledWith(
            'Controller request failed | POST /auth/register | status=500 | ' +
                'controller=TestController | handler=testHandler | user=anonymous',
            error.stack,
        );
    });
});
