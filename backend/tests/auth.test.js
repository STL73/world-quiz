import { describe, it, expect, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { eq, like } from 'drizzle-orm';

import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { users, scores, sessions } from '../src/db/schema/index.js';
import { hashToken } from '../src/lib/tokens.js';
import { hashPassword } from '../src/lib/passwords.js';
import { requireAuth, requireRole } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

// Every account made here has an email starting with this, so afterAll can remove them all
const PREFIX = 'auth-test-';
// Written out here rather than imported, so a wrong value in the app can't make a test agree
const PASSWORD = 'correct-horse-battery';
const DAY = 24 * 60 * 60 * 1000;

let count = 0;
// A new email and player name each time, so tests never clash with each other or an earlier run
function newPlayer(overrides = {}) {
    count += 1;
    const stamp = `${Date.now() % 100000}${count}`;
    return { name: `AuthTest${stamp}`, email: `${PREFIX}${stamp}@example.com`, password: PASSWORD, ...overrides };
}

afterAll(async () => {
    // Scores and sessions go with their users (ON DELETE CASCADE)
    await db.delete(users).where(like(users.email, `${PREFIX}%`));
});

function sessionCookie(res) {
    return res.headers['set-cookie']?.find((cookie) => cookie.startsWith('sid='));
}

// Just `sid=<token>`, the part a browser sends back
const cookieValue = (res) => sessionCookie(res).split(';')[0];

// A signed-up player and an agent that carries their cookie, like a browser
async function signUp(overrides) {
    const agent = request.agent(app);
    const body = newPlayer(overrides);
    const res = await agent.post('/api/v1/auth/sign-up').send(body);
    return { agent, res, body };
}

async function addAdmin() {
    const body = newPlayer();
    await db.insert(users).values({
        name: body.name,
        email: body.email,
        passwordHash: await hashPassword(PASSWORD),
        role: 'admin',
    });
    return body;
}

describe('sign-up', () => {
    it('creates a player with a 0-token score, logs them in and never returns the hash', async () => {
        const { agent, res, body } = await signUp();
        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({ name: body.name, email: body.email, role: 'user' });
        expect(res.body.data).not.toHaveProperty('passwordHash');

        const [score] = await db.select().from(scores).where(eq(scores.userId, res.body.data.userId));
        expect(score.starTokens).toBe(0);

        const me = await agent.get('/api/v1/auth/me');
        expect(me.status).toBe(200);
        expect(me.body.data.userId).toBe(res.body.data.userId);
    });

    it('sets an httpOnly, SameSite=Lax cookie and stores only its hash', async () => {
        const { res } = await signUp();
        const cookie = sessionCookie(res);
        expect(cookie).toMatch(/HttpOnly/);
        expect(cookie).toMatch(/SameSite=Lax/);

        const token = cookie.split(';')[0].slice('sid='.length);
        const rows = await db.select().from(sessions).where(eq(sessions.userId, res.body.data.userId));
        expect(rows).toHaveLength(1);
        expect(rows[0].sessionId).toBe(hashToken(token));
    });

    it('lowercases the email and trims the name', async () => {
        const wanted = newPlayer();
        const { res } = await signUp({ email: wanted.email.toUpperCase(), name: `  ${wanted.name}  ` });
        expect(res.status).toBe(201);
        expect(res.body.data.email).toBe(wanted.email);
        expect(res.body.data.name).toBe(wanted.name);
    });

    it('makes every sign-up a player, even when the body asks for admin', async () => {
        const { res } = await signUp({ role: 'admin' });
        expect(res.status).toBe(201);
        expect(res.body.data.role).toBe('user');
    });

    it('refuses a taken email with 409 under the email field', async () => {
        const first = await signUp();
        const { res } = await signUp({ email: first.body.email });
        expect(res.status).toBe(409);
        expect(res.body.error.details[0].path).toBe('body.email');
    });

    it('refuses a name taken in other capitals with 409 under the name field, and leaves nothing behind', async () => {
        const first = await signUp();
        const { res, body } = await signUp({ name: first.body.name.toUpperCase() });
        expect(res.status).toBe(409);
        expect(res.body.error.details[0].path).toBe('body.name');

        const left = await db.select().from(users).where(eq(users.email, body.email));
        expect(left).toEqual([]);
    });

    it('refuses invalid input with 400 and lists every problem', async () => {
        const res = await request(app).post('/api/v1/auth/sign-up').send({ name: 'Al', email: 'nope', password: 'short' });
        expect(res.status).toBe(400);
        const paths = res.body.error.details.map((detail) => detail.path);
        expect(paths).toEqual(expect.arrayContaining(['body.name', 'body.email', 'body.password']));
    });
});

describe('login', () => {
    it('logs in with any capitals in the email, with a new session every time', async () => {
        const { res: signedUp, body } = await signUp();
        const login = () => request(app).post('/api/v1/auth/login').send({ email: body.email.toUpperCase(), password: PASSWORD });

        const first = await login();
        const second = await login();
        expect(first.status).toBe(200);
        expect(first.body.data.email).toBe(body.email);
        expect(sessionCookie(first)).not.toBe(sessionCookie(second));

        // One from sign-up and one from each login
        const rows = await db.select().from(sessions).where(eq(sessions.userId, signedUp.body.data.userId));
        expect(rows).toHaveLength(3);
    });

    it('gives the same 401 for a wrong password and an unknown email, and no cookie', async () => {
        const { body } = await signUp();
        const wrong = await request(app).post('/api/v1/auth/login').send({ email: body.email, password: 'wrong-password' });
        const unknown = await request(app).post('/api/v1/auth/login').send({ email: `${PREFIX}nobody@example.com`, password: PASSWORD });

        expect(wrong.status).toBe(401);
        expect(unknown.status).toBe(401);
        expect(wrong.body.error.message).toBe(unknown.body.error.message);
        expect(sessionCookie(wrong)).toBeUndefined();
        expect(sessionCookie(unknown)).toBeUndefined();
    });

    it('logs in an admin made the way the seed makes one', async () => {
        const admin = await addAdmin();
        const res = await request(app).post('/api/v1/auth/login').send({ email: admin.email, password: PASSWORD });
        expect(res.status).toBe(200);
        expect(res.body.data.role).toBe('admin');
    });
});

describe('logout and me', () => {
    it('answers 401 on /me without a session', async () => {
        const res = await request(app).get('/api/v1/auth/me');
        expect(res.status).toBe(401);
    });

    it('deletes the session on logout, after which /me answers 401', async () => {
        const { agent, res } = await signUp();
        const logout = await agent.post('/api/v1/auth/logout');
        expect(logout.status).toBe(204);

        const rows = await db.select().from(sessions).where(eq(sessions.userId, res.body.data.userId));
        expect(rows).toEqual([]);
        expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    });

    it('answers 401 for an expired session and clears its cookie', async () => {
        const { agent, res } = await signUp();
        await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, res.body.data.userId));

        const me = await agent.get('/api/v1/auth/me');
        expect(me.status).toBe(401);
        expect(sessionCookie(me)).toMatch(/^sid=;/);
    });

    it('moves a session forward when fewer than 15 days are left', async () => {
        const { agent, res } = await signUp();
        await db.update(sessions).set({ expiresAt: new Date(Date.now() + 10 * DAY) }).where(eq(sessions.userId, res.body.data.userId));

        expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
        const [row] = await db.select().from(sessions).where(eq(sessions.userId, res.body.data.userId));
        expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * DAY);
    });
});

