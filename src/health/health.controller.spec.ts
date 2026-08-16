import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
    let controller: HealthController;
    let queryRaw: jest.Mock;
    let logSpy: jest.SpyInstance;

    beforeEach(async () => {
        logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
        queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
        const module: TestingModule = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [{ provide: PrismaService, useValue: { $queryRaw: queryRaw } }],
        }).compile();

        controller = module.get<HealthController>(HealthController);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('reports the API and database as healthy', async () => {
        await expect(controller.check()).resolves.toEqual({
            status: 'ok',
            checks: { database: 'up' },
        });
        expect(queryRaw).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith('Health check passed: database is reachable');
    });

    it('reports unavailable when the database query fails', async () => {
        queryRaw.mockRejectedValue(new Error('connection refused'));

        await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
    });

    it('reports unavailable when the database query times out', async () => {
        jest.useFakeTimers();
        queryRaw.mockReturnValue(new Promise(() => undefined));

        const result = expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
        await jest.advanceTimersByTimeAsync(3_000);

        await result;
    });
});
