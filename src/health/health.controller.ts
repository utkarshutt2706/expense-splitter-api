import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

interface HealthResponse {
    status: 'ok';
    checks: { database: 'up' };
}

const DATABASE_CHECK_TIMEOUT_MS = 3_000;

@Controller('health')
export class HealthController {
    private readonly logger = new Logger(HealthController.name);

    constructor(private readonly prisma: PrismaService) {}

    @Public()
    @Get()
    @ApiOperation({
        summary: 'Readiness check',
        description: 'Always public. Returns 200 only when the API can query its database.',
    })
    @ApiResponse({
        status: 200,
        description: 'Service is up.',
        schema: { example: { status: 'ok', checks: { database: 'up' } } },
    })
    @ApiResponse({
        status: 503,
        description: 'A required dependency is unavailable.',
    })
    async check(): Promise<HealthResponse> {
        try {
            await this.withTimeout(this.prisma.$queryRaw`SELECT 1`);
            this.logger.log('Health check passed: database is reachable');
            return { status: 'ok', checks: { database: 'up' } };
        } catch (error) {
            this.logger.error(
                'Database health check failed',
                error instanceof Error ? error.stack : undefined,
            );
            throw new ServiceUnavailableException('Database health check failed');
        }
    }

    private async withTimeout<T>(operation: Promise<T>): Promise<T> {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(
                () => reject(new Error('Database health check timed out')),
                DATABASE_CHECK_TIMEOUT_MS,
            );
        });

        try {
            return await Promise.race([operation, timeoutPromise]);
        } finally {
            if (timeout) clearTimeout(timeout);
        }
    }
}
