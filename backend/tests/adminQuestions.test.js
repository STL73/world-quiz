import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { eq, like } from 'drizzle-orm';

import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { users, countries, questions, rounds, roundQuestions } from '../src/db/schema/index.js';
import { cloudinary } from '../src/config/cloudinary.js';
import { hashPassword } from '../src/lib/passwords.js';

// Everything made here is recognisable, so afterAll can remove it all. Photos the routes "upload"
// in later tests get names containing CLOUDINARY_ID too
const PREFIX = 'admin-q-test-';
const COUNTRY = 'Admin Testland';
const CLOUDINARY_ID = 'admin-q-test';
const PASSWORD = 'correct-horse-battery';

const QUESTIONS = '/api/v1/admin/questions';
const COUNTRIES = '/api/v1/admin/countries';

// What the add form sends, as text, the way a browser sends a form
const FORM = {
    country: COUNTRY,
    question: 'Admin test: which tower is this?',
    hint: 'Admin test hint',
    answer1: 'Admin tower one',
    answer2: 'Admin tower two',
    answer3: 'Admin tower three',
    correctAnswer: '2',
};
const PHOTO = { filename: 'landmark.jpg', contentType: 'image/jpeg' };

let admin;
let player;
let playerId;
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

// Fills a multipart request with the form's fields, `values` replacing some of them
function withForm(req, values = {}) {
    for (const [name, value] of Object.entries({ ...FORM, ...values })) req.field(name, String(value));
    return req;
}

// A question written straight into the table, as one an admin could have added
async function addQuestion(values = {}) {
    const [question] = await db.insert(questions).values({
        countryId: seeded[0].countryId,
        imageUrl: 'https://example.com/admin-q-test-extra.jpg',
        cloudinaryId: `${CLOUDINARY_ID}-extra`,
        question: 'Admin test extra question',
        hint: 'Admin test extra hint',
        answer1: 'One',
        answer2: 'Two',
        answer3: 'Three',
        correctAnswer: 1,
        ...values,
    }).returning();
    return question;
}

// Puts a question in one of the player's rounds, so the database counts it as played
async function playQuestion(questionId) {
    const [round] = await db.insert(rounds)
        .values({ userId: playerId, status: 'abandoned', finishedAt: new Date() })
        .returning();
    await db.insert(roundQuestions).values({ roundId: round.roundId, position: 1, questionId, answerOrder: [1, 2, 3] });
}

// Cloudinary is never called: each upload "succeeds" with a new name, and deletes do nothing
let upload;
let destroy;
let uploads = 0;
beforeEach(() => {
    upload = vi.spyOn(cloudinary.uploader, 'upload').mockImplementation(async () => {
        uploads += 1;
        return { public_id: `world-quiz/test/questions/${CLOUDINARY_ID}-${uploads}`, version: 1700000000 };
    });
    destroy = vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
});
afterEach(() => vi.restoreAllMocks());

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
    playerId = (await player.post('/api/v1/auth/sign-up').send(newAccount())).body.data.userId;
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

describe('adding a question', () => {
    it('saves the question with its photo, finding the country whatever the capitals', async () => {
        const res = await withForm(admin.post(QUESTIONS), { country: 'admin TESTLAND' })
            .attach('photo', Buffer.from('jpeg bytes'), PHOTO);
        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({
            country: COUNTRY,
            question: FORM.question,
            correctAnswer: 2,
            hiddenAt: null,
            played: false,
            imageUrl: expect.stringMatching(new RegExp(`/v1700000000/world-quiz/test/questions/${CLOUDINARY_ID}-\\d+$`)),
        });
        expect(upload).toHaveBeenCalledTimes(1);
        const [row] = await db.select().from(questions).where(eq(questions.questionId, res.body.data.questionId));
        expect(row.cloudinaryId).toMatch(new RegExp(`^world-quiz/test/questions/${CLOUDINARY_ID}-`));
    });

    it('makes a new country when none matches', async () => {
        const res = await withForm(admin.post(QUESTIONS), { country: 'Admin Testonia' })
            .attach('photo', Buffer.from('jpeg bytes'), PHOTO);
        expect(res.body.data.country).toBe('Admin Testonia');
        expect((await admin.get(COUNTRIES)).body.data.map((c) => c.name)).toContain('Admin Testonia');
    });

    it('needs a photo', async () => {
        const res = await withForm(admin.post(QUESTIONS));
        expect(res.status).toBe(400);
        expect(res.body.error.details).toEqual([{ path: 'body.photo', message: 'Choose a photo of the landmark.' }]);
    });

    it("refuses a file that isn't a JPEG, PNG or WebP, and a photo over 5 MB, before uploading", async () => {
        const gif = await withForm(admin.post(QUESTIONS))
            .attach('photo', Buffer.from('gif bytes'), { filename: 'a.gif', contentType: 'image/gif' });
        expect(gif.status).toBe(400);
        expect(gif.body.error.details).toEqual([{ path: 'body.photo', message: 'Choose a JPEG, PNG or WebP photo.' }]);

        const big = await withForm(admin.post(QUESTIONS)).attach('photo', Buffer.alloc(5 * 1024 * 1024 + 1), PHOTO);
        expect(big.status).toBe(400);
        expect(big.body.error.details).toEqual([{ path: 'body.photo', message: 'Choose a photo of 5 MB or less.' }]);
        expect(upload).not.toHaveBeenCalled();
    });

    it('lists every problem with the fields, and uploads nothing', async () => {
        const res = await withForm(admin.post(QUESTIONS), { hint: ' ', correctAnswer: '4' })
            .attach('photo', Buffer.from('jpeg bytes'), PHOTO);
        expect(res.status).toBe(400);
        expect(res.body.error.details.map((d) => d.path).sort()).toEqual(['body.correctAnswer', 'body.hint']);
        expect(upload).not.toHaveBeenCalled();
    });

    it('shows Cloudinary refusing the file under the photo field', async () => {
        upload.mockRejectedValueOnce({ http_code: 400, message: 'Invalid image file' });
        const res = await withForm(admin.post(QUESTIONS)).attach('photo', Buffer.from('not an image'), PHOTO);
        expect(res.status).toBe(400);
        expect(res.body.error.details[0].path).toBe('body.photo');
    });
});

