import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
    let service: HealthService;
    let queryRaw: jest.Mock;
    let errorSpy: jest.SpyInstance;

    beforeEach(async () => {
        jest.spyOn(Logger.prototype, 'log').mockImplementation();
        errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
        queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HealthService,
                { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
            ],
        }).compile();

        service = module.get(HealthService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('reports process liveness without querying dependencies', () => {
        const result = service.liveness();

        expect(result.status).toBe('ok');
        expect(typeof result.timestamp).toBe('string');
        expect(typeof result.uptimeSeconds).toBe('number');
        expect(result.checks).toEqual({ application: { status: 'up' } });
        expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
        expect(queryRaw).not.toHaveBeenCalled();
    });

    it.each(['readiness', 'health'] as const)(
        'reports healthy dependencies for %s',
        async (method) => {
            const result = await service[method]();

            expect(result.status).toBe('ok');
            expect(typeof result.timestamp).toBe('string');
            expect(typeof result.uptimeSeconds).toBe('number');
            expect(result.checks.application).toEqual({ status: 'up' });
            expect(result.checks.database.status).toBe('up');
            expect(typeof result.checks.database.responseTimeMs).toBe('number');
            expect(queryRaw).toHaveBeenCalledTimes(1);
        },
    );

    it('reports unavailable when the database query fails', async () => {
        queryRaw.mockRejectedValue(new Error('connection refused'));

        await expect(service.readiness()).rejects.toThrow(ServiceUnavailableException);
        expect(errorSpy).toHaveBeenCalledWith(
            'Health check failed: database is unavailable',
            expect.any(String),
        );
    });

    it('reports unavailable when the database query times out', async () => {
        jest.useFakeTimers();
        queryRaw.mockReturnValue(new Promise(() => undefined));

        const result = expect(service.readiness()).rejects.toThrow(ServiceUnavailableException);
        await jest.advanceTimersByTimeAsync(3_000);

        await result;
    });
});
