import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from './prisma/prisma.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createSwaggerConfig } from './config/swagger';

describe('AppModule route and security integration with isolated persistence', () => {
    let app: INestApplication<App>;
    let jwt: JwtService;
    const originalEnv = { ...process.env };
    const prisma = { user: { findUnique: jest.fn() }, group: { findUnique: jest.fn() } };
    beforeAll(async () => {
        Object.assign(process.env, {
            NODE_ENV: 'test',
            DATABASE_URL: 'postgresql://test:test@localhost:5432/unit_test',
            CORS_ALLOWED_ORIGINS: 'https://client.example.com',
            API_KEY: 'unit-test-docs-key',
            JWT_SECRET: 'unit-test-jwt-secret-at-least-32-characters',
        });
        const { AppModule } = jest.requireActual<typeof import('./app.module')>('./app.module');
        const module = await Test.createTestingModule({ imports: [AppModule] })
            .overrideProvider(PrismaService)
            .useValue(prisma)
            .compile();
        app = module.createNestApplication();
        app.useGlobalFilters(new HttpExceptionFilter());
        app.useGlobalPipes(
            new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
        );
        app.useLogger(false);
        await app.init();
        jwt = app.get(JwtService);
    });
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.user.findUnique.mockResolvedValue({ phone: '9876543210' });
    });
    afterAll(async () => {
        await app?.close();
        process.env = { ...originalEnv };
    });

    it.each([
        ['get', '/groups'],
        ['get', '/groups/summaries'],
        ['post', '/groups'],
        ['get', '/groups/g'],
        ['patch', '/groups/g'],
        ['delete', '/groups/g'],
        ['get', '/groups/g/expenses'],
        ['post', '/groups/g/expenses'],
        ['get', '/groups/g/expenses/e'],
        ['patch', '/groups/g/expenses/e'],
        ['delete', '/groups/g/expenses/e'],
        ['get', '/groups/g/payments'],
        ['post', '/groups/g/payments'],
        ['patch', '/groups/g/payments/p'],
        ['delete', '/groups/g/payments/p'],
        ['get', '/groups/g/balances'],
        ['get', '/dashboard'],
        ['get', '/users/me/friends'],
        ['get', '/users/lookup'],
        ['post', '/users/batch'],
        ['get', '/users/u'],
        ['patch', '/users/u'],
        ['delete', '/users/u'],
        ['patch', '/auth/password'],
    ] as const)('requires authentication for %s %s', async (method, path) => {
        const result = await request(app.getHttpServer())[method](path).expect(401);
        expect(result.body).toEqual({
            error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
        });
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
        expect(prisma.group.findUnique).not.toHaveBeenCalled();
    });
    it.each([
        ['get', '/groups/g'],
        ['patch', '/groups/g'],
        ['delete', '/groups/g'],
        ['get', '/groups/g/expenses'],
        ['post', '/groups/g/expenses'],
        ['get', '/groups/g/expenses/e'],
        ['patch', '/groups/g/expenses/e'],
        ['delete', '/groups/g/expenses/e'],
        ['get', '/groups/g/payments'],
        ['post', '/groups/g/payments'],
        ['patch', '/groups/g/payments/p'],
        ['delete', '/groups/g/payments/p'],
        ['get', '/groups/g/balances'],
    ] as const)('rejects a nonmember on %s %s', async (method, path) => {
        prisma.group.findUnique.mockResolvedValue({ members: [] });
        const token = await jwt.signAsync({ sub: 'outsider', email: null });
        const result = await request(app.getHttpServer())
            [method](path)
            .set('Authorization', `Bearer ${token}`)
            .expect(403);
        expect(result.body).toEqual({
            error: { code: 'FORBIDDEN', message: 'You are not a member of this group' },
        });
        expect(prisma.group.findUnique).toHaveBeenCalledWith({
            where: { id: 'g' },
            include: { members: { where: { userId: 'outsider', leftAt: null } } },
        });
    });
    it('keeps liveness and session restoration public while enforcing the session header', async () => {
        const live = await request(app.getHttpServer()).get('/liveness').expect(200);
        expect(live.body).toMatchObject({
            status: 'ok',
            checks: { application: { status: 'up' } },
        });
        await request(app.getHttpServer()).post('/auth/refresh').expect(403);
        const refresh = await request(app.getHttpServer())
            .post('/auth/refresh')
            .set('X-Session-Request', 'ExpenseSplitter')
            .expect(200);
        expect(refresh.text).toBe('');
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
    it('uses a 15-minute JWT lifetime and rejects expired signatures before DB access', async () => {
        const token = await jwt.signAsync({ sub: 'u', email: null });
        const payload = await jwt.verifyAsync<{ iat: number; exp: number }>(token);
        expect(payload.exp - payload.iat).toBe(900);
        const expired = await jwt.signAsync({ sub: 'u' }, { expiresIn: -1 });
        await request(app.getHttpServer())
            .get('/groups')
            .set('Authorization', `Bearer ${expired}`)
            .expect(401);
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
    it('exposes the expected bearer security scheme and guarded route contract', () => {
        const document = SwaggerModule.createDocument(app, createSwaggerConfig());
        expect(document.info.title).toBe('Expense Splitter API');
        expect(document.components?.securitySchemes?.['access-token']).toEqual({
            scheme: 'bearer',
            bearerFormat: 'JWT',
            type: 'http',
        });
        expect(document.paths['/groups/{groupId}/expenses'].get?.responses).toMatchObject({
            '200': { description: 'The expenses.' },
            '401': { description: 'Missing or invalid token.' },
            '403': { description: 'The caller is not a member of this group.' },
            '404': { description: 'No group with that id.' },
        });
    });
});
