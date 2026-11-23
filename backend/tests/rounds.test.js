import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { and, asc, eq, isNull, like } from 'drizzle-orm';

import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { users, countries, questions, rounds, roundQuestions } from '../src/db/schema/index.js';
import { hashPassword } from '../src/lib/passwords.js';

// Everything made here is recognisable, so afterAll can remove it all
const PREFIX = 'rounds-test-';
const COUNTRY = 'Rounds Testland';
const CLOUDINARY_ID = 'rounds-test';
const PASSWORD = 'correct-horse-battery';
// 12, so a second round has 2 unseen questions after a first round of 10
const QUESTION_COUNT = 12;

const ROUNDS = '/api/v1/rounds';
const CURRENT = `${ROUNDS}/current`;
const ANSWER = `${CURRENT}/answer`;

beforeAll(async () => {
    const [country] = await db.insert(countries).values({ name: COUNTRY }).returning();
    await db.insert(questions).values(Array.from({ length: QUESTION_COUNT }, (_, i) => ({
        countryId: country.countryId,
        imageUrl: `https://example.com/rounds-test-${i}.jpg`,
        cloudinaryId: CLOUDINARY_ID,
        question: `Rounds test question ${i}`,
        hint: `Rounds test hint ${i}`,
        answer1: `Q${i} answer 1`,
        answer2: `Q${i} answer 2`,
        answer3: `Q${i} answer 3`,
        // Spread over 1 to 3, so code that always reads the same answer can't pass
        correctAnswer: (i % 3) + 1,
    })));
});

afterAll(async () => {
    // Rounds go with their players; only then can the played questions be deleted
    await db.delete(users).where(like(users.email, `${PREFIX}%`));
    await db.delete(questions).where(eq(questions.cloudinaryId, CLOUDINARY_ID));
    await db.delete(countries).where(eq(countries.name, COUNTRY));
});

let count = 0;
function newAccount() {
    count += 1;
    const stamp = `${Date.now() % 100000}${count}`;
    return { name: `Rounds${stamp}`, email: `${PREFIX}${stamp}@example.com`, password: PASSWORD };
}

// A signed-up player and an agent that carries their cookie, like a browser
async function newPlayer() {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/sign-up').send(newAccount());
    return { agent, userId: res.body.data.userId };
}

// The player's current question as the database holds it, for checks the API must not answer
async function currentRow(userId) {
    const [row] = await db
        .select({ rq: roundQuestions, correctAnswer: questions.correctAnswer, hint: questions.hint })
        .from(roundQuestions)
        .innerJoin(rounds, eq(rounds.roundId, roundQuestions.roundId))
        .innerJoin(questions, eq(questions.questionId, roundQuestions.questionId))
        .where(and(eq(rounds.userId, userId), eq(rounds.status, 'active'), isNull(roundQuestions.answeredAt)))
        .orderBy(asc(roundQuestions.position))
        .limit(1);
    return row;
}

// The button showing the right answer, read from the database: the API never says before the answer
async function rightChoice(userId) {
    const { rq, correctAnswer } = await currentRow(userId);
    return rq.answerOrder.indexOf(correctAnswer) + 1;
}

const wrongOf = (choice) => (choice % 3) + 1;

// Answers right or wrong, then opens the next question as the game page will
async function answer(player, right = true) {
    const choice = await rightChoice(player.userId);
    const res = await player.agent.post(ANSWER).send({ choice: right ? choice : wrongOf(choice) });
    if (res.status === 200 && !res.body.data.summary) await player.agent.get(CURRENT);
    return res;
}

describe('starting a round', () => {
    it('picks 10 different questions, shuffles each, and shows the first without its answer', async () => {
        const player = await newPlayer();
        const res = await player.agent.post(ROUNDS);
        expect(res.status).toBe(201);
        expect(res.body.data).toEqual({
            roundId: expect.any(Number),
            position: 1,
            total: 10,
            question: {
                imageUrl: expect.stringMatching(/^https:\/\/example\.com\/rounds-test-/),
                text: expect.stringMatching(/^Rounds test question/),
                answers: [expect.any(String), expect.any(String), expect.any(String)],
                hint: null,
            },
            tokensEarned: 0,
            streak: 0,
        });
        // Nothing in the body may say which answer is right
        expect(JSON.stringify(res.body)).not.toMatch(/correct|answerOrder/i);

        const rows = await db.select().from(roundQuestions).where(eq(roundQuestions.roundId, res.body.data.roundId));
        expect(rows).toHaveLength(10);
        expect(new Set(rows.map((row) => row.questionId)).size).toBe(10);
        for (const row of rows) expect([...row.answerOrder].sort()).toEqual([1, 2, 3]);
    });

    it('shows the answers in the order the round stored', async () => {
        const player = await newPlayer();
        const res = await player.agent.post(ROUNDS);
        const { rq } = await currentRow(player.userId);
        const [question] = await db.select().from(questions).where(eq(questions.questionId, rq.questionId));
        expect(res.body.data.question.answers).toEqual(rq.answerOrder.map((n) => question[`answer${n}`]));
    });

    it('refuses a second round while one is in play', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        const second = await player.agent.post(ROUNDS);
        expect(second.status).toBe(409);
    });

    it('starts only one round from two Play clicks at once', async () => {
        const player = await newPlayer();
        const results = await Promise.all([player.agent.post(ROUNDS), player.agent.post(ROUNDS)]);
        expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
        const active = await db.select().from(rounds).where(and(eq(rounds.userId, player.userId), eq(rounds.status, 'active')));
        expect(active).toHaveLength(1);
    });
});

describe('the current round', () => {
    // Needs the answer route, which comes with the answering task
    it.skip('continues where the player left off and records when the question was shown', async () => {
        const player = await newPlayer();
        const started = await player.agent.post(ROUNDS);
        await answer(player);

        // A new agent is a new visit: log in again and carry on
        const again = request.agent(app);
        const [user] = await db.select().from(users).where(eq(users.userId, player.userId));
        await again.post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
        const res = await again.get(CURRENT);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ roundId: started.body.data.roundId, position: 2, tokensEarned: 10, streak: 1 });
        expect((await currentRow(player.userId)).rq.shownAt).toBeInstanceOf(Date);
    });

    it('answers 404 when there is no round in play', async () => {
        const player = await newPlayer();
        expect((await player.agent.get(CURRENT)).status).toBe(404);
    });
});

describe('who can play', () => {
    it('needs a logged-in player', async () => {
        expect((await request(app).post(ROUNDS)).status).toBe(401);
    });

    it('turns admins away', async () => {
        const account = newAccount();
        await db.insert(users).values({
            name: account.name,
            email: account.email,
            passwordHash: await hashPassword(PASSWORD),
            role: 'admin',
        });
        const admin = request.agent(app);
        await admin.post('/api/v1/auth/login').send({ email: account.email, password: PASSWORD });
        expect((await admin.post(ROUNDS)).status).toBe(403);
    });
});
