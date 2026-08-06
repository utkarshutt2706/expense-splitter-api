import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { MailService } from '../src/mail/mail.service';
import { createTestApp } from './utils/create-test-app';

interface AuthResponse {
    user: { id: string; name: string; email: string };
    accessToken: string;
}

async function registerUser(
    app: INestApplication<App>,
    name: string,
    overrides: { email?: string; inviteToken?: string } = {},
): Promise<AuthResponse> {
    const email = overrides.email ?? `${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
            name,
            email,
            password: 'correct-horse-battery-staple',
            inviteToken: overrides.inviteToken,
        })
        .expect(201);
    return response.body as AuthResponse;
}

function extractInviteToken(inviteUrl: string): string {
    const token = new URL(inviteUrl).searchParams.get('invite');
    if (!token) {
        throw new Error(`No invite token found in URL: ${inviteUrl}`);
    }
    return token;
}

describe('Friends and invitations (e2e)', () => {
    let app: INestApplication<App>;
    let userA: AuthResponse;
    let userB: AuthResponse;
    let userC: AuthResponse;
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
        for (const user of [userA, userB, userC]) {
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

    it('finds a registered user by exact email via lookup, and 404s for an unregistered one', async () => {
        const found = await request(app.getHttpServer())
            .get('/users/lookup')
            .query({ email: userB.user.email })
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .expect(200);
        expect((found.body as { id: string }).id).toBe(userB.user.id);

        await request(app.getHttpServer())
            .get('/users/lookup')
            .query({ email: `${randomUUID()}@example.com` })
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .expect(404);
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

    it('invites an unregistered email, and the invited person registers and auto-joins', async () => {
        const unregisteredEmail = `${randomUUID()}@example.com`;
        const mailService = app.get(MailService);
        const sendSpy = jest.spyOn(mailService, 'sendInvitationEmail');

        const createResponse = await request(app.getHttpServer())
            .post(`/groups/${groupId}/invitations`)
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .send({ email: unregisteredEmail })
            .expect(201);
        expect((createResponse.body as { status: string }).status).toBe('pending');

        expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ to: unregisteredEmail }));
        const inviteUrl = (sendSpy.mock.calls[0][0] as { inviteUrl: string }).inviteUrl;
        const rawToken = extractInviteToken(inviteUrl);

        const validateResponse = await request(app.getHttpServer())
            .get(`/invitations/${rawToken}`)
            .expect(200);
        expect(validateResponse.body).toEqual({
            email: unregisteredEmail,
            group: { id: groupId, name: 'Goa Trip' },
            inviterName: 'Alice',
        });

        userC = await registerUser(app, 'Charlie', {
            email: unregisteredEmail,
            inviteToken: rawToken,
        });

        const groupResponse = await request(app.getHttpServer())
            .get(`/groups/${groupId}`)
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .expect(200);
        expect((groupResponse.body as { memberIds: string[] }).memberIds).toContain(userC.user.id);

        const friendsOfA = await request(app.getHttpServer())
            .get('/users/me/friends')
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .expect(200);
        expect((friendsOfA.body as { id: string }[]).map((u) => u.id).sort()).toEqual(
            [userB.user.id, userC.user.id].sort(),
        );

        // The invitation is consumed: re-validating the same token now fails.
        await request(app.getHttpServer()).get(`/invitations/${rawToken}`).expect(409);

        sendSpy.mockRestore();
    });
});
