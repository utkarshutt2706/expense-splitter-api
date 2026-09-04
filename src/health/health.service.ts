import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type UpCheck = { status: 'up' };
type DatabaseCheck = UpCheck & { responseTimeMs: number };

export interface LivenessResponse {
    status: 'ok';
    timestamp: string;
    uptimeSeconds: number;
    checks: { application: UpCheck };
}

export interface HealthResponse extends Omit<LivenessResponse, 'checks'> {
    checks: { application: UpCheck; database: DatabaseCheck };
}

const DATABASE_CHECK_TIMEOUT_MS = 3_000;

@Injectable()
export class HealthService {
    private readonly logger = new Logger(HealthService.name);

    constructor(private readonly prisma: PrismaService) {}

    liveness(): LivenessResponse {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.floor(process.uptime()),
            checks: { application: { status: 'up' } },
        };
    }

    async readiness(): Promise<HealthResponse> {
        return this.checkDependencies();
    }

    async health(): Promise<HealthResponse> {
        return this.checkDependencies();
    }

    private async checkDependencies(): Promise<HealthResponse> {
        const startedAt = performance.now();

        try {
            await this.withTimeout(this.prisma.$queryRaw`SELECT 1`);
            const responseTimeMs = Math.max(0, Math.round(performance.now() - startedAt));
            this.logger.log(`Health check passed: database responded in ${responseTimeMs}ms`);

            return {
                ...this.liveness(),
                checks: {
                    application: { status: 'up' },
                    database: { status: 'up', responseTimeMs },
                },
            };
        } catch (error) {
            this.logger.error(
                'Health check failed: database is unavailable',
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
