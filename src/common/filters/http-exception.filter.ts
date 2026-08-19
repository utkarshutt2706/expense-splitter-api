import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CONTROLLER_ERROR_LOGGED } from '../interceptors/controller-error-logging.interceptor';

const STATUS_TO_CODE: Partial<Record<number, string>> = {
    [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
    [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
    [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
    [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
    [HttpStatus.CONFLICT]: 'CONFLICT',
    [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<Response>();
        const request = host
            .switchToHttp()
            .getRequest<
                Request & { [CONTROLLER_ERROR_LOGGED]?: boolean; user?: { sub?: string } }
            >();

        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            this.logIfNeeded(request, status, exception.message, exception.stack);
            response.status(status).json({
                error: {
                    code: STATUS_TO_CODE[status] ?? 'ERROR',
                    message: this.extractMessage(exception),
                },
            });
            return;
        }

        this.logIfNeeded(
            request,
            HttpStatus.INTERNAL_SERVER_ERROR,
            'Unexpected error',
            exception instanceof Error ? exception.stack : String(exception),
        );
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
    }

    private logIfNeeded(
        request: Request & { [CONTROLLER_ERROR_LOGGED]?: boolean; user?: { sub?: string } },
        status: number,
        message: string,
        stack?: string,
    ): void {
        if (request[CONTROLLER_ERROR_LOGGED]) {
            return;
        }

        this.logger.error(
            `Request failed | ${request.method} ${this.getRoutePath(request)} | ` +
                `status=${status} | user=${request.user?.sub ?? 'anonymous'} | ${message}`,
            stack,
        );
    }

    private getRoutePath(request: Request): string {
        return (request.route as { path?: string } | undefined)?.path ?? request.path;
    }

    private extractMessage(exception: HttpException): string {
        const body = exception.getResponse();

        if (typeof body === 'string') {
            return this.capitalizeFirstLetter(body);
        }

        if (typeof body === 'object' && body !== null && 'message' in body) {
            const message = body.message;

            if (Array.isArray(message)) {
                return message.map((item) => this.capitalizeFirstLetter(String(item))).join('; ');
            }

            if (typeof message === 'string') {
                return this.capitalizeFirstLetter(message);
            }
        }

        return this.capitalizeFirstLetter(exception.message);
    }

    private capitalizeFirstLetter(message: string): string {
        const trimmedMessage = message.trim();

        if (!trimmedMessage) {
            return trimmedMessage;
        }

        return trimmedMessage.charAt(0).toUpperCase() + trimmedMessage.slice(1);
    }
}
