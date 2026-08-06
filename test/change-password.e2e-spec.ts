import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

interface AuthResponse {
    user: { id: string; name: string; email: string };
    accessToken: string;
}

describe('Change password (e2e)', () => {
    let app: INestApplication<App>;
    let user: AuthResponse;
    let email: string;

    beforeAll(async () => {
        app = await createTestApp();

        email = `${randomUUID()}@example.com`;
        const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ name: 'Password Changer', email, password: 'original-password' })
            .expect(201);
        user = response.body as AuthResponse;
    });

    afterAll(async () => {
        if (user) {
            await request(app.getHttpServer())
                .delete(`/users/${user.user.id}`)
                .set('Authorization', `Bearer ${user.accessToken}`);
        }
        await app?.close();
    });

    it('rejects a change with the wrong current password', async () => {
        const response = await request(app.getHttpServer())
            .patch('/auth/password')
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({ currentPassword: 'not-the-real-password', newPassword: 'a-new-password' })
            .expect(401);

        expect((response.body as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
    });

    it('rejects an unauthenticated request', async () => {
        await request(app.getHttpServer())
            .patch('/auth/password')
            .send({ currentPassword: 'original-password', newPassword: 'a-new-password' })
            .expect(401);
    });

    it('changes the password, and the old password no longer logs in', async () => {
        await request(app.getHttpServer())
            .patch('/auth/password')
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({ currentPassword: 'original-password', newPassword: 'a-new-password' })
            .expect(204);

        await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email, password: 'original-password' })
            .expect(401);

        const loginResponse = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email, password: 'a-new-password' })
            .expect(200);

        expect((loginResponse.body as AuthResponse).user.id).toBe(user.user.id);
    });
});
