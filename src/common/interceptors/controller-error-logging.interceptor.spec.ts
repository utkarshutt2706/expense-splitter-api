import { CallHandler, ExecutionContext, Logger, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { lastValueFrom, throwError } from 'rxjs';
import { ControllerErrorLoggingInterceptor } from './controller-error-logging.interceptor';

type MockRequest = Pick<Request, 'method' | 'path' | 'route'> & {
    user?: { sub?: string };
};

describe('ControllerErrorLoggingInterceptor', () => {
    let interceptor: ControllerErrorLoggingInterceptor;
    let logError: jest.SpyInstance;

    beforeEach(() => {
        interceptor = new ControllerErrorLoggingInterceptor();
        logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
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

    it('logs HTTP failures with route and authenticated user context', async () => {
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

        expect(logError).toHaveBeenCalledWith(
            'Controller request failed | GET /groups/:id | status=404 | ' +
                'controller=TestController | handler=testHandler | user=user-1',
            error.stack,
        );
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
