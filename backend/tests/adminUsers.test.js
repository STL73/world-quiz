import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq, like } from 'drizzle-orm';

import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { users, scores, rounds } from '../src/db/schema/index.js';
import { hashPassword } from '../src/lib/passwords.js';

// Every account made here starts with PREFIX, so afterAll can remove them all
const PREFIX = 'admin-u-test-';
const PASSWORD = 'correct-horse-battery';
const USERS = '/api/v1/admin/users';

let admin;
let adminId;

let count = 0;
function newAccount() {
    count += 1;
    const stamp = `${Date.now() % 100000}${count}`;
    return { name: `AdminU${stamp}`, email: `${PREFIX}${stamp}@example.com`, password: PASSWORD };
}

// A signed-up player and an agent that carries their cookie, like a browser
async function newPlayer() {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/sign-up').send(newAccount());
    return { agent, userId: res.body.data.userId, email: res.body.data.email };
}

beforeAll(async () => {
    // Admins can't sign up, so one is written straight into the table, then logs in like a browser
    const account = newAccount();
    [{ userId: adminId }] = await db.insert(users).values({
        name: account.name,
        email: account.email,
        passwordHash: await hashPassword(PASSWORD),
        role: 'admin',
    }).returning();
    admin = request.agent(app);
    await admin.post('/api/v1/auth/login').send({ email: account.email, password: PASSWORD });
});

afterAll(async () => {
    await db.delete(users).where(like(users.email, `${PREFIX}%`));
});

describe('who may use the admin user routes', () => {
    it('needs a login, and turns players away', async () => {
        expect((await request(app).get(USERS)).status).toBe(401);
        expect((await (await newPlayer()).agent.get(USERS)).status).toBe(403);
    });
});

describe('listing users', () => {
    it('shows each account without its password, with tokens and level for players', async () => {
        const player = await newPlayer();
        await db.update(scores).set({ starTokens: 250 }).where(eq(scores.userId, player.userId));

        const res = await admin.get(USERS).query({ search: PREFIX });
        expect(res.status).toBe(200);
        const found = res.body.data.find((u) => u.userId === player.userId);
        expect(found).toEqual({
            userId: player.userId,
            name: expect.stringMatching(/^AdminU/),
            email: player.email,
            role: 'user',
            createdAt: expect.any(String),
            starTokens: 250,
            level: 3,
        });
        // Admins have no score row
        expect(res.body.data.find((u) => u.userId === adminId)).toMatchObject({ role: 'admin', starTokens: null, level: null });
        expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    });

    it('lists the newest first, a page at a time', async () => {
        const older = await newPlayer();
        const newer = await newPlayer();
        const res = await admin.get(USERS).query({ search: PREFIX, limit: 2 });
        expect(res.body.data.map((u) => u.userId)).toEqual([newer.userId, older.userId]);
        expect(res.body.pagination).toMatchObject({ page: 1, limit: 2 });
        expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
    });
});

describe('deleting a user', () => {
    it('deletes a player with their score, rounds and sessions', async () => {
        const player = await newPlayer();
        await db.insert(rounds).values({ userId: player.userId, status: 'abandoned', finishedAt: new Date() });

        const res = await admin.delete(`${USERS}/${player.userId}`);
        expect(res.status).toBe(204);
        expect(await db.select().from(users).where(eq(users.userId, player.userId))).toHaveLength(0);
        expect(await db.select().from(scores).where(eq(scores.userId, player.userId))).toHaveLength(0);
        expect(await db.select().from(rounds).where(eq(rounds.userId, player.userId))).toHaveLength(0);
        // Their browser's session went with them
        expect((await player.agent.get('/api/v1/auth/me')).status).toBe(401);
    });

    it("refuses to delete an admin, the admin's own account included", async () => {
        const res = await admin.delete(`${USERS}/${adminId}`);
        expect(res.status).toBe(403);
        expect(res.body.error.message).toBe("Admin accounts can't be deleted here");
        expect(await db.select().from(users).where(eq(users.userId, adminId))).toHaveLength(1);
    });

    it("answers 404 for a user that doesn't exist", async () => {
        expect((await admin.delete(`${USERS}/2147483647`)).status).toBe(404);
    });
});
