import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthResponse, HealthService, LivenessResponse } from './health.service';

describe('HealthController', () => {
    let controller: HealthController;
    let healthService: jest.Mocked<HealthService>;
    let livenessMock: jest.Mock;
    let readinessMock: jest.Mock;
    let healthMock: jest.Mock;

    const liveness: LivenessResponse = {
        status: 'ok',
        timestamp: '2026-01-01T00:00:00.000Z',
        uptimeSeconds: 120,
        checks: { application: { status: 'up' } },
    };
    const health: HealthResponse = {
        ...liveness,
        checks: {
            application: { status: 'up' },
            database: { status: 'up', responseTimeMs: 3 },
        },
    };

    beforeEach(async () => {
        livenessMock = jest.fn().mockReturnValue(liveness);
        readinessMock = jest.fn().mockResolvedValue(health);
        healthMock = jest.fn().mockResolvedValue(health);
        healthService = {
            liveness: livenessMock,
            readiness: readinessMock,
            health: healthMock,
        } as unknown as jest.Mocked<HealthService>;
        const module: TestingModule = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [{ provide: HealthService, useValue: healthService }],
        }).compile();

        controller = module.get(HealthController);
    });

    it('delegates the liveness probe', () => {
        expect(controller.liveness()).toEqual(liveness);
        expect(livenessMock).toHaveBeenCalledTimes(1);
    });

    it('delegates the readiness probe', async () => {
        await expect(controller.readiness()).resolves.toEqual(health);
        expect(readinessMock).toHaveBeenCalledTimes(1);
    });

    it('delegates the aggregate health check', async () => {
        await expect(controller.health()).resolves.toEqual(health);
        expect(healthMock).toHaveBeenCalledTimes(1);
    });
});
