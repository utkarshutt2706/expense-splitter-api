import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

interface AuthResponse {
    user: { id: string; name: string; email: string };
    accessToken: string;
}

async function registerUser(
    app: INestApplication<App>,
    name: string,
    overrides: { email?: string } = {},
): Promise<AuthResponse> {
    const email = overrides.email ?? `${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
            name,
            email,
            password: 'correct-horse-battery-staple',
            phone: `9${String(Math.random()).slice(2, 11)}`.slice(0, 10),
        })
        .expect(201);
    return response.body as AuthResponse;
}

describe('Friends (e2e)', () => {
    let app: INestApplication<App>;
    let userA: AuthResponse;
    let userB: AuthResponse;
    let groupId: string;

    beforeAll(async () => {
        app = await createTestApp();
        userA = await registerUser(app, 'Alice');
        userB = await registerUser(app, 'Bob');
    });

    afterAll(async () => {
        if (groupId) {
            await request(app.getHttpServer())
                .delete(`/groups/${groupId}`)
                .set('Authorization', `Bearer ${userA.accessToken}`);
        }
        for (const user of [userA, userB]) {
            if (!user) continue;
            await request(app.getHttpServer())
                .delete(`/users/${user.user.id}`)
                .set('Authorization', `Bearer ${user.accessToken}`);
        }
        await app?.close();
    });

    it('creates a group with only the creator as a member', async () => {
        const response = await request(app.getHttpServer())
            .post('/groups')
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .send({ name: 'Goa Trip', memberIds: [userA.user.id] })
            .expect(201);

        groupId = (response.body as { id: string }).id;
        expect((response.body as { memberIds: string[] }).memberIds).toEqual([userA.user.id]);
    });

    it('has no friends yet', async () => {
        const response = await request(app.getHttpServer())
            .get('/users/me/friends')
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .expect(200);

        expect(response.body).toEqual([]);
    });

    it('finds registered users by fuzzy lookup and returns an empty list for no matches', async () => {
        const found = await request(app.getHttpServer())
            .get('/users/lookup')
            .query({ query: 'Bob' })
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .expect(200);
        expect((found.body as { id: string }[]).map((user) => user.id)).toContain(userB.user.id);

        const empty = await request(app.getHttpServer())
            .get('/users/lookup')
            .query({ query: `${randomUUID()}` })
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .expect(200);
        expect(empty.body).toEqual([]);
    });

    it('adds the looked-up user to the group directly, making them friends', async () => {
        const response = await request(app.getHttpServer())
            .patch(`/groups/${groupId}`)
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .send({ memberIds: [userA.user.id, userB.user.id] })
            .expect(200);
        expect((response.body as { memberIds: string[] }).memberIds.sort()).toEqual(
            [userA.user.id, userB.user.id].sort(),
        );

        const friendsOfA = await request(app.getHttpServer())
            .get('/users/me/friends')
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .expect(200);
        expect((friendsOfA.body as { id: string }[]).map((u) => u.id)).toEqual([userB.user.id]);

        const friendsOfB = await request(app.getHttpServer())
            .get('/users/me/friends')
            .set('Authorization', `Bearer ${userB.accessToken}`)
            .expect(200);
        expect((friendsOfB.body as { id: string }[]).map((u) => u.id)).toEqual([userA.user.id]);
    });

    it('stops counting a former group member as a friend', async () => {
        await request(app.getHttpServer())
            .patch(`/groups/${groupId}`)
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .send({ memberIds: [userA.user.id] })
            .expect(200);

        const friendsOfA = await request(app.getHttpServer())
            .get('/users/me/friends')
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .expect(200);
        expect(friendsOfA.body).toEqual([]);

        const friendsOfB = await request(app.getHttpServer())
            .get('/users/me/friends')
            .set('Authorization', `Bearer ${userB.accessToken}`)
            .expect(200);
        expect(friendsOfB.body).toEqual([]);
    });
});
