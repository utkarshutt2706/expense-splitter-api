import {
    CallHandler,
    ExecutionContext,
    HttpException,
    Injectable,
    Logger,
    NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, catchError, throwError } from 'rxjs';
import { logHttpFailure } from '../http-error-logging';

type AuthenticatedRequest = Request & {
    user?: { sub?: string };
};

export const CONTROLLER_ERROR_LOGGED = Symbol('controllerErrorLogged');

type LoggedRequest = AuthenticatedRequest & {
    [CONTROLLER_ERROR_LOGGED]?: boolean;
};

@Injectable()
export class ControllerErrorLoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(ControllerErrorLoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest<LoggedRequest>();
        const controller = context.getClass().name;
        const handler = context.getHandler().name;
        const route = (request.route as { path?: string } | undefined)?.path ?? request.path;
        const userId = request.user?.sub ?? 'anonymous';

        return next.handle().pipe(
            catchError((error: unknown) => {
                const status = error instanceof HttpException ? error.getStatus() : 500;
                const message = [
                    'Controller request failed',
                    `${request.method} ${route}`,
                    `status=${status}`,
                    `controller=${controller}`,
                    `handler=${handler}`,
                    `user=${userId}`,
                ].join(' | ');

                request[CONTROLLER_ERROR_LOGGED] = logHttpFailure(
                    this.logger,
                    status,
                    message,
                    error instanceof Error ? error.stack : String(error),
                );

                return throwError(() => error);
            }),
        );
    }
}
