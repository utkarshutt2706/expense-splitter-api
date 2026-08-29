import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
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
            .expect({ status: 'ok', checks: { database: 'up' } });
    });

    it('/readiness (GET)', () => {
        return request(app.getHttpServer())
            .get('/readiness')
            .expect(200)
            .expect({ status: 'ok', checks: { system: 'up' } });
    });

    afterEach(async () => {
        await app?.close();
    });
});
