import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Response } from 'express';

const STATUS_TO_CODE: Partial<Record<number, string>> = {
    [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
    [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
    [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
    [HttpStatus.CONFLICT]: 'CONFLICT',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<Response>();

        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            response.status(status).json({
                error: {
                    code: STATUS_TO_CODE[status] ?? 'ERROR',
                    message: this.extractMessage(exception),
                },
            });
            return;
        }

        this.logger.error(exception instanceof Error ? exception.stack : exception);
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
    }

    private extractMessage(exception: HttpException): string {
        const body = exception.getResponse();

        if (typeof body === 'string') {
            return body;
        }

        if (typeof body === 'object' && body !== null && 'message' in body) {
            const message = body.message;
            if (Array.isArray(message)) {
                return message.join('; ');
            }
            if (typeof message === 'string') {
                return message;
            }
        }

        return exception.message;
    }
}