describe('editing a question', () => {
    it('changes the text and keeps the photo when no new one is sent', async () => {
        const id = seeded[0].questionId;
        const res = await admin.put(`${QUESTIONS}/${id}`)
            .send({ ...FORM, hint: 'An edited hint', correctAnswer: 3 });
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ hint: 'An edited hint', correctAnswer: 3, imageUrl: seeded[0].imageUrl });
        expect(upload).not.toHaveBeenCalled();
        expect(destroy).not.toHaveBeenCalled();
    });

    it('replaces the photo and deletes the old one from Cloudinary', async () => {
        const id = seeded[1].questionId;
        const res = await withForm(admin.put(`${QUESTIONS}/${id}`)).attach('photo', Buffer.from('jpeg bytes'), PHOTO);
        expect(res.status).toBe(200);
        expect(res.body.data.imageUrl).not.toBe(seeded[1].imageUrl);
        expect(destroy).toHaveBeenCalledWith(CLOUDINARY_ID, { resource_type: 'image', invalidate: true });
    });

    it("answers 404 for a question that doesn't exist, uploading nothing", async () => {
        const res = await withForm(admin.put(`${QUESTIONS}/2147483647`)).attach('photo', Buffer.from('jpeg bytes'), PHOTO);
        expect(res.status).toBe(404);
        expect(upload).not.toHaveBeenCalled();
    });
});

describe('deleting a question', () => {
    it('deletes a question no round has used, and its photo', async () => {
        const question = await addQuestion();
        const res = await admin.delete(`${QUESTIONS}/${question.questionId}`);
        expect(res.status).toBe(204);
        expect(await db.select().from(questions).where(eq(questions.questionId, question.questionId))).toHaveLength(0);
        expect(destroy).toHaveBeenCalledWith(`${CLOUDINARY_ID}-extra`, { resource_type: 'image', invalidate: true });
    });

    it('refuses to delete a played question, keeps its photo, and lists it as played', async () => {
        const question = await addQuestion();
        await playQuestion(question.questionId);
        const res = await admin.delete(`${QUESTIONS}/${question.questionId}`);
        expect(res.status).toBe(409);
        expect(res.body.error.message).toBe('This question has been played, so it can only be hidden');
        expect(destroy).not.toHaveBeenCalled();
        expect((await admin.get(`${QUESTIONS}/${question.questionId}`)).body.data.played).toBe(true);
    });

    it("answers 404 for a question that doesn't exist", async () => {
        expect((await admin.delete(`${QUESTIONS}/2147483647`)).status).toBe(404);
    });
});

describe('hiding a question', () => {
    it('hides a question, keeps the first time on a second hide, and brings it back', async () => {
        const question = await addQuestion();
        const url = `${QUESTIONS}/${question.questionId}`;

        const hidden = await admin.post(`${url}/hide`);
        expect(hidden.status).toBe(200);
        expect(hidden.body.data.hiddenAt).toEqual(expect.any(String));
        expect((await admin.post(`${url}/hide`)).body.data.hiddenAt).toBe(hidden.body.data.hiddenAt);
        expect((await admin.get(`${url}/preview`)).body.data.hidden).toBe(true);

        const shown = await admin.post(`${url}/unhide`);
        expect(shown.status).toBe(200);
        expect(shown.body.data.hiddenAt).toBeNull();
    });

    it("answers 404 for a question that doesn't exist", async () => {
        expect((await admin.post(`${QUESTIONS}/2147483647/hide`)).status).toBe(404);
        expect((await admin.post(`${QUESTIONS}/2147483647/unhide`)).status).toBe(404);
    });
});
