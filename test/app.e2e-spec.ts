import { INestApplication } from '@nestjs/common';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { HealthResponse, LivenessResponse } from '../src/health/health.service';
import { createTestApp } from './utils/create-test-app';

describe('AppModule (e2e)', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
        app = await createTestApp();
    });

    it('/health (GET)', () => {
        return request(app.getHttpServer())
            .get('/health')
            .expect(200)
            .expect((response: Response) => {
                const body = response.body as HealthResponse;
                expect(body.checks).toEqual({
                    application: { status: 'up' },
                    database: {
                        status: 'up',
                        responseTimeMs: body.checks.database.responseTimeMs,
                    },
                });
                expect(typeof body.checks.database.responseTimeMs).toBe('number');
            });
    });

    it('/readiness (GET)', () => {
        return request(app.getHttpServer())
            .get('/readiness')
            .expect(200)
            .expect((response: Response) => {
                const body = response.body as HealthResponse;
                expect(body.checks).toEqual({
                    application: { status: 'up' },
                    database: {
                        status: 'up',
                        responseTimeMs: body.checks.database.responseTimeMs,
                    },
                });
                expect(typeof body.checks.database.responseTimeMs).toBe('number');
            });
    });

    it('/liveness (GET)', () => {
        return request(app.getHttpServer())
            .get('/liveness')
            .expect(200)
            .expect((response: Response) => {
                const body = response.body as LivenessResponse;
                expect(body.status).toBe('ok');
                expect(typeof body.timestamp).toBe('string');
                expect(typeof body.uptimeSeconds).toBe('number');
                expect(body.checks).toEqual({ application: { status: 'up' } });
            });
    });

    afterEach(async () => {
        await app?.close();
    });
});