describe('requireRole', () => {
    // A small app with one admin-only route: no admin routes exist yet, and the guard has to be
    // proven before they do. It reads the same session cookies as the real app
    const guarded = express();
    guarded.use(cookieParser());
    guarded.get('/admin-only', requireAuth, requireRole('admin'), (req, res) => res.json({ data: { ok: true } }));
    guarded.use(errorHandler);

    it('answers 401 with no session, 403 for a player and 200 for an admin', async () => {
        const { res: player } = await signUp();
        const admin = await addAdmin();
        const adminLogin = await request(app).post('/api/v1/auth/login').send({ email: admin.email, password: PASSWORD });

        expect((await request(guarded).get('/admin-only')).status).toBe(401);
        expect((await request(guarded).get('/admin-only').set('Cookie', cookieValue(player))).status).toBe(403);
        expect((await request(guarded).get('/admin-only').set('Cookie', cookieValue(adminLogin))).status).toBe(200);
    });
});

describe('stars and level', () => {
    it('gives a new player 0 stars at level 1, on sign-up and on /me', async () => {
        const { agent, res } = await signUp();
        expect(res.body.data).toMatchObject({ starTokens: 0, level: 1 });

        const me = await agent.get('/api/v1/auth/me');
        expect(me.body.data).toMatchObject({ starTokens: 0, level: 1 });
    });

    it('works the level out from the stars, on /me and at login', async () => {
        const { agent, res, body } = await signUp();
        // 250 stars: two full levels of 100, so level 3
        await db.update(scores).set({ starTokens: 250 }).where(eq(scores.userId, res.body.data.userId));

        const me = await agent.get('/api/v1/auth/me');
        expect(me.body.data).toMatchObject({ starTokens: 250, level: 3 });

        const login = await request(app).post('/api/v1/auth/login').send({ email: body.email, password: PASSWORD });
        expect(login.body.data).toMatchObject({ starTokens: 250, level: 3 });
    });

    it('gives an admin null for both, as admins have no score row', async () => {
        const admin = await addAdmin();
        const agent = request.agent(app);

        const login = await agent.post('/api/v1/auth/login').send({ email: admin.email, password: PASSWORD });
        expect(login.body.data).toMatchObject({ starTokens: null, level: null });

        const me = await agent.get('/api/v1/auth/me');
        expect(me.body.data).toMatchObject({ starTokens: null, level: null });
    });
});
