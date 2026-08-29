import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

interface HealthResponse {
    status: 'ok';
    checks: { database: 'up' };
}

interface ReadinessResponse {
    status: 'ok';
    checks: { system: 'up' };
}

const DATABASE_CHECK_TIMEOUT_MS = 3_000;

@Controller()
export class HealthController {
    private readonly logger = new Logger(HealthController.name);

    constructor(private readonly prisma: PrismaService) {}

    @Public()
    @Get('health')
    @ApiOperation({
        summary: 'Database health check',
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

    @Public()
    @Get('readiness')
    @ApiOperation({
        summary: 'System readiness check',
        description:
            'Always public. Confirms that the API process can handle requests without querying external dependencies.',
    })
    @ApiResponse({
        status: 200,
        description: 'API process is responsive.',
        schema: { example: { status: 'ok', checks: { system: 'up' } } },
    })
    readiness(): ReadinessResponse {
        return { status: 'ok', checks: { system: 'up' } };
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
