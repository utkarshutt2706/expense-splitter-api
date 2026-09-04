import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';
import type { HealthResponse, LivenessResponse } from './health.service';

const LIVENESS_EXAMPLE: LivenessResponse = {
    status: 'ok',
    timestamp: '2026-01-01T00:00:00.000Z',
    uptimeSeconds: 120,
    checks: { application: { status: 'up' } },
};

const HEALTH_EXAMPLE: HealthResponse = {
    ...LIVENESS_EXAMPLE,
    checks: {
        application: { status: 'up' },
        database: { status: 'up', responseTimeMs: 3 },
    },
};

@ApiTags('Health')
@Controller()
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @Public()
    @Get('liveness')
    @ApiOperation({
        summary: 'Process liveness probe',
        description:
            'Always public. Confirms that the API process is running without checking external dependencies.',
    })
    @ApiResponse({
        status: 200,
        description: 'API process is alive.',
        schema: { example: LIVENESS_EXAMPLE },
    })
    liveness(): LivenessResponse {
        return this.healthService.liveness();
    }

    @Public()
    @Get('readiness')
    @ApiOperation({
        summary: 'Traffic readiness probe',
        description:
            'Always public. Returns 200 only when the API and all dependencies required to serve traffic are available.',
    })
    @ApiResponse({
        status: 200,
        description: 'API is ready for traffic.',
        schema: { example: HEALTH_EXAMPLE },
    })
    @ApiResponse({ status: 503, description: 'A required dependency is unavailable.' })
    readiness(): Promise<HealthResponse> {
        return this.healthService.readiness();
    }

    @Public()
    @Get('health')
    @ApiOperation({
        summary: 'Aggregate health check',
        description:
            'Always public. Backward-compatible aggregate check of the API and its required dependencies.',
    })
    @ApiResponse({
        status: 200,
        description: 'Service is healthy.',
        schema: { example: HEALTH_EXAMPLE },
    })
    @ApiResponse({ status: 503, description: 'The service is unhealthy.' })
    health(): Promise<HealthResponse> {
        return this.healthService.health();
    }
}
