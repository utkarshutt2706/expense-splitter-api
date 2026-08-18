import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

interface AuthResponse {
    user: { id: string; name: string; email: string };
    accessToken: string;
}

async function registerUser(app: INestApplication<App>, name: string): Promise<AuthResponse> {
    const email = `${randomUUID()}@example.com`;
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

describe('Expense journey (e2e)', () => {
    let app: INestApplication<App>;
    let creator: AuthResponse;
    let member: AuthResponse;
    let outsider: AuthResponse;
    let groupId: string;

    beforeAll(async () => {
        app = await createTestApp();

        creator = await registerUser(app, 'Creator');
        member = await registerUser(app, 'Member');
        outsider = await registerUser(app, 'Outsider');
    });

    afterAll(async () => {
        if (groupId && creator) {
            // Balances were settled earlier in the flow, so this is expected to
            // succeed -- also exercises the "allowed once settled" path.
            await request(app.getHttpServer())
                .delete(`/groups/${groupId}`)
                .set('Authorization', `Bearer ${creator.accessToken}`)
                .expect(204);
        }
        for (const user of [creator, member, outsider]) {
            if (!user) continue;
            await request(app.getHttpServer())
                .delete(`/users/${user.user.id}`)
                .set('Authorization', `Bearer ${user.accessToken}`);
        }
        await app?.close();
    });

    it('creates a group with the creator auto-added as a member', async () => {
        const response = await request(app.getHttpServer())
            .post('/groups')
            .set('Authorization', `Bearer ${creator.accessToken}`)
            .send({ name: 'Weekend Trip', memberIds: [member.user.id] })
            .expect(201);

        groupId = (response.body as { id: string }).id;
        expect((response.body as { memberIds: string[] }).memberIds.sort()).toEqual(
            [creator.user.id, member.user.id].sort(),
        );
    });

    it('records an expense paid by the creator and split equally', async () => {
        await request(app.getHttpServer())
            .post(`/groups/${groupId}/expenses`)
            .set('Authorization', `Bearer ${creator.accessToken}`)
            .send({
                description: 'Dinner',
                amount: 100,
                paidByUserId: creator.user.id,
                splitType: 'equal',
                splits: [
                    { userId: creator.user.id, amount: 50 },
                    { userId: member.user.id, amount: 50 },
                ],
            })
            .expect(201);
    });

    it('shows the member owing the creator before any payment', async () => {
        const response = await request(app.getHttpServer())
            .get(`/groups/${groupId}/balances`)
            .set('Authorization', `Bearer ${creator.accessToken}`)
            .expect(200);

        const balances = (response.body as { balances: { userId: string; balance: number }[] })
            .balances;
        expect(balances).toContainEqual({ userId: creator.user.id, balance: 50 });
        expect(balances).toContainEqual({ userId: member.user.id, balance: -50 });
    });

    it('refuses to delete the group while balances are unsettled', async () => {
        const response = await request(app.getHttpServer())
            .delete(`/groups/${groupId}`)
            .set('Authorization', `Bearer ${creator.accessToken}`)
            .expect(409);

        expect((response.body as { error: { code: string } }).error.code).toBe('CONFLICT');
    });

    it('refuses to remove a member who still has an unsettled balance', async () => {
        const response = await request(app.getHttpServer())
            .patch(`/groups/${groupId}`)
            .set('Authorization', `Bearer ${creator.accessToken}`)
            .send({ memberIds: [creator.user.id] })
            .expect(409);

        expect((response.body as { error: { code: string } }).error.code).toBe('CONFLICT');

        const groupResponse = await request(app.getHttpServer())
            .get(`/groups/${groupId}`)
            .set('Authorization', `Bearer ${creator.accessToken}`)
            .expect(200);
        expect((groupResponse.body as { memberIds: string[] }).memberIds).toContain(member.user.id);
    });

    it('settles the debt with a payment', async () => {
        await request(app.getHttpServer())
            .post(`/groups/${groupId}/payments`)
            .set('Authorization', `Bearer ${member.accessToken}`)
            .send({ fromUserId: member.user.id, toUserId: creator.user.id, amount: 50 })
            .expect(201);

        const response = await request(app.getHttpServer())
            .get(`/groups/${groupId}/balances`)
            .set('Authorization', `Bearer ${member.accessToken}`)
            .expect(200);

        const body = response.body as {
            balances: { userId: string; balance: number }[];
            settlements: unknown[];
        };
        expect(body.balances).toContainEqual({ userId: creator.user.id, balance: 0 });
        expect(body.balances).toContainEqual({ userId: member.user.id, balance: 0 });
        expect(body.settlements).toEqual([]);
    });

    it('rejects a non-member with 403', async () => {
        const response = await request(app.getHttpServer())
            .get(`/groups/${groupId}`)
            .set('Authorization', `Bearer ${outsider.accessToken}`)
            .expect(403);

        expect((response.body as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    });

    it('rejects an unauthenticated request with 401', async () => {
        const response = await request(app.getHttpServer()).get(`/groups/${groupId}`).expect(401);

        expect((response.body as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
    });
});
