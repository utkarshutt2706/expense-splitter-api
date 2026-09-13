import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('Auth endpoint rate limits', () => {
    let app: INestApplication<App>;
    let authService: {
        register: jest.Mock;
        login: jest.Mock;
        changePassword: jest.Mock;
        createRefreshSession: jest.Mock;
        refresh: jest.Mock;
        revokeRefreshSession: jest.Mock;
    };

    beforeEach(async () => {
        authService = {
            register: jest.fn().mockResolvedValue({ user: { id: 'user-1' }, accessToken: 'token' }),
            login: jest.fn().mockResolvedValue({ user: { id: 'user-1' }, accessToken: 'token' }),
            changePassword: jest.fn(),
            createRefreshSession: jest.fn().mockResolvedValue('refresh-token'),
            refresh: jest.fn(),
            revokeRefreshSession: jest.fn(),
        };
        const moduleRef = await Test.createTestingModule({
            imports: [
                ThrottlerModule.forRoot({
                    throttlers: [{ ttl: 60_000, limit: 10 }],
                    errorMessage: 'Too many requests. Please try again later.',
                }),
            ],
            controllers: [AuthController],
            providers: [{ provide: AuthService, useValue: authService }],
        }).compile();

        app = moduleRef.createNestApplication();
        app.useGlobalFilters(new HttpExceptionFilter());
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    it('limits login attempts by client', async () => {
        for (let attempt = 0; attempt < 10; attempt += 1) {
            await request(app.getHttpServer()).post('/auth/login').send({}).expect(200);
        }

        const blocked = await request(app.getHttpServer()).post('/auth/login').send({}).expect(429);

        expect(blocked.body).toEqual({
            error: {
                code: 'TOO_MANY_REQUESTS',
                message: 'Too many requests. Please try again later.',
            },
        });
        expect(authService.login).toHaveBeenCalledTimes(10);
    });

    it('uses a stricter limit for account registration', async () => {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            await request(app.getHttpServer()).post('/auth/register').send({}).expect(201);
        }

        await request(app.getHttpServer()).post('/auth/register').send({}).expect(429);

        expect(authService.register).toHaveBeenCalledTimes(5);
    });

    it('limits refresh requests and counts requests even without a cookie', async () => {
        for (let i = 0; i < 30; i++) {
            await request(app.getHttpServer())
                .post('/auth/refresh')
                .set('X-Session-Request', 'ExpenseSplitter')
                .expect(200);
        }
        const result = await request(app.getHttpServer())
            .post('/auth/refresh')
            .set('X-Session-Request', 'ExpenseSplitter')
            .expect(429);
        expect(result.body).toEqual({
            error: {
                code: 'TOO_MANY_REQUESTS',
                message: 'Too many requests. Please try again later.',
            },
        });
        expect(authService.refresh).not.toHaveBeenCalled();
    });
});
