import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { like } from 'drizzle-orm';

import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { users, countries, questions } from '../src/db/schema/index.js';
import { hashPassword } from '../src/lib/passwords.js';

// Everything made here is recognisable, so afterAll can remove it all. Photos the routes "upload"
// in later tests get names containing CLOUDINARY_ID too
const PREFIX = 'admin-q-test-';
const COUNTRY = 'Admin Testland';
const CLOUDINARY_ID = 'admin-q-test';
const PASSWORD = 'correct-horse-battery';

const QUESTIONS = '/api/v1/admin/questions';
const COUNTRIES = '/api/v1/admin/countries';

let admin;
let player;
let seeded;

let count = 0;
function newAccount() {
    count += 1;
    const stamp = `${Date.now() % 100000}${count}`;
    return { name: `AdminQ${stamp}`, email: `${PREFIX}${stamp}@example.com`, password: PASSWORD };
}

// Admins can't sign up, so one is written straight into the table, then logs in like a browser
async function newAdmin() {
    const account = newAccount();
    await db.insert(users).values({
        name: account.name,
        email: account.email,
        passwordHash: await hashPassword(PASSWORD),
        role: 'admin',
    });
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email: account.email, password: PASSWORD });
    return agent;
}

beforeAll(async () => {
    const [country] = await db.insert(countries).values({ name: COUNTRY }).returning();
    seeded = await db.insert(questions).values([0, 1, 2].map((i) => ({
        countryId: country.countryId,
        imageUrl: `https://example.com/admin-q-test-${i}.jpg`,
        cloudinaryId: CLOUDINARY_ID,
        question: `Admin test question ${i}`,
        hint: `Admin test hint ${i}`,
        answer1: `A${i} one`,
        answer2: `A${i} two`,
        answer3: `A${i} three`,
        correctAnswer: (i % 3) + 1,
    }))).returning();
    admin = await newAdmin();
    player = request.agent(app);
    await player.post('/api/v1/auth/sign-up').send(newAccount());
});

afterAll(async () => {
    // Rounds go with their players; only then can played questions be deleted
    await db.delete(users).where(like(users.email, `${PREFIX}%`));
    await db.delete(questions).where(like(questions.cloudinaryId, `%${CLOUDINARY_ID}%`));
    await db.delete(countries).where(like(countries.name, 'Admin Test%'));
});

describe('who may use the admin question routes', () => {
    it('needs a login, and turns players away', async () => {
        expect((await request(app).get(QUESTIONS)).status).toBe(401);
        expect((await player.get(QUESTIONS)).status).toBe(403);
        expect((await player.get(COUNTRIES)).status).toBe(403);
    });
});

describe('listing questions', () => {
    it('finds questions by their text and shows each with its country, answers and state', async () => {
        const res = await admin.get(QUESTIONS).query({ search: 'admin test question' });
        expect(res.status).toBe(200);
        expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
        expect(res.body.data[0]).toEqual({
            questionId: seeded[0].questionId,
            country: COUNTRY,
            imageUrl: 'https://example.com/admin-q-test-0.jpg',
            question: 'Admin test question 0',
            hint: 'Admin test hint 0',
            answer1: 'A0 one',
            answer2: 'A0 two',
            answer3: 'A0 three',
            correctAnswer: 1,
            hiddenAt: null,
            played: false,
        });
        // Cloudinary's name for the photo stays on the server
        expect(JSON.stringify(res.body)).not.toMatch(/cloudinary/i);
    });

    it('finds questions by their country, a page at a time', async () => {
        const res = await admin.get(QUESTIONS).query({ search: 'testland', limit: 2, page: 2 });
        expect(res.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
        expect(res.body.data.map((q) => q.questionId)).toEqual([seeded[2].questionId]);
    });

    it('takes % in the search literally', async () => {
        const res = await admin.get(QUESTIONS).query({ search: 'admin test question%' });
        expect(res.body.pagination.total).toBe(0);
    });

    it('refuses a page below 1', async () => {
        const res = await admin.get(QUESTIONS).query({ page: 0 });
        expect(res.status).toBe(400);
        expect(res.body.error.details).toEqual([expect.objectContaining({ path: 'query.page' })]);
    });
});

describe('one question', () => {
    it('shows the question an admin edits', async () => {
        const res = await admin.get(`${QUESTIONS}/${seeded[1].questionId}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ questionId: seeded[1].questionId, correctAnswer: 2, played: false });
    });

    it("answers 404 for a question that doesn't exist, and 400 for an id that isn't one", async () => {
        expect((await admin.get(`${QUESTIONS}/2147483647`)).status).toBe(404);
        expect((await admin.get(`${QUESTIONS}/abc`)).status).toBe(400);
    });

    it('previews a question as a player would see it, with the right button marked', async () => {
        const question = seeded[2];
        const res = await admin.get(`${QUESTIONS}/${question.questionId}/preview`);
        expect(res.status).toBe(200);
        const { answers, correctChoice, ...rest } = res.body.data;
        expect(rest).toEqual({ imageUrl: question.imageUrl, text: question.question, hint: question.hint, hidden: false });
        expect([...answers].sort()).toEqual([question.answer1, question.answer2, question.answer3].sort());
        expect(answers[correctChoice - 1]).toBe(question[`answer${question.correctAnswer}`]);
    });
});

describe('countries', () => {
    it("lists every country by name, for the form's suggestions", async () => {
        const res = await admin.get(COUNTRIES);
        expect(res.status).toBe(200);
        expect(res.body.data).toContainEqual({ countryId: seeded[0].countryId, name: COUNTRY });
    });
});
